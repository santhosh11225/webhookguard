import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApiRouter } from '../routes/index.js';

describe('GitHub Actions CI/CD Integration API Endpoint Tests', () => {
  let server: any;
  let baseUrl: string;
  const TEST_ADMIN_KEY = 'test_cicd_admin_key_sec_123';
  const originalFetch = globalThis.fetch;

  before(async () => {
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    process.env.DB_PATH = ':memory:';

    const app = express();
    app.use(express.json());
    app.use('/api', createApiRouter());

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    delete process.env.ADMIN_API_KEY;
    delete process.env.GITHUB_ACTIONS_TOKEN;
    globalThis.fetch = originalFetch;
    if (server) {
      await new Promise<void>((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    delete process.env.GITHUB_ACTIONS_TOKEN;
    globalThis.fetch = originalFetch;
  });

  // 1. Authorization tests
  it('rejects unauthenticated POST /api/cicd/dispatch with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/cicd/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suiteId: 'd9e01a79-a009-4041-9ed4-b8e17f241c60' }),
    });
    assert.equal(res.status, 401);
  });

  it('rejects unauthenticated GET /api/cicd/status with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/cicd/status`);
    assert.equal(res.status, 401);
  });

  // 2. Validation tests
  it('returns HTTP 400 when suiteId is missing', async () => {
    const res = await fetch(`${baseUrl}/cicd/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as any;
    assert.match(body.error, /suiteId is required/i);
  });

  it('returns HTTP 400 when suiteId is not in the approved allowlist', async () => {
    const res = await fetch(`${baseUrl}/cicd/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ suiteId: 'arbitrary-unauthorized-suite-xyz' }),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as any;
    assert.match(body.error, /Unauthorized or invalid test suite ID/i);
  });

  // 3. Configuration test (missing GITHUB_ACTIONS_TOKEN)
  it('returns HTTP 503 when GITHUB_ACTIONS_TOKEN is not configured', async () => {
    const res = await fetch(`${baseUrl}/cicd/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ suiteId: 'd9e01a79-a009-4041-9ed4-b8e17f241c60' }),
    });
    assert.equal(res.status, 503);
    const body = (await res.json()) as any;
    assert.match(body.error, /GITHUB_ACTIONS_TOKEN/i);
  });

  // 4. GitHub API error handling
  it('handles GitHub API dispatch failures gracefully with HTTP 400/502 without leaking credentials', async () => {
    process.env.GITHUB_ACTIONS_TOKEN = 'ghp_dummy_token_for_mocking_purposes';

    // Mock fetch for GitHub dispatches
    globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
      const urlStr = input.toString();
      if (urlStr.includes('api.github.com/repos/')) {
        return new Response(JSON.stringify({ message: 'Bad credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    };

    const res = await fetch(`${baseUrl}/cicd/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ suiteId: 'd9e01a79-a009-4041-9ed4-b8e17f241c60' }),
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as any;
    assert.match(body.error, /Bad credentials/i);
    // Ensure token is never included in response
    assert.equal(JSON.stringify(body).includes('ghp_dummy_token'), false);
  });

  // 5. Successful dispatch
  it('returns HTTP 202 with safe dispatch details when GitHub accepts workflow_dispatch', async () => {
    process.env.GITHUB_ACTIONS_TOKEN = 'ghp_valid_mock_token_12345';

    let capturedUrl = '';
    let capturedBody: any = null;
    let capturedAuth = '';

    globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
      const urlStr = input.toString();
      if (urlStr.includes('api.github.com/repos/')) {
        capturedUrl = urlStr;
        capturedBody = JSON.parse(init?.body as string);
        capturedAuth = (init?.headers as any)?.['Authorization'];
        return new Response(null, { status: 204 }); // GitHub returns 204 No Content on success
      }
      return originalFetch(input, init);
    };

    const res = await fetch(`${baseUrl}/cicd/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ suiteId: 'd9e01a79-a009-4041-9ed4-b8e17f241c60' }),
    });

    assert.equal(res.status, 202);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.suiteId, 'd9e01a79-a009-4041-9ed4-b8e17f241c60');
    assert.equal(body.suiteName, 'CI-CD-PASS-DEMO');
    assert.equal(body.workflow, 'webhookguard-manual-quality-gate.yml');
    assert.equal(body.repository, 'santhosh11225/webhookguard');

    // Verify outbound GitHub request payload
    assert.match(capturedUrl, /webhookguard-manual-quality-gate\.yml\/dispatches$/);
    assert.equal(capturedBody.ref, 'master');
    assert.equal(capturedBody.inputs.suite_id, 'd9e01a79-a009-4041-9ed4-b8e17f241c60');
    assert.equal(capturedAuth, 'Bearer ghp_valid_mock_token_12345');
  });

  // 6. Status retrieval
  it('returns workflow run details for a completed or in-progress run', async () => {
    process.env.GITHUB_ACTIONS_TOKEN = 'ghp_valid_mock_token_12345';

    globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
      const urlStr = input.toString();
      if (urlStr.includes('api.github.com/repos/')) {
        return new Response(
          JSON.stringify({
            workflow_runs: [
              {
                id: 99887766,
                name: 'WebhookGuard Quality Gate Execution',
                status: 'completed',
                conclusion: 'success',
                html_url: 'https://github.com/santhosh11225/webhookguard/actions/runs/99887766',
                created_at: '2026-10-12T18:30:00Z',
                updated_at: '2026-10-12T18:30:45Z',
                run_number: 42,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    };

    const res = await fetch(`${baseUrl}/cicd/status`, {
      headers: {
        'X-API-Key': TEST_ADMIN_KEY,
      },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.found, true);
    assert.equal(body.run.id, 99887766);
    assert.equal(body.run.status, 'completed');
    assert.equal(body.run.conclusion, 'success');
    assert.equal(body.run.htmlUrl, 'https://github.com/santhosh11225/webhookguard/actions/runs/99887766');
  });

  // 7. Status retrieval with since parameter
  it('returns found: false when only older historical runs exist for a recent since timestamp', async () => {
    process.env.GITHUB_ACTIONS_TOKEN = 'ghp_valid_mock_token_12345';

    globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
      const urlStr = input.toString();
      if (urlStr.includes('api.github.com/repos/')) {
        return new Response(
          JSON.stringify({
            workflow_runs: [
              {
                id: 11111,
                name: 'WebhookGuard Quality Gate Execution',
                status: 'completed',
                conclusion: 'success',
                html_url: 'https://github.com/santhosh11225/webhookguard/actions/runs/11111',
                created_at: '2026-10-12T12:00:00Z', // hours earlier
                updated_at: '2026-10-12T12:00:45Z',
                run_number: 10,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    };

    const res = await fetch(`${baseUrl}/cicd/status?since=2026-10-12T18:00:00Z`, {
      headers: {
        'X-API-Key': TEST_ADMIN_KEY,
      },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.found, false);
    assert.equal(body.status, 'queued');
  });

  // 8. Direct runId lookup
  it('fetches specific run directly when runId query param is supplied', async () => {
    process.env.GITHUB_ACTIONS_TOKEN = 'ghp_valid_mock_token_12345';

    globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
      const urlStr = input.toString();
      if (urlStr.includes('/actions/runs/554433')) {
        return new Response(
          JSON.stringify({
            id: 554433,
            name: 'WebhookGuard Quality Gate Execution',
            status: 'in_progress',
            conclusion: null,
            html_url: 'https://github.com/santhosh11225/webhookguard/actions/runs/554433',
            created_at: '2026-10-12T18:35:00Z',
            updated_at: '2026-10-12T18:35:10Z',
            run_number: 45,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    };

    const res = await fetch(`${baseUrl}/cicd/status?runId=554433`, {
      headers: {
        'X-API-Key': TEST_ADMIN_KEY,
      },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.found, true);
    assert.equal(body.run.id, 554433);
    assert.equal(body.run.status, 'in_progress');
    assert.equal(body.run.conclusion, null);
  });
});
