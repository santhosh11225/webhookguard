import { performance } from 'node:perf_hooks';
import { IEndpointRepository } from '../repositories/interfaces/IEndpointRepository.js';
import { ITestSuiteRepository } from '../repositories/interfaces/ITestSuiteRepository.js';
import { ITestRunRepository } from '../interfaces/../repositories/interfaces/ITestRunRepository.js';
import { ITestResultRepository } from '../interfaces/../repositories/interfaces/ITestResultRepository.js';
import {
  TestRun,
  TestResult,
  TestCase,
  TestAttempt,
  Endpoint,
  TestResultStatus,
  SecurityFailureDetail,
} from '../models/types.js';
import { generateHmacSha256 } from '../utils/hmac.js';
import { SqliteEndpointRepository } from '../repositories/sqlite/endpoint.repository.js';
import {
  SsrfBlockedError,
  validateTargetUrl,
  type SsrfValidationOptions,
} from '../utils/ssrfValidator.js';

export { SsrfBlockedError, type SsrfValidationOptions };

export class TestRunnerService {
  private options: SsrfValidationOptions;

  constructor(
    private endpointRepo: IEndpointRepository,
    private suiteRepo: ITestSuiteRepository,
    private runRepo: ITestRunRepository,
    private resultRepo: ITestResultRepository,
    options?: SsrfValidationOptions
  ) {
    this.options = {
      allowLocalNetworks:
        options?.allowLocalNetworks ??
        (process.env.ALLOW_LOCAL_NETWORKS === 'true' ||
          (process.env.NODE_ENV !== 'production' && !process.env.AWS_LAMBDA_FUNCTION_NAME)),
    };
  }

  /**
   * Execute a test suite against an endpoint with real HTTP requests
   */
  async executeSuite(
    endpointId: string,
    suiteId: string,
    trigger: 'manual' | 'api' | 'cicd' = 'manual'
  ): Promise<{ run: TestRun; results: TestResult[] }> {
    // 1. Fetch endpoint (with secret for signing) and suite
    let endpoint: Endpoint | null = null;
    if (typeof (this.endpointRepo as any).findByIdWithSecret === 'function') {
      endpoint = await (this.endpointRepo as any).findByIdWithSecret(endpointId);
    } else {
      endpoint = await this.endpointRepo.findById(endpointId);
    }

    if (!endpoint) {
      throw new Error(`Endpoint not found: ${endpointId}`);
    }

    const suite = await this.suiteRepo.findById(suiteId);
    if (!suite) {
      throw new Error(`Test Suite not found: ${suiteId}`);
    }

    const startedAt = new Date().toISOString();
    const startTime = performance.now();

    // 2. Create initial TestRun record with 'running' status
    const run = await this.runRepo.create({
      endpointId,
      suiteId,
      status: 'running',
      totalTests: suite.tests.length,
      passed: 0,
      failed: 0,
      startedAt,
      trigger,
      environment: endpoint.environment,
    });

    const results: TestResult[] = [];
    let passedCount = 0;
    let failedCount = 0;

    // 3. Execute each test case sequentially
    for (const testCase of suite.tests) {
      try {
        const result = await this.executeSingleTest(run.id, endpoint, testCase);
        results.push(result);

        if (result.status === 'PASS') {
          passedCount++;
        } else {
          failedCount++;
        }
      } catch (err: any) {
        failedCount++;
        const errorResult = await this.resultRepo.create({
          runId: run.id,
          testId: testCase.id,
          testName: testCase.name,
          testType: testCase.type,
          status: 'ERROR',
          expectedStatus: testCase.expectedStatus,
          responseTime: 0,
          error: err.message || 'Execution failed unexpectedly',
          request: {
            url: endpoint.url,
            method: testCase.method || endpoint.method || 'POST',
            headers: {},
          },
          retryCount: 0,
          timestamp: new Date().toISOString(),
        });
        results.push(errorResult);
      }
    }

    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);
    const completedAt = new Date().toISOString();
    const finalStatus = failedCount === 0 ? 'passed' : 'failed';

    // 4. Update the TestRun record
    const updatedRun = await this.runRepo.update(run.id, {
      status: finalStatus,
      passed: passedCount,
      failed: failedCount,
      durationMs,
      completedAt,
    });

