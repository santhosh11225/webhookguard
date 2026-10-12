import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

let dbInstance: DatabaseSync | null = null;

export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
}

export function getDatabase(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = process.env.DB_PATH;
  if (dbPath === ':memory:') {
    console.log('[Database] Initializing isolated in-memory SQLite database');
    dbInstance = new DatabaseSync(':memory:');
    initSchema(dbInstance);
    return dbInstance;
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const resolvedDbPath = dbPath || path.join(dataDir, 'webhookguard.sqlite');
  console.log(`[Database] Initializing SQLite database at ${resolvedDbPath}`);

  dbInstance = new DatabaseSync(resolvedDbPath);
  initSchema(dbInstance);

  return dbInstance;
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS endpoints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'POST',
      authentication TEXT NOT NULL DEFAULT 'none',
      secret TEXT,
      headers TEXT NOT NULL DEFAULT '{}',
      environment TEXT NOT NULL DEFAULT 'development',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_suites (
      id TEXT PRIMARY KEY,
      endpointId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      tests TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (endpointId) REFERENCES endpoints(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS test_runs (
      id TEXT PRIMARY KEY,
      endpointId TEXT NOT NULL,
      suiteId TEXT NOT NULL,
      status TEXT NOT NULL,
      totalTests INTEGER NOT NULL DEFAULT 0,
      passed INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      startedAt TEXT NOT NULL,
      completedAt TEXT,
      durationMs INTEGER,
      trigger TEXT DEFAULT 'manual',
      environment TEXT,
      FOREIGN KEY (endpointId) REFERENCES endpoints(id) ON DELETE CASCADE,
      FOREIGN KEY (suiteId) REFERENCES test_suites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS test_results (
      id TEXT PRIMARY KEY,
      runId TEXT NOT NULL,
      testId TEXT,
      testName TEXT NOT NULL,
      testType TEXT NOT NULL,
      status TEXT NOT NULL,
      expectedStatus INTEGER NOT NULL,
      actualStatus INTEGER,
      responseTime REAL NOT NULL,
      error TEXT,
      request TEXT NOT NULL,
      response TEXT,
      retryCount INTEGER NOT NULL DEFAULT 0,
      attempts TEXT,
      securityDetails TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (runId) REFERENCES test_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_suites_endpoint ON test_suites(endpointId);
    CREATE INDEX IF NOT EXISTS idx_runs_endpoint ON test_runs(endpointId);
    CREATE INDEX IF NOT EXISTS idx_runs_suite ON test_runs(suiteId);
    CREATE INDEX IF NOT EXISTS idx_results_run ON test_results(runId);
  `);
  console.log('[Database] Schema initialized successfully');
}
