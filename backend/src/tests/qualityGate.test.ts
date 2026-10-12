import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createApiRouter } from '../routes/index.js';
import { SqliteEndpointRepository } from '../repositories/sqlite/endpoint.repository.js';
import { SqliteTestSuiteRepository } from '../repositories/sqlite/testSuite.repository.js';
import { closeDatabase } from '../repositories/sqlite/database.js';
import { Endpoint, TestSuite } from '../models/types.js';

describe('CI/CD Quality Gate API Endpoint', () => {
  let server: http.Server;
  let baseUrl: string;
  let endpointRepo: SqliteEndpointRepository;
  let suiteRepo: SqliteTestSuiteRepository;
  let passingSuite: TestSuite;
  let failingSuite: TestSuite;
  let endpoint: Endpoint;

  before(async () => {
    // Isolate database for tests so development database is never contaminated
    closeDatabase();
    process.env.DB_PATH = ':memory:';

    const app = express();
    app.use(
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf.toString('utf8');
        },
      })
    );
    app.use('/api', createApiRouter());

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    endpointRepo = new SqliteEndpointRepository();
    suiteRepo = new SqliteTestSuiteRepository();

    endpoint = await endpointRepo.create({
      name: 'Quality Gate Target',
      url: `${baseUrl}/api/mock-webhooks/payment`,
      method: 'POST',
      authentication: 'hmac',
      secret: 'whsec_test_98af21d09e023190ab78ff09a1',
      headers: { 'X-Signature-Header': 'X-Signature' },
      environment: 'local',
    });

    passingSuite = await suiteRepo.create({
      endpointId: endpoint.id,
      name: 'Passing Quality Gate Suite',
      tests: [
        {
          id: 'qg-pass-1',
          name: 'Valid Webhook Call',
          type: 'valid',
          payload: { event: 'payment.success', transaction_id: 'txn_qg_pass', amount: 1500 },
          expectedStatus: 200,
        },
      ],
    });

    failingSuite = await suiteRepo.create({
      endpointId: endpoint.id,
      name: 'Failing Quality Gate Suite',
      tests: [
        {
          id: 'qg-fail-1',
          name: 'Unexpected Status Expectation',
          type: 'invalid_hmac',
          payload: { event: 'payment.success', transaction_id: 'txn_qg_fail', amount: 1500 },
          expectedStatus: 200, // Endpoint returns 401, so this test fails
        },
      ],
    });
  });

  after(async () => {
    closeDatabase();
    delete process.env.DB_PATH;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('returns HTTP 201 when all tests in the suite pass with failOnErrors=true', async () => {
    const res = await fetch(`${baseUrl}/api/test-runs?failOnErrors=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpointId: endpoint.id,
        suiteId: passingSuite.id,
        trigger: 'cicd',
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.status, 'passed');
    assert.equal(body.passed, 1);
    assert.equal(body.failed, 0);
  });

  it('returns HTTP 422 Unprocessable Entity when tests fail with failOnErrors=true', async () => {
    const res = await fetch(`${baseUrl}/api/test-runs?failOnErrors=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpointId: endpoint.id,
        suiteId: failingSuite.id,
        trigger: 'cicd',
      }),
    });

    assert.equal(res.status, 422);
    const body = (await res.json()) as any;
    assert.equal(body.success, false);
    assert.equal(body.status, 'failed');
    assert.equal(body.failed, 1);
    assert.match(body.error, /WebhookGuard Quality Gate Failed/i);
  });

  it('returns HTTP 201 when failOnErrors is false even if tests failed (informational run)', async () => {
    const res = await fetch(`${baseUrl}/api/test-runs?failOnErrors=false`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpointId: endpoint.id,
        suiteId: failingSuite.id,
        trigger: 'manual',
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.equal(body.status, 'failed');
    assert.equal(body.failed, 1);
  });

  it('returns HTTP 400 when endpointId or suiteId is missing', async () => {
    const res = await fetch(`${baseUrl}/api/test-runs?failOnErrors=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpointId: endpoint.id,
        // suiteId is missing
      }),
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as any;
    assert.match(body.error, /Both endpointId and suiteId are required/i);
  });
});
