import { randomUUID } from 'node:crypto';
import { getDatabase } from './database.js';
import { ITestSuiteRepository } from '../interfaces/ITestSuiteRepository.js';
import { TestSuite, TestSuiteCreateDTO, TestSuiteUpdateDTO, TestCase } from '../../models/types.js';

interface TestSuiteRow {
  id: string;
  endpointId: string;
  name: string;
  description: string | null;
  tests: string;
  createdAt: string;
  updatedAt: string;
}

export class SqliteTestSuiteRepository implements ITestSuiteRepository {
  private mapRow(row: TestSuiteRow): TestSuite {
    let tests: TestCase[] = [];
    try {
      tests = JSON.parse(row.tests || '[]');
    } catch {
      tests = [];
    }

    return {
      id: row.id,
      endpointId: row.endpointId,
      name: row.name,
      description: row.description ?? undefined,
      tests,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(data: TestSuiteCreateDTO): Promise<TestSuite> {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();
    const tests = JSON.stringify(data.tests || []);

    const stmt = db.prepare(`
      INSERT INTO test_suites (id, endpointId, name, description, tests, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, data.endpointId, data.name, data.description || null, tests, now, now);

    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<TestSuite | null> {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM test_suites WHERE id = ?');
    const row = stmt.get(id) as TestSuiteRow | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  async findByEndpointId(endpointId: string): Promise<TestSuite[]> {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM test_suites WHERE endpointId = ? ORDER BY createdAt DESC');
    const rows = stmt.all(endpointId) as unknown as TestSuiteRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async findAll(): Promise<TestSuite[]> {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM test_suites ORDER BY createdAt DESC');
    const rows = stmt.all() as unknown as TestSuiteRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async update(id: string, data: TestSuiteUpdateDTO): Promise<TestSuite | null> {
    const db = getDatabase();
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const name = data.name ?? existing.name;
    const description = data.description !== undefined ? data.description : (existing.description ?? null);
    const tests = data.tests !== undefined ? JSON.stringify(data.tests) : JSON.stringify(existing.tests);

    const stmt = db.prepare(`
      UPDATE test_suites
      SET name = ?, description = ?, tests = ?, updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(name, description, tests, now, id);

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM test_suites WHERE id = ?');
    const info = stmt.run(id) as any;
    return (info?.changes ?? 0) > 0;
  }

  async count(): Promise<number> {
    const db = getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as c FROM test_suites');
    const result = stmt.get() as { c: number };
    return result.c;
  }
}
