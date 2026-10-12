import { Request, Response, NextFunction } from 'express';
import { ITestSuiteRepository } from '../repositories/interfaces/ITestSuiteRepository.js';
import { IEndpointRepository } from '../repositories/interfaces/IEndpointRepository.js';

export const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'santhosh11225';
export const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'webhookguard';
export const GITHUB_WORKFLOW_FILE = 'webhookguard-manual-quality-gate.yml';

/**
 * Verified Allowlist of Demo Test Suites permitted for manual GitHub Actions triggering
 */
export const APPROVED_SUITE_MAPPINGS: Record<string, { name: string; endpointId: string }> = {
  // Demo suites
  'd9e01a79-a009-4041-9ed4-b8e17f241c60': {
    name: 'CI-CD-PASS-DEMO',
    endpointId: 'af3554fa-9c02-4941-bd14-4d476517eda5',
  },
  'aac73296-b27f-4b1b-9e34-f0a65b8192eb': {
    name: 'CI-CD-FAIL-DEMO',
    endpointId: 'af3554fa-9c02-4941-bd14-4d476517eda5',
  },
  '34438baa-29ab-43f8-b659-cd0faff6c92a': {
    name: 'DEMO-BASIC-VALIDATION',
    endpointId: 'fb75f317-0843-4887-9b49-211dbd38fcd2',
  },
  'faea8190-d80e-45c0-8187-01007281ac61': {
    name: 'DEMO-AUTHENTICATION-SECURITY',
    endpointId: '051326d1-f764-456c-8eae-0342d190a127',
  },
  'fcf5934e-0220-4b47-a3dc-320a916f1791': {
    name: 'DEMO-HTTP-STATUS-HANDLING',
    endpointId: 'fb75f317-0843-4887-9b49-211dbd38fcd2',
  },
  '2ec53e3d-f21a-4a63-9ae4-428288c13c63': {
    name: 'DEMO-RETRY-RESILIENCE',
    endpointId: '1c071605-ad46-4054-887a-08b0197b3598',
  },
  '62c675bc-f879-4834-8183-ff15aa893bf6': {
    name: 'DEMO-SSRF-SECURITY',
    endpointId: '70073933-644e-4660-9e32-57ca0f0632e7',
  },
  '1a7d6d60-d391-4dc7-80c8-254a1869b46a': {
    name: 'DEMO-PAYLOAD-EDGE-CASES',
    endpointId: 'fb75f317-0843-4887-9b49-211dbd38fcd2',
  },
  '8869dcb6-8d5f-48f2-8710-57a428b94e4c': {
    name: 'DEMO-WEBHOOK-REGRESSION',
    endpointId: 'fb75f317-0843-4887-9b49-211dbd38fcd2',
  },
  // Production / Pre-existing suites
  'cc39aca4-636a-45b3-9f35-38799671a9de': {
    name: 'sample t1',
    endpointId: '6abd6350-238b-497b-b434-9a26265e26f7',
  },
  '7a831d09-47b7-430c-a1d9-60b01211f62b': {
    name: 'sample test 2',
    endpointId: 'b61cceba-f118-446b-8d90-390bcedaf96c',
  },
};

export class CicdController {
  constructor(
    private suiteRepo: ITestSuiteRepository,
    private endpointRepo: IEndpointRepository
  ) {}

  /**
   * Dispatch a real GitHub Actions workflow_dispatch event for the selected suite
   */
  dispatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { suiteId, endpointId: requestedEndpointId } = req.body;

