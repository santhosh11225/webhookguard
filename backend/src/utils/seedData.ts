import { IEndpointRepository } from '../repositories/interfaces/IEndpointRepository.js';
import { ITestSuiteRepository } from '../repositories/interfaces/ITestSuiteRepository.js';
import { ITestRunRepository } from '../repositories/interfaces/ITestRunRepository.js';
import { ITestResultRepository } from '../repositories/interfaces/ITestResultRepository.js';
import { getDefaultPaymentTests } from './payloadTemplates.js';

export async function seedDatabase(
  endpointRepo: IEndpointRepository,
  suiteRepo: ITestSuiteRepository,
  runRepo: ITestRunRepository,
  resultRepo: ITestResultRepository,
  port = 4000
): Promise<void> {
  const count = await endpointRepo.count();
  const apiGateway = process.env.API_GATEWAY_URL || (process.env.AWS_LAMBDA_FUNCTION_NAME ? 'https://sqh1tjb8oj.execute-api.ap-south-2.amazonaws.com' : '');
  const baseUrl = apiGateway ? `${apiGateway}/api/mock-webhooks` : `http://localhost:${port}/api/mock-webhooks`;

  if (count > 0) {
    const existing = await endpointRepo.findAll();

    // 1. Clean up duplicate test endpoints created by past unisolated test runs
    const testEndpoints = existing.filter((e) => e.name === 'Test Secure Payment Endpoint');
    if (testEndpoints.length > 1) {
      for (let i = 1; i < testEndpoints.length; i++) {
        await endpointRepo.delete(testEndpoints[i].id);
      }
    }

    const testVulnEndpoints = existing.filter((e) => e.name === 'Test Vulnerable Payment Endpoint');
    if (testVulnEndpoints.length > 1) {
      for (let i = 1; i < testVulnEndpoints.length; i++) {
        await endpointRepo.delete(testVulnEndpoints[i].id);
      }
    }

    const qgEndpoints = existing.filter((e) => e.name === 'Quality Gate Target');
    if (qgEndpoints.length > 1) {
      for (let i = 1; i < qgEndpoints.length; i++) {
        await endpointRepo.delete(qgEndpoints[i].id);
      }
    }

    const ssrfEndpoints = existing.filter((e) => e.name === 'Malicious Cloud Metadata Target');
    if (ssrfEndpoints.length > 1) {
      for (let i = 1; i < ssrfEndpoints.length; i++) {
        await endpointRepo.delete(ssrfEndpoints[i].id);
      }
    }

    // 2. Heal remaining endpoints: synchronize any local ports/URLs to active server base URL
    const activeEndpoints = await endpointRepo.findAll();
    for (const ep of activeEndpoints) {
      let updatedUrl = ep.url;
      if (/http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(ep.url)) {
        if (ep.url.includes('/orders')) {
          updatedUrl = `${baseUrl}/orders`;
        } else if (ep.url.includes('/payment')) {
          const isVulnerable = ep.url.includes('vulnerable=true');
          updatedUrl = `${baseUrl}/payment${isVulnerable ? '?vulnerable=true' : ''}`;
        } else {
          updatedUrl = ep.url.replace(/http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, `http://localhost:${port}`);
        }
      }
      if (updatedUrl !== ep.url) {
        console.log(`[Seed] Healed endpoint "${ep.name}" (${ep.id}): ${ep.url} -> ${updatedUrl}`);
        await endpointRepo.update(ep.id, { url: updatedUrl });
      }
    }

    console.log('[Seed] Database verified and endpoints synchronized with active base URL:', baseUrl);
    return;
  }

  // 1. Payment Webhook Endpoint
  const paymentEndpoint = await endpointRepo.create({
    name: 'Stripe / Adyen Payment Webhook',
    url: `${baseUrl}/payment`,
    method: 'POST',
    authentication: 'hmac',
    secret: 'whsec_test_98af21d09e023190ab78ff09a1',
    headers: {
      'X-Signature-Header': 'X-Signature',
      'X-Partner-ID': 'part_global_pay_01',
    },
    environment: 'production',
  });

  // 2. Vulnerable Payment Endpoint (simulating unverified signature for security alerts)
  const vulnerableEndpoint = await endpointRepo.create({
    name: 'Legacy Checkout Webhook (Vulnerable Target)',
    url: `${baseUrl}/payment?vulnerable=true`,
    method: 'POST',
    authentication: 'hmac',
    secret: 'whsec_legacy_key_xyz',
    headers: {
      'X-Signature-Header': 'X-Signature',
    },
    environment: 'staging',
  });

  // 3. Order Processing Webhook (with retry simulation)
  const orderEndpoint = await endpointRepo.create({
    name: 'E-Commerce Order Sync Webhook',
    url: `${baseUrl}/orders`,
    method: 'POST',
    authentication: 'bearer',
    secret: 'tok_live_ord_8492048109',
    headers: {
      'X-Source-Service': 'order-fulfillment-engine',
    },
    environment: 'staging',
  });

  // 4. Inventory Webhook
  const inventoryEndpoint = await endpointRepo.create({
    name: 'Warehouse Inventory Replenishment',
    url: `${baseUrl}/payment`,
    method: 'POST',
    authentication: 'api_key',
    secret: 'ak_sec_wh_789123400',
    headers: {
      'X-Warehouse-Zone': 'us-east-1a',
    },
    environment: 'development',
  });

  // Create Test Suites
  const paymentTests = getDefaultPaymentTests();

  const paymentSuite = await suiteRepo.create({
    endpointId: paymentEndpoint.id,
    name: 'Core Payment Reliability & Security Suite',
    description: 'Comprehensive test suite verifying payloads, HMAC signatures, missing fields, timeouts, and retries.',
    tests: paymentTests,
  });

  const vulnerableSuite = await suiteRepo.create({
    endpointId: vulnerableEndpoint.id,
    name: 'Security Vulnerability Audit Suite',
    description: 'Specialized suite to test whether invalid HMAC signatures and forged requests are properly blocked.',
    tests: paymentTests.filter((t) => t.type === 'invalid_hmac' || t.type === 'valid'),
  });

  const orderSuite = await suiteRepo.create({
    endpointId: orderEndpoint.id,
    name: 'Order Sync & Transient Failure Recovery Suite',
    description: 'Validates retry behavior against intermittent HTTP 503 service unavailable states.',
    tests: [
      {
        id: 'order-valid-1',
        name: 'Valid Order Creation Event',
        type: 'valid',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        id: 'order-retry-503',
        name: 'Retry on Transient 503 Outage',
        type: 'retry',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          order_id: 'ord_retry_recovering_99',
          event: 'order.retry',
          amount: 5000,
          transaction_id: 'txn_retry_101',
        },
        expectedStatus: 200,
        timeoutMs: 5000,
        retryCount: 3,
        retryDelayMs: 300,
      },
      {
        id: 'order-timeout',
        name: 'Timeout on Database Lock SLA',
        type: 'timeout',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          order_id: 'ord_slow_lock',
          amount: 100,
          transaction_id: 'txn_lock',
        },
        expectedStatus: 200,
        timeoutMs: 1500,
        retryCount: 1,
      },
    ],
  });

  // Seed Historical Test Runs & Results for Dashboard realism
  const now = Date.now();

  // Run 1: Payment Webhook (24 tests total simulated in history, passed with 1 timeout)
  const run1 = await runRepo.create({
    endpointId: paymentEndpoint.id,
    suiteId: paymentSuite.id,
    status: 'passed',
    totalTests: 10,
    passed: 10,
    failed: 0,
    startedAt: new Date(now - 3600000 * 4).toISOString(),
    completedAt: new Date(now - 3600000 * 4 + 1840).toISOString(),
    durationMs: 1840,
    trigger: 'manual',
    environment: 'production',
  });

  // Seed Results for Run 1
  for (const test of paymentTests) {
    await resultRepo.create({
      runId: run1.id,
      testId: test.id,
      testName: test.name,
      testType: test.type,
      status: 'PASS',
      expectedStatus: test.expectedStatus,
      actualStatus: test.expectedStatus,
      responseTime: Math.floor(Math.random() * 80) + 95,
      request: {
        url: paymentEndpoint.url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Signature': '••••••••' },
        body: test.payload,
      },
      response: {
        status: test.expectedStatus,
        statusText: test.expectedStatus === 200 ? 'OK' : 'Bad Request / Unauthorized',
        headers: { 'content-type': 'application/json' },
        body: { success: true, verified: true },
      },
      retryCount: 0,
      timestamp: new Date(now - 3600000 * 4 + 150).toISOString(),
    });
  }

  // Run 2: Vulnerable Endpoint Run with SECURITY FAILURE
  const run2 = await runRepo.create({
    endpointId: vulnerableEndpoint.id,
    suiteId: vulnerableSuite.id,
    status: 'failed',
    totalTests: 2,
    passed: 1,
    failed: 1,
    startedAt: new Date(now - 3600000 * 2).toISOString(),
    completedAt: new Date(now - 3600000 * 2 + 520).toISOString(),
    durationMs: 520,
    trigger: 'cicd',
    environment: 'staging',
  });

  await resultRepo.create({
    runId: run2.id,
    testId: 'test-valid-payload',
    testName: 'Valid Payment Payload',
    testType: 'valid',
    status: 'PASS',
    expectedStatus: 200,
    actualStatus: 200,
    responseTime: 112,
    request: {
      url: vulnerableEndpoint.url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { event: 'payment.success', transaction_id: 'txn_999', amount: 1000 },
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: { success: true },
    },
    retryCount: 0,
    timestamp: new Date(now - 3600000 * 2 + 100).toISOString(),
  });

  await resultRepo.create({
    runId: run2.id,
    testId: 'test-invalid-hmac',
    testName: 'Invalid HMAC Signature Security Check',
    testType: 'invalid_hmac',
    status: 'SECURITY FAILURE',
    expectedStatus: 401,
    actualStatus: 200,
    responseTime: 145,
    error: 'Security Failure: Invalidly signed webhook was accepted with HTTP 200 OK',
    request: {
      url: vulnerableEndpoint.url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': 'sha256=invalid_signature_deadbeef00000000',
      },
      body: {
        event: 'payment.success',
        transaction_id: 'txn_tampered_attack_vector',
        amount: 999999,
      },
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: {
        success: true,
        warning: 'VULNERABILITY DETECTED: Endpoint accepted unverified payload!',
      },
    },
    retryCount: 0,
    securityDetails: {
      issue: 'Invalid HMAC signature was accepted by the endpoint.',
      severity: 'critical',
      expectedBehavior: 'Endpoint must reject invalidly signed webhooks with HTTP 401 Unauthorized.',
      observedBehavior: 'Endpoint accepted forged/tampered payload with HTTP 200 OK.',
      remediation:
        'Verify request signature using the shared HMAC secret before parsing or processing the body. Return HTTP 401 Unauthorized immediately if the signature does not match.',
    },
    timestamp: new Date(now - 3600000 * 2 + 250).toISOString(),
  });

  // Run 3: Order Sync with Retry recovery
  const run3 = await runRepo.create({
    endpointId: orderEndpoint.id,
    suiteId: orderSuite.id,
    status: 'passed',
    totalTests: 3,
    passed: 2,
    failed: 1,
    startedAt: new Date(now - 3600000 * 1).toISOString(),
    completedAt: new Date(now - 3600000 * 1 + 2100).toISOString(),
    durationMs: 2100,
    trigger: 'api',
    environment: 'staging',
  });

  await resultRepo.create({
    runId: run3.id,
    testId: 'order-retry-503',
    testName: 'Retry on Transient 503 Outage',
    testType: 'retry',
    status: 'PASS',
    expectedStatus: 200,
    actualStatus: 200,
    responseTime: 890,
    request: {
      url: orderEndpoint.url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: '••••••••' },
      body: { order_id: 'ord_retry_recovering_99', amount: 5000 },
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: { success: true, message: 'Order webhook processed successfully after retry recovery' },
    },
    retryCount: 2,
    attempts: [
      {
        attemptNumber: 1,
        status: 'FAIL',
        statusCode: 503,
        responseTimeMs: 310,
        timestamp: new Date(now - 3600000 * 1).toISOString(),
      },
      {
        attemptNumber: 2,
        status: 'FAIL',
        statusCode: 503,
        responseTimeMs: 290,
        timestamp: new Date(now - 3600000 * 1 + 350).toISOString(),
      },
      {
        attemptNumber: 3,
        status: 'PASS',
        statusCode: 200,
        responseTimeMs: 290,
        timestamp: new Date(now - 3600000 * 1 + 700).toISOString(),
      },
    ],
    timestamp: new Date(now - 3600000 * 1 + 750).toISOString(),
  });

  console.log('[Seed] Realistic demo data successfully populated!');
}
