import { TestResult } from '../../models/types.js';

export interface ITestResultRepository {
  create(data: Omit<TestResult, 'id'>): Promise<TestResult>;
  createMany(data: Omit<TestResult, 'id'>[]): Promise<TestResult[]>;
  findByRunId(runId: string): Promise<TestResult[]>;
  findById(id: string): Promise<TestResult | null>;
  getMetricsByRunId(runId: string): Promise<{
    total: number;
    passed: number;
    failed: number;
    avgResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    securityFailures: number;
    timeoutFailures: number;
    retryFailures: number;
    statusDistribution: Record<string, number>;
  }>;
  getGlobalMetrics(): Promise<{
    avgResponseTime: number;
    securityFailures: number;
    timeoutFailures: number;
    retryCount: number;
    statusDistribution: { status: string; count: number }[];
  }>;
}
