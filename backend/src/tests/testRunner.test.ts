import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { SqliteEndpointRepository } from '../repositories/sqlite/endpoint.repository.js';
import { SqliteTestSuiteRepository } from '../repositories/sqlite/testSuite.repository.js';
import { SqliteTestRunRepository } from '../repositories/sqlite/testRun.repository.js';
import { SqliteTestResultRepository } from '../repositories/sqlite/testResult.repository.js';
import { closeDatabase } from '../repositories/sqlite/database.js';
import { TestRunnerService } from '../services/testRunner.service.js';
import { MockReceiverController } from '../controllers/mockReceiver.controller.js';
import { Endpoint, TestSuite } from '../models/types.js';

describe('Test Runner Service & Assertions', () => {
  let server: http.Server;
  let baseUrl: string;
  let endpointRepo: SqliteEndpointRepository;
  let suiteRepo: SqliteTestSuiteRepository;
  let runRepo: SqliteTestRunRepository;
  let resultRepo: SqliteTestResultRepository;
  let runner: TestRunnerService;
  let paymentEndpoint: Endpoint;
  let vulnerableEndpoint: Endpoint;

  before(async () => {
    // Isolate database for tests so development database is never contaminated
    closeDatabase();
    process.env.DB_PATH = ':memory:';

    // 1. Setup local mock receiver server
    const app = express();
    app.use(
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf.toString('utf8');
        },
      })
    );

    const controller = new MockReceiverController();
    app.all('/payment', controller.handlePayment.bind(controller));
    app.all('/orders', controller.handleOrder.bind(controller));

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // 2. Setup SQLite repositories
    endpointRepo = new SqliteEndpointRepository();
    suiteRepo = new SqliteTestSuiteRepository();
    runRepo = new SqliteTestRunRepository();
    resultRepo = new SqliteTestResultRepository();

    runner = new TestRunnerService(endpointRepo, suiteRepo, runRepo, resultRepo);

    // 3. Create test endpoints
    paymentEndpoint = await endpointRepo.create({
      name: 'Test Secure Payment Endpoint',
      url: `${baseUrl}/payment`,
      method: 'POST',
      authentication: 'hmac',
      secret: 'whsec_test_98af21d09e023190ab78ff09a1',
      headers: { 'X-Signature-Header': 'X-Signature' },
      environment: 'local',
    });

    vulnerableEndpoint = await endpointRepo.create({
      name: 'Test Vulnerable Payment Endpoint',
      url: `${baseUrl}/payment?vulnerable=true`,
      method: 'POST',
      authentication: 'hmac',
      secret: 'whsec_test_98af21d09e023190ab78ff09a1',
      headers: { 'X-Signature-Header': 'X-Signature' },
      environment: 'local',
    });
  });

  after(async () => {
    closeDatabase();
    delete process.env.DB_PATH;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('correctly records PASS when actual status matches expected 200 OK', async () => {
    const suite = await suiteRepo.create({
      endpointId: paymentEndpoint.id,
      name: 'Valid Payload Suite',
      tests: [
        {
          id: 'test-pass-200',
          name: 'Valid Payment Request',
          type: 'valid',
          method: 'POST',
          payload: { event: 'payment.success', transaction_id: 'txn_pass_01', amount: 2500 },
          expectedStatus: 200,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(paymentEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'passed');
    assert.equal(run.passed, 1);
    assert.equal(run.failed, 0);
    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'PASS');
    assert.equal(results[0].actualStatus, 200);
    assert.equal(results[0].expectedStatus, 200);
  });

  it('correctly records PASS when expected error response (HTTP 401) matches actual rejection', async () => {
    const suite = await suiteRepo.create({
      endpointId: paymentEndpoint.id,
      name: 'HMAC Rejection Suite',
      tests: [
        {
          id: 'test-expect-401',
          name: 'Invalid HMAC Negative Test',
          type: 'invalid_hmac',
          method: 'POST',
          payload: { event: 'payment.success', transaction_id: 'txn_bad_sig', amount: 2500 },
          expectedStatus: 401,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(paymentEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'passed');
    assert.equal(results[0].status, 'PASS');
    assert.equal(results[0].actualStatus, 401);
    assert.equal(results[0].expectedStatus, 401);
  });

  it('correctly records FAIL when an unexpected response is received', async () => {
    const suite = await suiteRepo.create({
      endpointId: paymentEndpoint.id,
      name: 'Unexpected Response Suite',
      tests: [
        {
          id: 'test-unexpected-status',
          name: 'Test expecting 200 but sending invalid HMAC',
          type: 'invalid_hmac',
          method: 'POST',
          payload: { event: 'payment.success', transaction_id: 'txn_fail_01', amount: 2500 },
          expectedStatus: 200, // Deliberately expecting 200 when receiver will reject with 401
        },
      ],
    });

    const { run, results } = await runner.executeSuite(paymentEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'failed');
    assert.equal(run.failed, 1);
    assert.equal(results[0].status, 'FAIL');
    assert.equal(results[0].actualStatus, 401);
    assert.equal(results[0].expectedStatus, 200);
  });

  it('flags SECURITY FAILURE when vulnerable endpoint accepts invalid HMAC', async () => {
    const suite = await suiteRepo.create({
      endpointId: vulnerableEndpoint.id,
      name: 'Vulnerability Audit Suite',
      tests: [
        {
          id: 'test-vuln-audit',
          name: 'Audit Invalid Signature Rejection',
          type: 'invalid_hmac',
          method: 'POST',
          payload: { event: 'payment.success', transaction_id: 'txn_vuln_01', amount: 9999 },
          expectedStatus: 401,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(vulnerableEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'failed');
    assert.equal(results[0].status, 'SECURITY FAILURE');
    assert.equal(results[0].actualStatus, 200);
    assert.ok(results[0].securityDetails);
    assert.equal(results[0].securityDetails?.severity, 'critical');
  });

  it('blocks cloud metadata endpoints via SSRF protection', async () => {
    const metadataEndpoint = await endpointRepo.create({
      name: 'Malicious Cloud Metadata Target',
      url: 'http://169.254.169.254/latest/meta-data/',
      method: 'POST',
      authentication: 'none',
      headers: {},
      environment: 'local',
    });

    const suite = await suiteRepo.create({
      endpointId: metadataEndpoint.id,
      name: 'SSRF Test Suite',
      tests: [
        {
          id: 'test-ssrf',
          name: 'Metadata Exfiltration Attempt',
          type: 'valid',
          expectedStatus: 200,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(metadataEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'failed');
    assert.equal(results[0].status, 'ERROR');
    assert.match(results[0].error || '', /SSRF Protection/i);
  });

  it('persists execution history and test results to database', async () => {
    const suite = await suiteRepo.create({
      endpointId: paymentEndpoint.id,
      name: 'Persistence Verification Suite',
      tests: [
        {
          id: 'test-persist-1',
          name: 'Persisted Test Case',
          type: 'valid',
          payload: { event: 'payment.success', transaction_id: 'txn_persist_01', amount: 100 },
          expectedStatus: 200,
        },
      ],
    });

    const { run } = await runner.executeSuite(paymentEndpoint.id, suite.id, 'manual');

    // Retrieve from database directly
    const storedRun = await runRepo.findById(run.id);
    assert.ok(storedRun);
    assert.equal(storedRun.id, run.id);
    assert.equal(storedRun.status, 'passed');

    const storedResults = await resultRepo.findByRunId(run.id);
    assert.equal(storedResults.length, 1);
    assert.equal(storedResults[0].testName, 'Persisted Test Case');
    assert.equal(storedResults[0].status, 'PASS');
  });
});
