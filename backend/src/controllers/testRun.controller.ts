import { Request, Response, NextFunction } from 'express';
import { TestRunnerService } from '../services/testRunner.service.js';
import { ITestRunRepository } from '../repositories/interfaces/ITestRunRepository.js';

export class TestRunController {
  constructor(
    private testRunner: TestRunnerService,
    private runRepo: ITestRunRepository
  ) {}

  /**
   * Run a test suite (CI/CD-ready)
   */
  createRun = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { endpointId, suiteId, trigger } = req.body;
      const failOnErrors = req.query.failOnErrors === 'true' || req.body.failOnErrors === true;

      if (!endpointId || !suiteId) {
        res.status(400).json({
          success: false,
          error: 'Both endpointId and suiteId are required to start a test run',
        });
        return;
      }

      const { run, results } = await this.testRunner.executeSuite(
        endpointId,
        suiteId,
        trigger || 'manual'
      );

      const responsePayload = {
        success: run.status === 'passed',
        runId: run.id,
        status: run.status,
        total: run.totalTests,
        passed: run.passed,
        failed: run.failed,
        durationMs: run.durationMs,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        resultsSummary: results.map((r) => ({
          testName: r.testName,
          status: r.status,
          actualStatus: r.actualStatus,
          expectedStatus: r.expectedStatus,
          responseTime: r.responseTime,
          error: r.error,
        })),
      };

      // If CI/CD quality gate enforcement is active and tests failed, return HTTP 422 Unprocessable Entity
      if (failOnErrors && run.status !== 'passed') {
        res.status(422).json({
          ...responsePayload,
          error: `WebhookGuard Quality Gate Failed: ${run.failed} out of ${run.totalTests} tests failed`,
        });
        return;
      }

      res.status(201).json(responsePayload);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const endpointId = req.query.endpointId as string | undefined;
      const suiteId = req.query.suiteId as string | undefined;

      let runs;
      if (endpointId) {
        runs = await this.runRepo.findByEndpointId(endpointId);
      } else if (suiteId) {
        runs = await this.runRepo.findBySuiteId(suiteId);
      } else {
        const limit = parseInt(req.query.limit as string, 10) || 100;
        runs = await this.runRepo.findAll(limit);
      }

      res.json({ success: true, data: runs });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const run = await this.runRepo.findById(req.params.id);
      if (!run) {
        res.status(404).json({ success: false, error: 'Test run not found' });
        return;
      }
      res.json({ success: true, data: run });
    } catch (err) {
      next(err);
    }
  };
}
