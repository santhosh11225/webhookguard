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

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (typeof window !== 'undefined') {
    const key = localStorage.getItem('webhookguard_api_key');
    if (key) {
      headers['X-API-Key'] = key;
    }
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      const stored = localStorage.getItem('webhookguard_api_key');
      const entered = window.prompt(
        stored
          ? 'Authentication failed: Invalid WebhookGuard Access Key. Please enter the valid Access Key:'
          : 'Authentication required: Please enter your WebhookGuard Access Key to manage endpoints and runs:'
      );
      if (entered && entered.trim()) {
        localStorage.setItem('webhookguard_api_key', entered.trim());
        window.location.reload();
      }
    }

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = getHeaders((options.headers as Record<string, string>) || {});
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  return handleResponse<T>(res);
}

export const api = {
  // Health (public)
  async getHealth(): Promise<{ status: string; version: string; demoMode: boolean }> {
    return request('/health');
  },

  // Endpoints
  async getEndpoints(): Promise<Endpoint[]> {
    return request<Endpoint[]>('/endpoints');
  },

  async getEndpoint(id: string): Promise<Endpoint> {
    return request<Endpoint>(`/endpoints/${id}`);
  },

  async createEndpoint(data: EndpointCreateInput): Promise<Endpoint> {
    return request<Endpoint>('/endpoints', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateEndpoint(id: string, data: Partial<EndpointCreateInput>): Promise<Endpoint> {
    return request<Endpoint>(`/endpoints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteEndpoint(id: string): Promise<boolean> {
    await request(`/endpoints/${id}`, { method: 'DELETE' });
    return true;
  },

  // Test Suites
  async getTestSuites(endpointId?: string): Promise<TestSuite[]> {
    const query = endpointId ? `?endpointId=${encodeURIComponent(endpointId)}` : '';
    return request<TestSuite[]>(`/test-suites${query}`);
  },

  async getTestSuite(id: string): Promise<TestSuite> {
    return request<TestSuite>(`/test-suites/${id}`);
  },

  async createTestSuite(data: TestSuiteCreateInput): Promise<TestSuite> {
    return request<TestSuite>('/test-suites', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTestSuite(id: string, data: Partial<TestSuiteCreateInput>): Promise<TestSuite> {
    return request<TestSuite>(`/test-suites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteTestSuite(id: string): Promise<boolean> {
    await request(`/test-suites/${id}`, { method: 'DELETE' });
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
    return request(`/test-runs${query}`, {
      method: 'POST',
      body: JSON.stringify({ endpointId, suiteId, trigger }),
    });
  },

  async getTestRuns(params?: { endpointId?: string; suiteId?: string; limit?: number }): Promise<TestRun[]> {
    const sp = new URLSearchParams();
    if (params?.endpointId) sp.set('endpointId', params.endpointId);
    if (params?.suiteId) sp.set('suiteId', params.suiteId);
    if (params?.limit) sp.set('limit', params.limit.toString());

    const qs = sp.toString() ? `?${sp.toString()}` : '';
    return request<TestRun[]>(`/test-runs${qs}`);
  },

  async getTestRun(id: string): Promise<TestRun> {
    return request<TestRun>(`/test-runs/${id}`);
  },

  // Test Results
  async getTestResults(runId: string): Promise<TestResult[]> {
    return request<TestResult[]>(`/test-results/${runId}`);
  },

  async getTestResultDetail(id: string): Promise<TestResult> {
    return request<TestResult>(`/test-results/detail/${id}`);
  },

  // Reports
  async getReport(runId: string): Promise<ReportSummary> {
    return request<ReportSummary>(`/reports/${runId}`);
  },

  // Analytics
  async getDashboardAnalytics(): Promise<DashboardAnalytics> {
    return request<DashboardAnalytics>('/analytics/dashboard');
  },

  // Seed Data Trigger
  async seedDatabase(): Promise<{ success: boolean; message: string }> {
    return request('/seed', { method: 'POST' });
  },

  // CI/CD GitHub Actions Real Integration
  async dispatchGitHubAction(suiteId: string, endpointId?: string): Promise<{
    success: boolean;
    message: string;
    suiteId: string;
    endpointId: string;
    suiteName: string;
    repository: string;
    workflow: string;
    dispatchedAt: string;
  }> {
    return request('/cicd/dispatch', {
      method: 'POST',
      body: JSON.stringify({ suiteId, endpointId }),
    });
  },

  async getGitHubActionStatus(params?: { suiteId?: string; runId?: number | string; since?: string }): Promise<{
    success: boolean;
    found: boolean;
    status?: string;
    message?: string;
    run?: {
      id: number;
      name: string;
      status: 'queued' | 'in_progress' | 'completed';
      conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required' | null;
      htmlUrl: string;
      createdAt: string;
      updatedAt: string;
      runNumber: number;
    };
  }> {
    const sp = new URLSearchParams();
    if (params?.suiteId) sp.set('suiteId', params.suiteId);
    if (params?.runId) sp.set('runId', params.runId.toString());
    if (params?.since) sp.set('since', params.since);
    const qs = sp.toString() ? `?${sp.toString()}` : '';
    return request(`/cicd/status${qs}`);
  },
};