    return {
      run: updatedRun || run,
      results,
    };
  }

  /**
   * Execute an individual test with retry tracking, timeouts, and auth headers
   */
  private async executeSingleTest(
    runId: string,
    endpoint: Endpoint,
    test: TestCase
  ): Promise<TestResult> {
    const targetUrl = test.url || endpoint.url;
    const method = test.method || endpoint.method || 'POST';
    const maxAttempts = Math.max(1, test.retryCount || 1);
    const retryDelay = test.retryDelayMs || 500;
    const timeoutMs = test.timeoutMs || 5000;

    const attempts: TestAttempt[] = [];
    let lastResponse: any = null;
    let lastError: string | undefined = undefined;
    let finalStatus: TestResultStatus = 'FAIL';
    let totalElapsed = 0;
    let securityDetails: SecurityFailureDetail | undefined = undefined;

    const expectsTimeout = test.type === 'timeout' || test.expectedStatus === 408;
    const expectsSsrfBlock =
      test.type === 'ssrf' ||
      test.id === 'test-ssrf' ||
      (test.name?.toLowerCase().includes('ssrf') && test.expectedStatus === 403);

    // Prepare Request headers and payload
    const { headers, bodyString } = this.prepareRequestData(endpoint, test);

    for (let attemptNum = 1; attemptNum <= maxAttempts; attemptNum++) {
      const attemptStart = performance.now();
      const attemptTimestamp = new Date().toISOString();

      try {
        const responseData = await this.sendHttpRequest(
          targetUrl,
          method,
          headers,
          bodyString,
          timeoutMs
        );

        const attemptDuration = Math.round(performance.now() - attemptStart);
        totalElapsed += attemptDuration;
        lastResponse = responseData;

        // Status determination
        if (expectsSsrfBlock) {
          // Expected SSRF pre-flight block, but request proceeded to network and received a response!
          finalStatus = 'SECURITY FAILURE';
          lastError = `Security Violation: Prohibited destination (${targetUrl}) was accessed over the network instead of being blocked pre-flight. Received HTTP ${responseData.status}.`;
          securityDetails = {
            issue: 'SSRF protection failed: Request to restricted cloud metadata endpoint was permitted.',
            severity: 'critical',
            expectedBehavior: 'Requests to cloud instance metadata (169.254.169.254) must be blocked pre-flight before opening any network connection.',
            observedBehavior: `Request proceeded to network and received HTTP ${responseData.status} from ${targetUrl}.`,
            remediation:
              'Ensure URL validation occurs before socket creation and strictly blocks link-local / cloud metadata IP addresses.',
          };
        } else if (expectsTimeout) {
          // Expected a timeout, but endpoint returned an HTTP response
          finalStatus = 'FAIL';
          lastError = `Expected request to time out after ${timeoutMs}ms, but received HTTP ${responseData.status} in ${attemptDuration}ms`;
        } else if (test.type === 'invalid_hmac' && responseData.status === 200) {
          finalStatus = 'SECURITY FAILURE';
          securityDetails = {
            issue: 'Invalid HMAC signature was accepted by the endpoint.',
            severity: 'critical',
            expectedBehavior: `Endpoint must reject invalidly signed webhooks with HTTP ${test.expectedStatus}.`,
            observedBehavior: `Endpoint accepted forged/tampered payload with HTTP ${responseData.status} OK.`,
            remediation:
              'Verify request signature using the shared HMAC secret before parsing or processing the body. Return HTTP 401 Unauthorized immediately if the signature does not match.',
          };
        } else if (test.type === 'missing_auth' && responseData.status === 200) {
          finalStatus = 'SECURITY FAILURE';
          securityDetails = {
            issue: 'Unauthenticated webhook request was accepted.',
            severity: 'high',
            expectedBehavior: `Endpoint must require authentication and reject unauthenticated requests with HTTP ${test.expectedStatus}.`,
            observedBehavior: `Endpoint processed unauthenticated request with HTTP ${responseData.status} OK.`,
            remediation: 'Enforce authentication header checks prior to processing webhook payloads.',
          };
        } else if (responseData.status === test.expectedStatus) {
          finalStatus = 'PASS';
        } else {
          finalStatus = 'FAIL';
        }

        attempts.push({
          attemptNumber: attemptNum,
          status: finalStatus,
          statusCode: responseData.status,
          responseTimeMs: attemptDuration,
          timestamp: attemptTimestamp,
          error: lastError,
        });

        // If it succeeded or is a critical security vulnerability, do not retry further
        if (finalStatus === 'PASS' || finalStatus === 'SECURITY FAILURE') {
          break;
        }

        // Distinguish transient server/network failures from permanent client validation failures
        // Only retry on transient conditions (502, 503, 504, 429) or when test is explicitly configured for retry testing
        const isTransientStatus = [429, 502, 503, 504].includes(responseData.status);
        const shouldRetry = test.type === 'retry' || isTransientStatus;
        if (!shouldRetry) {
          break; // Stop immediately on deterministic client errors (e.g. 400, 401, 404)
        }
      } catch (err: any) {
        const attemptDuration = Math.round(performance.now() - attemptStart);
        totalElapsed += attemptDuration;
        const isTimeout =
          err.name === 'AbortError' ||
          err.name === 'TimeoutError' ||
          err.code === 'ETIMEDOUT' ||
          err.message?.includes('timed out') ||
          err.message?.includes('aborted');

        const isSsrfBlock =
          err instanceof SsrfBlockedError ||
          err.name === 'SsrfBlockedError' ||
          err.isSsrfBlocked === true ||
          (typeof err.message === 'string' && err.message.startsWith('SSRF Protection:'));

        lastError = err.message || 'Request failed';

        if (isSsrfBlock) {
          if (expectsSsrfBlock) {
            // Prohibited cloud metadata destination demonstrably blocked before network access -> PASS
            finalStatus = 'PASS';
            totalElapsed = 0;
            attempts.push({
              attemptNumber: attemptNum,
              status: 'PASS',
              responseTimeMs: 0,
              timestamp: attemptTimestamp,
              error: lastError,
            });
            break; // Pre-flight SSRF block verified, do not retry
          } else {
            // Unexpected SSRF block in a non-SSRF test
            finalStatus = 'ERROR';
            attempts.push({
              attemptNumber: attemptNum,
              status: 'ERROR',
              responseTimeMs: attemptDuration,
              error: lastError,
              timestamp: attemptTimestamp,
            });
            break; // Security block is permanent, do not retry
          }
        } else if (expectsSsrfBlock) {
          // Expected SSRF pre-flight block, but request was NOT blocked pre-flight.
          // It either timed out or produced a network error, meaning connection was attempted!
          finalStatus = 'FAIL';
          lastError = isTimeout
            ? `SSRF Protection Failed: Target was not blocked pre-flight. Request reached network and timed out after ${attemptDuration}ms.`
            : `SSRF Protection Failed: Target was not blocked pre-flight. Request attempted network connection: ${lastError}`;
          attempts.push({
            attemptNumber: attemptNum,
            status: 'FAIL',
            responseTimeMs: attemptDuration,
            error: lastError,
            timestamp: attemptTimestamp,
          });
          break; // Stop immediately
        } else if (isTimeout && expectsTimeout) {
          // Expected timeout occurred within intended SLA threshold -> PASS
          finalStatus = 'PASS';
          attempts.push({
            attemptNumber: attemptNum,
            status: 'PASS',
            responseTimeMs: attemptDuration,
            timestamp: attemptTimestamp,
          });
          break; // Expected condition satisfied, do not retry
        } else if (isTimeout) {
          // Unexpected timeout in a normal HTTP test -> TIMEOUT failure
          finalStatus = 'TIMEOUT';
          attempts.push({
            attemptNumber: attemptNum,
            status: 'TIMEOUT',
            responseTimeMs: attemptDuration,
            error: lastError,
            timestamp: attemptTimestamp,
          });
        } else {
          finalStatus = 'ERROR';
          attempts.push({
            attemptNumber: attemptNum,
            status: 'ERROR',
            responseTimeMs: attemptDuration,
            error: lastError,
            timestamp: attemptTimestamp,
          });
        }
      }

      // Wait before next attempt if more attempts remain
      if (attemptNum < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    // Mask secret in stored request headers for privacy
    const safeHeaders: Record<string, string> = { ...headers };
    for (const key of Object.keys(safeHeaders)) {
      const lower = key.toLowerCase();
      if (lower.includes('secret') || lower.includes('auth') || lower.includes('key') || lower.includes('token')) {
        if (!key.startsWith('X-Signature')) {
          safeHeaders[key] = '••••••••';
        }
      }
    }

    // Store granular test result
    return await this.resultRepo.create({
      runId,
      testId: test.id,
      testName: test.name,
      testType: test.type,
      status: finalStatus,
      expectedStatus: test.expectedStatus,
      actualStatus: lastResponse?.status,
      responseTime: totalElapsed,
      error: lastError,
      request: {
        url: targetUrl,
        method,
        headers: safeHeaders,
        body: test.payload,
      },
      response: lastResponse
        ? {
            status: lastResponse.status,
            statusText: lastResponse.statusText,
            headers: lastResponse.headers,
            body: lastResponse.body,
          }
        : undefined,
      retryCount: attempts.length > 1 ? attempts.length - 1 : 0,
      attempts: attempts.length > 1 ? attempts : undefined,
      securityDetails,
      timestamp: new Date().toISOString(),
    });
  }


  /**
   * Helper to serialize payload and attach authentication headers
   */
  private prepareRequestData(
    endpoint: Endpoint,
    test: TestCase
  ): { headers: Record<string, string>; bodyString: string | undefined } {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'WebhookGuard-TestEngine/1.0',
      ...(endpoint.headers || {}),
      ...(test.headers || {}),
    };

    let bodyString: string | undefined = undefined;

    if (test.payload !== undefined && test.payload !== null) {
      if (typeof test.payload === 'string') {
        bodyString = test.payload;
      } else {
        bodyString = JSON.stringify(test.payload);
      }
    }

    // Handle Authentication
    if (test.type === 'missing_auth') {
      // Intentionally omit all authentication headers
      delete headers['Authorization'];
      delete headers['X-Signature'];
      delete headers['X-Hub-Signature-256'];
      delete headers['Signature'];
      delete headers['X-API-Key'];
    } else if (endpoint.authentication === 'hmac') {
      const secret = endpoint.secret || 'default-webhook-secret';
      const sigHeader = endpoint.headers?.['X-Signature-Header'] || 'X-Signature';

      if (test.type === 'invalid_hmac') {
        // Compute genuine HMAC-SHA256 signature using an incorrect key
        // Generates a realistic 64-char hex digest that fails verification without artificial keywords
        const forgedSecret = `${secret}_unauthorized_tampered_key`;
        const forgedSignature = generateHmacSha256(bodyString !== undefined ? bodyString : '', forgedSecret);
        headers[sigHeader] = `sha256=${forgedSignature}`;
      } else if (test.headers && sigHeader in test.headers) {
        // User explicitly configured custom signature header in test case
        headers[sigHeader] = test.headers[sigHeader];
      } else if (bodyString !== undefined) {
        const signature = generateHmacSha256(bodyString, secret);
        headers[sigHeader] = `sha256=${signature}`;
      }
    } else if (endpoint.authentication === 'bearer') {
      const token = endpoint.secret || 'token_sample';
      if (test.type === 'unauthorized') {
        headers['Authorization'] = 'Bearer invalid_tampered_token_xyz';
      } else if (test.headers && 'Authorization' in test.headers) {
        headers['Authorization'] = test.headers['Authorization'];
      } else {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } else if (endpoint.authentication === 'api_key') {
      const apiKey = endpoint.secret || 'key_sample';
      if (test.type === 'unauthorized') {
        headers['X-API-Key'] = 'invalid_api_key_xyz';
      } else if (test.headers && 'X-API-Key' in test.headers) {
        headers['X-API-Key'] = test.headers['X-API-Key'];
      } else {
        headers['X-API-Key'] = apiKey;
      }
    }

    return { headers, bodyString };
  }

  /**
   * Perform actual HTTP request with pre-flight SSRF validation and manual redirect protection
   */
  private async sendHttpRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string | undefined,
    timeoutMs: number
  ): Promise<{ status: number; statusText: string; headers: Record<string, string>; body: any }> {
    // Stage 1 & 2: Pre-flight validation (URL format, IP literal check, and DNS resolution check)
    await validateTargetUrl(url, this.options);

    // Limit maximum timeout to reasonable bounds (max 30 seconds)
    const effectiveTimeoutMs = Math.min(Math.max(timeoutMs, 500), 30000);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, effectiveTimeoutMs);

    try {
      let currentUrl = url;
      let currentMethod = method;
      let currentBody = body;
      let redirectCount = 0;
      const maxRedirects = 5;

      while (true) {
        // Validate URL before every network hop (covers initial request AND redirects)
        await validateTargetUrl(currentUrl, this.options);

        const options: RequestInit = {
          method: currentMethod,
          headers,
          signal: controller.signal,
          redirect: 'manual', // Strictly intercept redirects to prevent automatic outbound requests to blocked targets
        };

        if (currentBody !== undefined && currentMethod !== 'GET' && currentMethod !== 'HEAD') {
          options.body = currentBody;
        }

        const res = await fetch(currentUrl, options);

        // Check if response is an HTTP redirect
        const isRedirect = [301, 302, 303, 307, 308].includes(res.status);
        if (isRedirect) {
          const location = res.headers.get('location');
          if (!location) {
            return await this.buildResponseObject(res);
          }

          if (redirectCount >= maxRedirects) {
            throw new Error(`Maximum redirect limit (${maxRedirects}) exceeded`);
          }
          redirectCount++;

          const nextUrl = new URL(location, currentUrl).href;

          // Strictly validate redirect target pre-flight BEFORE making any network call
          await validateTargetUrl(nextUrl, this.options);

          currentUrl = nextUrl;
          if (res.status === 303 || ((res.status === 301 || res.status === 302) && currentMethod === 'POST')) {
            currentMethod = 'GET';
            currentBody = undefined;
          }
          continue;
        }

        return await this.buildResponseObject(res);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async buildResponseObject(res: Response): Promise<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
  }> {
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    let parsedBody: any = null;
    const text = await res.text();
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = text.slice(0, 1000); // Truncate non-json safely
    }

    return {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      body: parsedBody,
    };
  }
}
