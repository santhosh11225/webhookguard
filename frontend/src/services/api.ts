import {
  Endpoint,
  EndpointCreateInput,
  TestSuite,
  TestSuiteCreateInput,
  TestRun,
  TestResult,
  ReportSummary,
  DashboardAnalytics,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
    try {
      const data = await res.json();
      if (data.error) errorMsg = data.error;
      else if (data.message) errorMsg = data.message;
    } catch {}
    throw new Error(errorMsg);
  }
  const json = await res.json();
  return (json.data !== undefined ? json.data : json) as T;
}

export const api = {
  // Health
  async getHealth(): Promise<{ status: string; version: string; demoMode: boolean }> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse(res);
  },

  // Endpoints
  async getEndpoints(): Promise<Endpoint[]> {
    const res = await fetch(`${API_BASE}/endpoints`);
    return handleResponse<Endpoint[]>(res);
  },

  async getEndpoint(id: string): Promise<Endpoint> {
    const res = await fetch(`${API_BASE}/endpoints/${id}`);
    return handleResponse<Endpoint>(res);
  },

  async createEndpoint(data: EndpointCreateInput): Promise<Endpoint> {
    const res = await fetch(`${API_BASE}/endpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Endpoint>(res);
  },

  async updateEndpoint(id: string, data: Partial<EndpointCreateInput>): Promise<Endpoint> {
    const res = await fetch(`${API_BASE}/endpoints/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Endpoint>(res);
  },

  async deleteEndpoint(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/endpoints/${id}`, {
      method: 'DELETE',
    });
    await handleResponse(res);
    return true;
  },

  // Test Suites
  async getTestSuites(endpointId?: string): Promise<TestSuite[]> {
    const url = endpointId
      ? `${API_BASE}/test-suites?endpointId=${encodeURIComponent(endpointId)}`
      : `${API_BASE}/test-suites`;
    const res = await fetch(url);
    return handleResponse<TestSuite[]>(res);
  },

  async getTestSuite(id: string): Promise<TestSuite> {
    const res = await fetch(`${API_BASE}/test-suites/${id}`);
    return handleResponse<TestSuite>(res);
  },

  async createTestSuite(data: TestSuiteCreateInput): Promise<TestSuite> {
    const res = await fetch(`${API_BASE}/test-suites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<TestSuite>(res);
  },

  async updateTestSuite(id: string, data: Partial<TestSuiteCreateInput>): Promise<TestSuite> {
    const res = await fetch(`${API_BASE}/test-suites/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<TestSuite>(res);
  },

  async deleteTestSuite(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/test-suites/${id}`, {
      method: 'DELETE',
    });
    await handleResponse(res);
    return true;
  },

  // Test Runs
  async triggerTestRun(
    endpointId: string,
    suiteId: string,
    trigger: 'manual' | 'api' | 'cicd' = 'manual',
    failOnErrors = false
  ): Promise<{ runId: string; status: string; total: number; passed: number; failed: number }> {
    const query = failOnErrors ? '?failOnErrors=true' : '';
    const res = await fetch(`${API_BASE}/test-runs${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointId, suiteId, trigger }),
    });
    return handleResponse(res);
  },

  async getTestRuns(params?: { endpointId?: string; suiteId?: string; limit?: number }): Promise<TestRun[]> {
    const sp = new URLSearchParams();
    if (params?.endpointId) sp.set('endpointId', params.endpointId);
    if (params?.suiteId) sp.set('suiteId', params.suiteId);
    if (params?.limit) sp.set('limit', params.limit.toString());

    const qs = sp.toString() ? `?${sp.toString()}` : '';
    const res = await fetch(`${API_BASE}/test-runs${qs}`);
    return handleResponse<TestRun[]>(res);
  },

  async getTestRun(id: string): Promise<TestRun> {
    const res = await fetch(`${API_BASE}/test-runs/${id}`);
    return handleResponse<TestRun>(res);
  },

  // Test Results
  async getTestResults(runId: string): Promise<TestResult[]> {
    const res = await fetch(`${API_BASE}/test-results/${runId}`);
    return handleResponse<TestResult[]>(res);
  },

  async getTestResultDetail(id: string): Promise<TestResult> {
    const res = await fetch(`${API_BASE}/test-results/detail/${id}`);
    return handleResponse<TestResult>(res);
  },

  // Reports
  async getReport(runId: string): Promise<ReportSummary> {
    const res = await fetch(`${API_BASE}/reports/${runId}`);
    return handleResponse<ReportSummary>(res);
  },

  // Analytics
  async getDashboardAnalytics(): Promise<DashboardAnalytics> {
    const res = await fetch(`${API_BASE}/analytics/dashboard`);
    return handleResponse<DashboardAnalytics>(res);
  },

  // Seed Data Trigger
  async seedDatabase(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/seed`, { method: 'POST' });
    return handleResponse(res);
  },
};
