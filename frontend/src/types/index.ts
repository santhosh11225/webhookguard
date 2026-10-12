export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type AuthType = 'none' | 'hmac' | 'api_key' | 'bearer';

export type Environment = 'production' | 'staging' | 'development' | 'local';

export type TestResultStatus = 'PASS' | 'FAIL' | 'ERROR' | 'TIMEOUT' | 'SECURITY FAILURE';

export type TestRunStatus = 'running' | 'passed' | 'failed' | 'error';

export type TestCaseType =
  | 'valid'
  | 'malformed_json'
  | 'missing_field'
  | 'empty_payload'
  | 'invalid_data_type'
  | 'invalid_hmac'
  | 'missing_auth'
  | 'unauthorized'
  | 'timeout'
  | 'retry'
  | 'ssrf'
  | 'custom';

export interface Endpoint {
  id: string;
  name: string;
  url: string;
  method: HttpMethod;
  authentication: AuthType;
  secret?: string;
  headers: Record<string, string>;
  environment: Environment;
  createdAt: string;
  updatedAt: string;
}

export interface EndpointCreateInput {
  name: string;
  url: string;
  method?: HttpMethod;
  authentication?: AuthType;
  secret?: string;
  headers?: Record<string, string>;
  environment?: Environment;
}

export interface TestCase {
  id: string;
  name: string;
  description?: string;
  type: TestCaseType;
  method?: HttpMethod;
  headers?: Record<string, string>;
  payload?: any;
  expectedStatus: number;
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
}

export interface TestSuite {
  id: string;
  endpointId: string;
  name: string;
  description?: string;
  tests: TestCase[];
  createdAt: string;
  updatedAt: string;
}

export interface TestSuiteCreateInput {
  endpointId: string;
  name: string;
  description?: string;
  tests: TestCase[];
}

export interface TestRun {
  id: string;
  endpointId: string;
  suiteId: string;
  status: TestRunStatus;
  totalTests: number;
  passed: number;
  failed: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  trigger?: 'manual' | 'api' | 'cicd' | 'scheduled';
  environment?: string;
  endpointName?: string;
  suiteName?: string;
}

export interface TestAttempt {
  attemptNumber: number;
  status: 'PASS' | 'FAIL' | 'TIMEOUT' | 'ERROR' | 'SECURITY FAILURE';
  statusCode?: number;
  responseTimeMs: number;
  error?: string;
  timestamp: string;
}

export interface SecurityFailureDetail {
  issue: string;
  severity: 'critical' | 'high' | 'medium';
  expectedBehavior: string;
  observedBehavior: string;
  remediation: string;
}

export interface TestResult {
  id: string;
  runId: string;
  testId?: string;
  testName: string;
  testType: TestCaseType;
  status: TestResultStatus;
  expectedStatus: number;
  actualStatus?: number;
  responseTime: number;
  error?: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: any;
  };
  retryCount: number;
  attempts?: TestAttempt[];
  securityDetails?: SecurityFailureDetail;
  timestamp: string;
}

export interface ReportSummary {
  run: TestRun;
  endpoint: Endpoint;
  suite: TestSuite;
  results: TestResult[];
  metrics: {
    total: number;
    passed: number;
    failed: number;
    successRate: number;
    avgResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    securityFailures: number;
    timeoutFailures: number;
    retryFailures: number;
  };
  statusDistribution: Record<string, number>;
}

export interface DashboardAnalytics {
  totalEndpoints: number;
  totalSuites: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  successRate: number;
  avgResponseTime: number;
  recentRuns: TestRun[];
  statusDistribution: { status: string; count: number }[];
  responseTimesOverTime: { timestamp: string; avgTime: number }[];
  successRateTrends: { date: string; successRate: number; total: number }[];
  securityFailureCount: number;
  timeoutCount: number;
  retryCount: number;
}
