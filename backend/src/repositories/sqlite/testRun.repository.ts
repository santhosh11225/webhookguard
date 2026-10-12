import { randomUUID } from 'node:crypto';
import { getDatabase } from './database.js';
import { ITestRunRepository, TestRunCreateData } from '../interfaces/ITestRunRepository.js';
import { TestRun } from '../../models/types.js';

interface TestRunRow {
  id: string;
  endpointId: string;
  suiteId: string;
  status: string;
  totalTests: number;
  passed: number;
  failed: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  trigger: string | null;
  environment: string | null;
  endpointName?: string | null;
  suiteName?: string | null;
}

export class SqliteTestRunRepository implements ITestRunRepository {
  private mapRow(row: TestRunRow): TestRun {
    return {
      id: row.id,
      endpointId: row.endpointId,
      suiteId: row.suiteId,
      status: row.status as any,
      totalTests: row.totalTests,
      passed: row.passed,
      failed: row.failed,
      startedAt: row.startedAt,
      completedAt: row.completedAt ?? undefined,
      durationMs: row.durationMs ?? undefined,
      trigger: (row.trigger as any) || 'manual',
      environment: row.environment ?? undefined,
      endpointName: row.endpointName ?? undefined,
      suiteName: row.suiteName ?? undefined,
    };
  }

  async create(data: TestRunCreateData): Promise<TestRun> {
    const db = getDatabase();
    const id = randomUUID();
    const passed = data.passed ?? 0;
    const failed = data.failed ?? 0;

    const stmt = db.prepare(`
      INSERT INTO test_runs (id, endpointId, suiteId, status, totalTests, passed, failed, startedAt, completedAt, durationMs, trigger, environment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.endpointId,
      data.suiteId,
      data.status,
      data.totalTests,
      passed,
      failed,
      data.startedAt,
      data.completedAt || null,
      data.durationMs || null,
      data.trigger || 'manual',
      data.environment || null
    );

    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<TestRun | null> {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT r.*, e.name as endpointName, s.name as suiteName
      FROM test_runs r
      LEFT JOIN endpoints e ON r.endpointId = e.id
      LEFT JOIN test_suites s ON r.suiteId = s.id
      WHERE r.id = ?
    `);
    const row = stmt.get(id) as TestRunRow | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  async findByEndpointId(endpointId: string): Promise<TestRun[]> {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT r.*, e.name as endpointName, s.name as suiteName
      FROM test_runs r
      LEFT JOIN endpoints e ON r.endpointId = e.id
      LEFT JOIN test_suites s ON r.suiteId = s.id
      WHERE r.endpointId = ?
      ORDER BY r.startedAt DESC
    `);
    const rows = stmt.all(endpointId) as unknown as TestRunRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async findBySuiteId(suiteId: string): Promise<TestRun[]> {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT r.*, e.name as endpointName, s.name as suiteName
      FROM test_runs r
      LEFT JOIN endpoints e ON r.endpointId = e.id
      LEFT JOIN test_suites s ON r.suiteId = s.id
      WHERE r.suiteId = ?
      ORDER BY r.startedAt DESC
    `);
    const rows = stmt.all(suiteId) as unknown as TestRunRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async findAll(limit = 100): Promise<TestRun[]> {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT r.*, e.name as endpointName, s.name as suiteName
      FROM test_runs r
      LEFT JOIN endpoints e ON r.endpointId = e.id
      LEFT JOIN test_suites s ON r.suiteId = s.id
      ORDER BY r.startedAt DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as unknown as TestRunRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async update(id: string, data: Partial<TestRun>): Promise<TestRun | null> {
    const db = getDatabase();
    const existing = await this.findById(id);
    if (!existing) return null;

    const status = data.status ?? existing.status;
    const passed = data.passed ?? existing.passed;
    const failed = data.failed ?? existing.failed;
    const completedAt = data.completedAt !== undefined ? data.completedAt : (existing.completedAt ?? null);
    const durationMs = data.durationMs !== undefined ? data.durationMs : (existing.durationMs ?? null);

    const stmt = db.prepare(`
      UPDATE test_runs
      SET status = ?, passed = ?, failed = ?, completedAt = ?, durationMs = ?
      WHERE id = ?
    `);

    stmt.run(status, passed, failed, completedAt, durationMs, id);

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM test_runs WHERE id = ?');
    const info = stmt.run(id) as any;
    return (info?.changes ?? 0) > 0;
  }

  async count(): Promise<number> {
    const db = getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as c FROM test_runs');
    const result = stmt.get() as { c: number };
    return result.c;
  }

  async getAggregateStats(): Promise<{
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
  }> {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as totalRuns,
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passedRuns,
        SUM(CASE WHEN status = 'failed' OR status = 'error' THEN 1 ELSE 0 END) as failedRuns,
        COALESCE(SUM(totalTests), 0) as totalTests,
        COALESCE(SUM(passed), 0) as passedTests,
        COALESCE(SUM(failed), 0) as failedTests
      FROM test_runs
    `);
    const row = stmt.get() as any;
    return {
      totalRuns: Number(row?.totalRuns ?? 0),
      passedRuns: Number(row?.passedRuns ?? 0),
      failedRuns: Number(row?.failedRuns ?? 0),
      totalTests: Number(row?.totalTests ?? 0),
      passedTests: Number(row?.passedTests ?? 0),
      failedTests: Number(row?.failedTests ?? 0),
    };
  }
}
