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
import { generateHmacSha256 } from '../utils/hmac.js';

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
  let orderEndpoint: Endpoint;
  let inventoryEndpoint: Endpoint;

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
    app.all('/inventory', controller.handleInventory.bind(controller));
    app.all('/throttled', (_req, res) => {
      res.status(429).set('Content-Type', 'text/html').send('<!DOCTYPE html><html><body>Error: Request limit exceeded - Webhook.site</body></html>');
    });

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

    orderEndpoint = await endpointRepo.create({
      name: 'Test E-Commerce Order Sync Webhook',
      url: `${baseUrl}/orders`,
      method: 'POST',
      authentication: 'bearer',
      secret: 'tok_live_ord_8492048109',
      headers: { 'X-Source-Service': 'order-fulfillment-engine' },
      environment: 'local',
    });

    inventoryEndpoint = await endpointRepo.create({
      name: 'Test Warehouse Inventory Replenishment',
      url: `${baseUrl}/inventory`,
      method: 'POST',
      authentication: 'api_key',
      secret: 'ak_sec_wh_789123400',
      headers: { 'X-Warehouse-Zone': 'us-east-1a' },
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

  it('marks SSRF test as PASS when prohibited cloud metadata destination is blocked pre-flight', async () => {
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
          type: 'ssrf',
          expectedStatus: 403,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(metadataEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'passed');
    assert.equal(run.passed, 1);
    assert.equal(run.failed, 0);
    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'PASS');
    assert.equal(results[0].expectedStatus, 403);
    assert.equal(results[0].actualStatus, undefined);
    assert.equal(results[0].responseTime, 0);
    assert.match(
      results[0].error || '',
      /SSRF Protection: Access to cloud instance metadata \(169\.254\.169\.254\) is strictly prohibited\./
    );
  });

  it('permits normal webhook traffic and evaluates standard HTTP responses correctly', async () => {
    const suite = await suiteRepo.create({
      endpointId: paymentEndpoint.id,
      name: 'Standard Permitted Traffic Suite',
      tests: [
        {
          id: 'test-permitted-normal',
          name: 'Permitted Local Endpoint Request',
          type: 'valid',
          method: 'POST',
          payload: { event: 'payment.success', transaction_id: 'txn_permit_01', amount: 500 },
          expectedStatus: 200,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(paymentEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'passed');
    assert.equal(results[0].status, 'PASS');
    assert.equal(results[0].actualStatus, 200);
    assert.equal(results[0].expectedStatus, 200);
  });

  it('fails an SSRF test if request is not blocked pre-flight and times out over the network', async () => {
    // Normal endpoint (not in metadata blacklist) configured with an SSRF test case that times out
    const suite = await suiteRepo.create({
      endpointId: paymentEndpoint.id,
      name: 'SSRF Timeout Non-Proof Suite',
      tests: [
        {
          id: 'test-ssrf-timeout',
          name: 'SSRF Test Timing Out Over Network',
          type: 'ssrf',
          method: 'POST',
          payload: { event: 'payment.slow', transaction_id: 'txn_ssrf_timeout', amount: 100, delay: 1000 },
          expectedStatus: 403,
          timeoutMs: 300,
          retryCount: 1,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(paymentEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'failed');
    assert.equal(results[0].status, 'FAIL');
    assert.match(
      results[0].error || '',
      /SSRF Protection Failed: Target was not blocked pre-flight\. Request reached network and timed out/i
    );
  });

  it('marks SECURITY FAILURE if an SSRF test target proceeds to network and receives an HTTP response', async () => {
    // A permitted endpoint with an SSRF test case that reaches network and receives response
    const suite = await suiteRepo.create({
      endpointId: paymentEndpoint.id,
      name: 'SSRF Permitted Network Leak Suite',
      tests: [
        {
          id: 'test-ssrf-network-leak',
          name: 'SSRF Request Allowed To Network',
          type: 'ssrf',
          method: 'POST',
          payload: { event: 'payment.success', transaction_id: 'txn_ssrf_leak', amount: 100 },
          expectedStatus: 403,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(paymentEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'failed');
    assert.equal(results[0].status, 'SECURITY FAILURE');
    assert.match(results[0].error || '', /Security Violation: Prohibited destination/i);
    assert.ok(results[0].securityDetails);
    assert.equal(results[0].securityDetails?.severity, 'critical');
  });

  it('records ERROR when a non-SSRF test targets a prohibited metadata URL', async () => {
    const metadataEndpoint = await endpointRepo.create({
      name: 'Cloud Metadata Unintended Target',
      url: 'http://169.254.169.254/latest/meta-data/',
      method: 'POST',
      authentication: 'none',
      headers: {},
      environment: 'local',
    });

    const suite = await suiteRepo.create({
      endpointId: metadataEndpoint.id,
      name: 'Accidental SSRF Target Suite',
      tests: [
        {
          id: 'test-accidental-metadata',
          name: 'Normal test pointed to metadata by mistake',
          type: 'valid',
          expectedStatus: 200,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(metadataEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'failed');
    assert.equal(results[0].status, 'ERROR');
    assert.match(results[0].error || '', /SSRF Protection: Access to cloud instance metadata/i);
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

  it('passes test when an expected timeout occurs within configured SLA threshold', async () => {
    const suite = await suiteRepo.create({
      endpointId: paymentEndpoint.id,
      name: 'Expected Timeout Suite',
      tests: [
        {
          id: 'test-expected-timeout',
          name: 'Timeout SLA Condition',
          type: 'timeout',
          method: 'POST',
          payload: { event: 'payment.slow', transaction_id: 'txn_exp_timeout_01', amount: 2500, delay: 1000 },
          expectedStatus: 408,
          timeoutMs: 500,
          retryCount: 1,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(paymentEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'passed');
    assert.equal(run.passed, 1);
    assert.equal(run.failed, 0);
    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'PASS');
    assert.equal(results[0].expectedStatus, 408);
    assert.equal(results[0].actualStatus, undefined);
    assert.ok(results[0].responseTime >= 450, `Expected response time >= 450ms, got ${results[0].responseTime}ms`);
  });

  it('fails with TIMEOUT when an unexpected timeout occurs in a normal HTTP test', async () => {
    const suite = await suiteRepo.create({
      endpointId: paymentEndpoint.id,
      name: 'Unexpected Timeout Suite',
      tests: [
        {
          id: 'test-unexpected-timeout',
          name: 'Normal Payment Request timing out unexpectedly',
          type: 'valid',
          method: 'POST',
          payload: { event: 'payment.slow', transaction_id: 'txn_unexp_timeout_01', amount: 2500, delay: 1000 },
          expectedStatus: 200,
          timeoutMs: 500,
          retryCount: 1,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(paymentEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'failed');
    assert.equal(run.failed, 1);
    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'TIMEOUT');
    assert.equal(results[0].expectedStatus, 200);
    assert.equal(results[0].actualStatus, undefined);
    assert.match(results[0].error || '', /aborted|timed out/i);
  });

  it('fails when a request expecting timeout completes before its configured timeout', async () => {
    const suite = await suiteRepo.create({
      endpointId: paymentEndpoint.id,
      name: 'Early Completion Failure Suite',
      tests: [
        {
          id: 'test-early-completion',
          name: 'Timeout expected but response completes quickly',
          type: 'timeout',
          method: 'POST',
          payload: { event: 'payment.success', transaction_id: 'txn_fast_01', amount: 1500 },
          expectedStatus: 408,
          timeoutMs: 2000,
          retryCount: 1,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(paymentEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'failed');
    assert.equal(run.failed, 1);
    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'FAIL');
    assert.equal(results[0].actualStatus, 200);
    assert.match(results[0].error || '', /Expected request to time out|received HTTP 200/i);
  });

  it('records retry attempts on unexpected timeout condition', async () => {
    const suite = await suiteRepo.create({
      endpointId: paymentEndpoint.id,
      name: 'Timeout Retries Suite',
      tests: [
        {
          id: 'test-timeout-retries',
          name: 'Normal test with retries timing out',
          type: 'valid',
          method: 'POST',
          payload: { event: 'payment.slow', transaction_id: 'txn_timeout_retry_01', amount: 2000, delay: 900 },
          expectedStatus: 200,
          timeoutMs: 500,
          retryCount: 2,
          retryDelayMs: 50,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(paymentEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'failed');
    assert.equal(results[0].status, 'TIMEOUT');
    assert.equal(results[0].retryCount, 1);
    assert.ok(results[0].attempts && results[0].attempts.length === 2, 'Expected 2 attempts');
    assert.equal(results[0].attempts[0].status, 'TIMEOUT');
    assert.equal(results[0].attempts[1].status, 'TIMEOUT');
    assert.ok(results[0].responseTime >= 1000, `Expected total response time >= 1000ms, got ${results[0].responseTime}ms`);
  });

  // Issue 1 Regression: E2E Gateway Secret Alignment
  it('executes valid payment test successfully against mock payment endpoint with matching secret (HTTP 200)', async () => {
    const e2eGatewayEndpoint = await endpointRepo.create({
      name: 'Automated E2E Test Gateway',
      url: `${baseUrl}/payment`,
      method: 'POST',
      authentication: 'hmac',
      secret: 'whsec_test_98af21d09e023190ab78ff09a1',
      headers: { 'X-Signature-Header': 'X-Signature' },
      environment: 'development',
    });

    const suite = await suiteRepo.create({
      endpointId: e2eGatewayEndpoint.id,
      name: 'E2E Full Verification Suite',
      tests: [
        {
          id: 'e2e-valid',
          name: 'Valid Payment Event',
          type: 'valid',
          method: 'POST',
          payload: { event: 'payment.success', transaction_id: 'txn_e2e_gate_01', amount: 3500 },
          expectedStatus: 200,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(e2eGatewayEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'passed');
    assert.equal(results[0].status, 'PASS');
    assert.equal(results[0].actualStatus, 200);
  });

  it('records FAIL with HTTP 401 when endpoint HMAC secret does not match receiver secret (Issue 1 negative test)', async () => {
    const mismatchedEndpoint = await endpointRepo.create({
      name: 'Mismatched Secret Gateway',
      url: `${baseUrl}/payment`,
      method: 'POST',
      authentication: 'hmac',
      secret: 'whsec_e2e_super_secret', // Deliberate mismatch
      headers: { 'X-Signature-Header': 'X-Signature' },
      environment: 'development',
    });

    const suite = await suiteRepo.create({
      endpointId: mismatchedEndpoint.id,
      name: 'Mismatched Secret Suite',
      tests: [
        {
          id: 'e2e-valid-mismatch',
          name: 'Valid Payment Event with Mismatched Secret',
          type: 'valid',
          method: 'POST',
          payload: { event: 'payment.success', transaction_id: 'txn_mismatch_01', amount: 3500 },
          expectedStatus: 200,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(mismatchedEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'failed');
    assert.equal(results[0].status, 'FAIL');
    assert.equal(results[0].actualStatus, 401);
  });

  // Issue 2 Regression: Inventory Endpoint and Contract Alignment
  it('executes warehouse inventory suite against /inventory with API key authentication', async () => {
    const suite = await suiteRepo.create({
      endpointId: inventoryEndpoint.id,
      name: 'Webhook Reliability & Security Suite',
      tests: [
        {
          id: 'inv-valid',
          name: 'Valid Inventory Replenishment',
          type: 'valid',
          method: 'POST',
          payload: { event: 'inventory.replenish', sku: 'SKU-WH-9821', quantity: 50 },
          expectedStatus: 200,
        },
        {
          id: 'inv-missing-sku',
          name: 'Missing SKU Field',
          type: 'missing_field',
          method: 'POST',
          payload: { event: 'inventory.replenish' },
          expectedStatus: 400,
        },
        {
          id: 'inv-unauthorized',
          name: 'Unauthorized API Key',
          type: 'unauthorized',
          method: 'POST',
          payload: { event: 'inventory.replenish', sku: 'SKU-WH-9821' },
          expectedStatus: 401,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(inventoryEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'passed');
    assert.equal(run.passed, 3);
    assert.equal(run.failed, 0);
    assert.equal(results[0].status, 'PASS');
    assert.equal(results[0].actualStatus, 200);
    assert.equal(results[1].status, 'PASS');
    assert.equal(results[1].actualStatus, 400);
    assert.equal(results[2].status, 'PASS');
    assert.equal(results[2].actualStatus, 401);
  });

  // Issue 3 Regression: Order Sync Timeout and Valid Order Behavior
  it('executes order sync suite with SLA timeout condition and instant order creation', async () => {
    const suite = await suiteRepo.create({
      endpointId: orderEndpoint.id,
      name: 'Order Sync & Transient Failure Recovery Suite',
      tests: [
        {
          id: 'order-valid-1',
          name: 'Valid Order Creation Event',
          type: 'valid',
          method: 'POST',
          payload: {
            event: 'order.created',
            order_id: 'ord_984120',
            transaction_id: 'txn_ord_1',
            amount: 2500,
          },
          expectedStatus: 200,
          timeoutMs: 5000,
          retryCount: 1,
        },
        {
          id: 'order-timeout',
          name: 'Timeout on Database Lock SLA',
          type: 'timeout',
          method: 'POST',
          payload: {
            order_id: 'ord_slow_lock',
            amount: 100,
            transaction_id: 'txn_lock',
          },
          expectedStatus: 408,
          timeoutMs: 500,
          retryCount: 1,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(orderEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'passed');
    assert.equal(run.passed, 2);
    assert.equal(run.failed, 0);

    // Valid order succeeded on attempt 1 without retry
    assert.equal(results[0].status, 'PASS');
    assert.equal(results[0].actualStatus, 200);
    assert.equal(results[0].retryCount, 0);

    // Order timeout satisfied SLA condition
    assert.equal(results[1].status, 'PASS');
    assert.equal(results[1].expectedStatus, 408);
    assert.equal(results[1].actualStatus, undefined);
  });

  // Issue 4 Regression: Payment Webhook Transient 503 Retry Recovery
  it('executes payment retry test recovering after transient 503 responses (HTTP 200, retries=2)', async () => {
    // Reset mock retry counters first
    await fetch(`${baseUrl}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${generateHmacSha256(JSON.stringify({ event: 'payment.success', transaction_id: 'txn_init', amount: 10 }), 'whsec_test_98af21d09e023190ab78ff09a1')}`,
      },
      body: JSON.stringify({ event: 'payment.success', transaction_id: 'txn_init', amount: 10 }),
    });

    const suite = await suiteRepo.create({
      endpointId: paymentEndpoint.id,
      name: 'Payment Retry Recovery Suite',
      tests: [
        {
          id: 'test-retry-behavior',
          name: 'Retry on Transient 503',
          type: 'retry',
          method: 'POST',
          payload: {
            event: 'payment.retry',
            transaction_id: 'txn_retry_payment_suite_101',
            amount: 2500,
          },
          expectedStatus: 200,
          timeoutMs: 5000,
          retryCount: 3,
          retryDelayMs: 50,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(paymentEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'passed');
    assert.equal(run.passed, 1);
    assert.equal(run.failed, 0);
    assert.equal(results[0].status, 'PASS');
    assert.equal(results[0].actualStatus, 200);
    assert.equal(results[0].retryCount, 2);
    assert.ok(results[0].attempts && results[0].attempts.length === 3);
    assert.equal(results[0].attempts[0].statusCode, 503);
    assert.equal(results[0].attempts[1].statusCode, 503);
    assert.equal(results[0].attempts[2].statusCode, 200);
  });

  // Webhook Reliability & Security Suite 429 Root Cause Regression Tests
  it('executes all 6 scenarios in the Webhook Reliability & Security Suite against mock receiver with expected 200, 400, 401, 408 outcomes', async () => {
    const testingEndpoint = await endpointRepo.create({
      name: 'Testing Webhook Gateway',
      url: `${baseUrl}/payment`,
      method: 'POST',
      authentication: 'hmac',
      secret: 'whsec_test_98af21d09e023190ab78ff09a1',
      headers: { 'X-Signature-Header': 'X-Signature' },
      environment: 'development',
    });

    const suite = await suiteRepo.create({
      endpointId: testingEndpoint.id,
      name: 'Webhook Reliability & Security Suite',
      tests: [
        {
          id: 'test-1',
          name: 'Valid Payload Acceptance',
          type: 'valid',
          method: 'POST',
          expectedStatus: 200,
          payload: { event: 'payment.success', transaction_id: 'txn_auto_001', amount: 1500 },
          timeoutMs: 5000,
          retryCount: 1,
        },
        {
          id: 'test-2',
          name: 'Missing Transaction ID',
          type: 'missing_field',
          method: 'POST',
          expectedStatus: 400,
          payload: { event: 'payment.success', amount: 1500 },
          timeoutMs: 5000,
          retryCount: 1,
        },
        {
          id: 'test-3',
          name: 'Invalid HMAC Signature Audit',
          type: 'invalid_hmac',
          method: 'POST',
          expectedStatus: 401,
          payload: { event: 'payment.success', transaction_id: 'txn_forged_999' },
          timeoutMs: 5000,
          retryCount: 1,
        },
        {
          id: 'test-4',
          name: 'Timeout SLA Condition',
          type: 'timeout',
          method: 'POST',
          expectedStatus: 408,
          payload: { event: 'payment.slow', transaction_id: 'txn_sla_timeout_001', amount: 2500, delay: 600 },
          timeoutMs: 500,
          retryCount: 1,
        },
        {
          id: 'test-missing-field',
          name: 'Test: MISSING FIELD',
          type: 'missing_field',
          method: 'POST',
          expectedStatus: 400,
          payload: { event: 'incomplete' },
          timeoutMs: 5000,
          retryCount: 1,
        },
        {
          id: 'test-malformed-json',
          name: 'Test: MALFORMED JSON',
          type: 'malformed_json',
          method: 'POST',
          expectedStatus: 400,
          payload: '{invalid_json_body',
          timeoutMs: 5000,
          retryCount: 1,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(testingEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'passed');
    assert.equal(run.totalTests, 6);
    assert.equal(run.passed, 6);
    assert.equal(run.failed, 0);

    // Scenario 1: Valid payment -> 200 PASS
    assert.equal(results[0].status, 'PASS');
    assert.equal(results[0].actualStatus, 200);

    // Scenario 2: Missing transaction_id -> 400 PASS
    assert.equal(results[1].status, 'PASS');
    assert.equal(results[1].actualStatus, 400);

    // Scenario 3: Invalid HMAC signature -> 401 PASS
    assert.equal(results[2].status, 'PASS');
    assert.equal(results[2].actualStatus, 401);

    // Scenario 4: Timeout SLA condition -> 408 PASS
    assert.equal(results[3].status, 'PASS');
    assert.equal(results[3].expectedStatus, 408);
    assert.equal(results[3].actualStatus, undefined);

    // Scenario 5: Missing required field -> 400 PASS
    assert.equal(results[4].status, 'PASS');
    assert.equal(results[4].actualStatus, 400);

    // Scenario 6: Malformed JSON body -> 400 PASS
    assert.equal(results[5].status, 'PASS');
    assert.equal(results[5].actualStatus, 400);
  });

  it('records FAIL with HTTP 429 when target endpoint is throttled by upstream service (429 detection regression test)', async () => {
    const throttledEndpoint = await endpointRepo.create({
      name: 'Throttled External Endpoint',
      url: `${baseUrl}/throttled`,
      method: 'POST',
      authentication: 'none',
      environment: 'development',
    });

    const suite = await suiteRepo.create({
      endpointId: throttledEndpoint.id,
      name: 'Throttled Suite',
      tests: [
        {
          id: 'test-throttled-scenario',
          name: 'Request to rate-limited external service',
          type: 'valid',
          method: 'POST',
          expectedStatus: 200, // Expected 200 but upstream replies 429
          payload: { event: 'test.event' },
          timeoutMs: 5000,
          retryCount: 1,
        },
      ],
    });

    const { run, results } = await runner.executeSuite(throttledEndpoint.id, suite.id, 'manual');

    assert.equal(run.status, 'failed');
    assert.equal(results[0].status, 'FAIL');
    assert.equal(results[0].actualStatus, 429);
    assert.equal(results[0].expectedStatus, 200);
  });
});
