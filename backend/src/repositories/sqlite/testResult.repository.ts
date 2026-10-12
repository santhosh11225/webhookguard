import { randomUUID } from 'node:crypto';
import { getDatabase } from './database.js';
import { ITestResultRepository } from '../interfaces/ITestResultRepository.js';
import { TestResult, TestAttempt, SecurityFailureDetail } from '../../models/types.js';

interface TestResultRow {
  id: string;
  runId: string;
  testId: string | null;
  testName: string;
  testType: string;
  status: string;
  expectedStatus: number;
  actualStatus: number | null;
  responseTime: number;
  error: string | null;
  request: string;
  response: string | null;
  retryCount: number;
  attempts: string | null;
  securityDetails: string | null;
  timestamp: string;
}

export class SqliteTestResultRepository implements ITestResultRepository {
  private mapRow(row: TestResultRow): TestResult {
    let request = { url: '', method: 'POST', headers: {} };
    let response: any = undefined;
    let attempts: TestAttempt[] | undefined = undefined;
    let securityDetails: SecurityFailureDetail | undefined = undefined;

    try {
      request = JSON.parse(row.request || '{}');
    } catch {}

    try {
      if (row.response) response = JSON.parse(row.response);
    } catch {}

    try {
      if (row.attempts) attempts = JSON.parse(row.attempts);
    } catch {}

    try {
      if (row.securityDetails) securityDetails = JSON.parse(row.securityDetails);
    } catch {}

    return {
      id: row.id,
      runId: row.runId,
      testId: row.testId ?? undefined,
      testName: row.testName,
      testType: row.testType as any,
      status: row.status as any,
      expectedStatus: row.expectedStatus,
      actualStatus: row.actualStatus ?? undefined,
      responseTime: row.responseTime,
      error: row.error ?? undefined,
      request,
      response,
      retryCount: row.retryCount,
      attempts,
      securityDetails,
      timestamp: row.timestamp,
    };
  }

  async create(data: Omit<TestResult, 'id'>): Promise<TestResult> {
    const db = getDatabase();
    const id = randomUUID();

    const stmt = db.prepare(`
      INSERT INTO test_results (
        id, runId, testId, testName, testType, status, expectedStatus, actualStatus,
        responseTime, error, request, response, retryCount, attempts, securityDetails, timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.runId,
      data.testId || null,
      data.testName,
      data.testType,
      data.status,
      data.expectedStatus,
      data.actualStatus ?? null,
      data.responseTime,
      data.error || null,
      JSON.stringify(data.request),
      data.response ? JSON.stringify(data.response) : null,
      data.retryCount || 0,
      data.attempts ? JSON.stringify(data.attempts) : null,
      data.securityDetails ? JSON.stringify(data.securityDetails) : null,
      data.timestamp
    );

    return (await this.findById(id))!;
  }

  async createMany(items: Omit<TestResult, 'id'>[]): Promise<TestResult[]> {
    const results: TestResult[] = [];
    for (const item of items) {
      results.push(await this.create(item));
    }
    return results;
  }

  async findById(id: string): Promise<TestResult | null> {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM test_results WHERE id = ?');
    const row = stmt.get(id) as TestResultRow | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  async findByRunId(runId: string): Promise<TestResult[]> {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM test_results WHERE runId = ? ORDER BY timestamp ASC');
    const rows = stmt.all(runId) as unknown as TestResultRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async getMetricsByRunId(runId: string): Promise<{
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
  }> {
    const results = await this.findByRunId(runId);
    if (results.length === 0) {
      return {
        total: 0,
        passed: 0,
        failed: 0,
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        securityFailures: 0,
        timeoutFailures: 0,
        retryFailures: 0,
        statusDistribution: {},
      };
    }

    let passed = 0;
    let failed = 0;
    let securityFailures = 0;
    let timeoutFailures = 0;
    let retryFailures = 0;
    let totalTime = 0;
    let minTime = Infinity;
    let maxTime = 0;
    const statusDistribution: Record<string, number> = {};

    for (const res of results) {
      if (res.status === 'PASS') passed++;
      else failed++;

      if (res.status === 'SECURITY FAILURE') securityFailures++;
      if (res.status === 'TIMEOUT') timeoutFailures++;
      if (res.retryCount > 0 && res.status !== 'PASS') retryFailures++;

      totalTime += res.responseTime;
      if (res.responseTime < minTime) minTime = res.responseTime;
      if (res.responseTime > maxTime) maxTime = res.responseTime;

      const code = res.actualStatus ? `${res.actualStatus}` : (res.status === 'TIMEOUT' ? 'Timeout' : 'Error');
      statusDistribution[code] = (statusDistribution[code] || 0) + 1;
    }

    return {
      total: results.length,
      passed,
      failed,
      avgResponseTime: Math.round(totalTime / results.length),
      minResponseTime: minTime === Infinity ? 0 : Math.round(minTime),
      maxResponseTime: Math.round(maxTime),
      securityFailures,
      timeoutFailures,
      retryFailures,
      statusDistribution,
    };
  }

  async getGlobalMetrics(): Promise<{
    avgResponseTime: number;
    securityFailures: number;
    timeoutFailures: number;
    retryCount: number;
    statusDistribution: { status: string; count: number }[];
  }> {
    const db = getDatabase();
    const statsStmt = db.prepare(`
      SELECT
        COALESCE(AVG(responseTime), 0) as avgTime,
        SUM(CASE WHEN status = 'SECURITY FAILURE' THEN 1 ELSE 0 END) as secFailures,
        SUM(CASE WHEN status = 'TIMEOUT' THEN 1 ELSE 0 END) as timeouts,
        SUM(CASE WHEN retryCount > 0 THEN 1 ELSE 0 END) as retries
      FROM test_results
    `);
    const stats = statsStmt.get() as any;

    const distStmt = db.prepare(`
      SELECT
        CASE
          WHEN actualStatus IS NOT NULL THEN CAST(actualStatus AS TEXT)
          WHEN status = 'TIMEOUT' THEN 'TIMEOUT'
          ELSE 'ERROR'
        END as status,
        COUNT(*) as count
      FROM test_results
      GROUP BY status
      ORDER BY count DESC
    `);
    const distRows = distStmt.all() as unknown as { status: string; count: number }[];

    return {
      avgResponseTime: Math.round(stats?.avgTime ?? 0),
      securityFailures: Number(stats?.secFailures ?? 0),
      timeoutFailures: Number(stats?.timeouts ?? 0),
      retryCount: Number(stats?.retries ?? 0),
      statusDistribution: distRows,
    };
  }
}
