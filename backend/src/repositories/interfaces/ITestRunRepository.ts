import { TestRun, TestRunStatus } from '../../models/types.js';

export interface TestRunCreateData {
  endpointId: string;
  suiteId: string;
  status: TestRunStatus;
  totalTests: number;
  passed?: number;
  failed?: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  trigger?: 'manual' | 'api' | 'cicd' | 'scheduled';
  environment?: string;
}

export interface ITestRunRepository {
  create(data: TestRunCreateData): Promise<TestRun>;
  findById(id: string): Promise<TestRun | null>;
  findByEndpointId(endpointId: string): Promise<TestRun[]>;
  findBySuiteId(suiteId: string): Promise<TestRun[]>;
  findAll(limit?: number): Promise<TestRun[]>;
  update(id: string, data: Partial<TestRun>): Promise<TestRun | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  getAggregateStats(): Promise<{
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
  }>;
}