      if (!suiteId || typeof suiteId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'suiteId is required to trigger GitHub Actions quality gate',
        });
        return;
      }

      // 1. Validate suite against allowlist and resolve endpoint mapping
      let mapping = APPROVED_SUITE_MAPPINGS[suiteId];
      if (!mapping) {
        // Fallback: check database for dynamically seeded demo suites
        const dbSuite = await this.suiteRepo.findById(suiteId);
        if (
          dbSuite &&
          (dbSuite.name.startsWith('DEMO-') ||
            dbSuite.name.startsWith('CI-CD-') ||
            dbSuite.name.startsWith('sample '))
        ) {
          mapping = { name: dbSuite.name, endpointId: dbSuite.endpointId };
        }
      }

      if (!mapping) {
        res.status(400).json({
          success: false,
          error: `Unauthorized or invalid test suite ID: "${suiteId}". Suite must be an approved WebhookGuard demo suite.`,
        });
        return;
      }

      const endpointId = requestedEndpointId || mapping.endpointId;

      // 2. Ensure GitHub Actions Token is configured
      const token = process.env.GITHUB_ACTIONS_TOKEN || process.env.GITHUB_TOKEN;
      if (!token) {
        res.status(503).json({
          success: false,
          error:
            'GitHub Actions integration is not configured on the backend. Please set the GITHUB_ACTIONS_TOKEN environment variable with actions:write permissions.',
        });
        return;
      }

      // 3. Dispatch workflow to GitHub REST API
      const dispatchUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/${GITHUB_WORKFLOW_FILE}/dispatches`;

      const ghRes = await fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'WebhookGuard-Backend/1.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'master',
          inputs: {
            suite_id: suiteId,
            endpoint_id: endpointId,
          },
        }),
      });

      if (ghRes.status === 204) {
        res.status(202).json({
          success: true,
          message: 'GitHub Actions workflow dispatch request accepted by GitHub',
          suiteId,
          endpointId,
          suiteName: mapping.name,
          repository: `${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
          workflow: GITHUB_WORKFLOW_FILE,
          dispatchedAt: new Date().toISOString(),
        });
        return;
      }

      // Handle GitHub API errors gracefully without exposing sensitive credentials
      let errorDetail = `GitHub API returned HTTP ${ghRes.status}`;
      try {
        const errJson = (await ghRes.json()) as any;
        if (errJson && errJson.message) {
          errorDetail = errJson.message;
        }
      } catch {}

      res.status(ghRes.status >= 500 ? 502 : 400).json({
        success: false,
        error: `Failed to dispatch GitHub Actions workflow: ${errorDetail}`,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Internal server error dispatching GitHub workflow: ${err.message}`,
      });
    }
  };

  /**
   * Retrieve the status of the GitHub Actions workflow run
   */
  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const runId = req.query.runId as string | undefined;
      const since = req.query.since as string | undefined;

      const token = process.env.GITHUB_ACTIONS_TOKEN || process.env.GITHUB_TOKEN;
      if (!token) {
        res.status(503).json({
          success: false,
          error:
            'GitHub Actions integration is not configured. Missing GITHUB_ACTIONS_TOKEN environment variable.',
        });
        return;
      }

      // 1. Direct Run Lookup by runId
      if (runId) {
        const runUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/runs/${runId}`;
        const runRes = await fetch(runUrl, {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'WebhookGuard-Backend/1.0',
          },
        });

        if (!runRes.ok) {
          res.status(runRes.status === 404 ? 404 : 502).json({
            success: false,
            error: `Failed to fetch GitHub run ${runId} (HTTP ${runRes.status})`,
          });
          return;
        }

        const run = (await runRes.json()) as any;
        res.json({
          success: true,
          found: true,
          run: {
            id: run.id,
            name: run.name,
            status: run.status, // "queued" | "in_progress" | "completed"
            conclusion: run.conclusion, // "success" | "failure" | "timed_out" | null
            htmlUrl: run.html_url,
            createdAt: run.created_at,
            updatedAt: run.updated_at,
            runNumber: run.run_number,
          },
        });
        return;
      }

      // 2. Discover Latest Workflow Run for the manual quality gate
      const runsUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/${GITHUB_WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=5`;
      const runsRes = await fetch(runsUrl, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'WebhookGuard-Backend/1.0',
        },
      });

      if (!runsRes.ok) {
        res.status(502).json({
          success: false,
          error: `Failed to query GitHub workflow runs (HTTP ${runsRes.status})`,
        });
        return;
      }

      const runsData = (await runsRes.json()) as any;
      const runs = runsData.workflow_runs || [];

      if (runs.length === 0) {
        res.json({
          success: true,
          found: false,
          status: 'queued',
          message: 'Workflow run queued on GitHub; waiting for runner initialization...',
        });
        return;
      }

      // If a `since` timestamp was provided, find a run created around or after that time
      let matchedRun = runs[0];
      if (since) {
        const sinceEpoch = new Date(since).getTime() - 60000; // 60s tolerance for clock drift
        const recentRun = runs.find(
          (r: any) => new Date(r.created_at).getTime() >= sinceEpoch
        );
        if (recentRun) {
          matchedRun = recentRun;
        }
      }

      res.json({
        success: true,
        found: true,
        run: {
          id: matchedRun.id,
          name: matchedRun.name,
          status: matchedRun.status,
          conclusion: matchedRun.conclusion,
          htmlUrl: matchedRun.html_url,
          createdAt: matchedRun.created_at,
          updatedAt: matchedRun.updated_at,
          runNumber: matchedRun.run_number,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Internal server error querying GitHub run status: ${err.message}`,
      });
    }
  };
}
