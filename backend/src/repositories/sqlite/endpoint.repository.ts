import { randomUUID } from 'node:crypto';
import { getDatabase } from './database.js';
import { IEndpointRepository } from '../interfaces/IEndpointRepository.js';
import { Endpoint, EndpointCreateDTO, EndpointUpdateDTO } from '../../models/types.js';

interface EndpointRow {
  id: string;
  name: string;
  url: string;
  method: string;
  authentication: string;
  secret: string | null;
  headers: string;
  environment: string;
  createdAt: string;
  updatedAt: string;
}

export class SqliteEndpointRepository implements IEndpointRepository {
  private mapRow(row: EndpointRow, maskSecret = true): Endpoint {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      method: row.method as any,
      authentication: row.authentication as any,
      secret: row.secret ? (maskSecret ? '••••••••' : row.secret) : undefined,
      headers: JSON.parse(row.headers || '{}'),
      environment: row.environment as any,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(data: EndpointCreateDTO): Promise<Endpoint> {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();
    const method = data.method || 'POST';
    const authentication = data.authentication || 'none';
    const secret = data.secret || null;
    const headers = JSON.stringify(data.headers || {});
    const environment = data.environment || 'development';

    const stmt = db.prepare(`
      INSERT INTO endpoints (id, name, url, method, authentication, secret, headers, environment, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, data.name, data.url, method, authentication, secret, headers, environment, now, now);

    return (await this.findById(id))!;
  }

  async findById(id: string, maskSecret = true): Promise<Endpoint | null> {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM endpoints WHERE id = ?');
    const row = stmt.get(id) as EndpointRow | undefined;
    if (!row) return null;
    return this.mapRow(row, maskSecret);
  }

  // Used internally by TestRunnerService to compute HMAC signature
  async findByIdWithSecret(id: string): Promise<Endpoint | null> {
    return this.findById(id, false);
  }

  async findAll(): Promise<Endpoint[]> {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM endpoints ORDER BY createdAt DESC');
    const rows = stmt.all() as unknown as EndpointRow[];
    return rows.map((r) => this.mapRow(r, true));
  }

  async update(id: string, data: EndpointUpdateDTO): Promise<Endpoint | null> {
    const db = getDatabase();
    const existing = await this.findById(id, false);
    if (!existing) return null;

    const now = new Date().toISOString();
    const name = data.name ?? existing.name;
    const url = data.url ?? existing.url;
    const method = data.method ?? existing.method;
    const authentication = data.authentication ?? existing.authentication;
    // Don't overwrite secret if client sends masked string or undefined
    let secret = existing.secret;
    if (data.secret !== undefined) {
      if (data.secret === '' || data.secret.startsWith('•••')) {
        // preserve existing
      } else {
        secret = data.secret;
      }
    }
    const headers = JSON.stringify(data.headers ?? existing.headers);
    const environment = data.environment ?? existing.environment;

    const stmt = db.prepare(`
      UPDATE endpoints
      SET name = ?, url = ?, method = ?, authentication = ?, secret = ?, headers = ?, environment = ?, updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(name, url, method, authentication, secret ?? null, headers, environment, now, id);

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM endpoints WHERE id = ?');
    const info = stmt.run(id) as any;
    return (info?.changes ?? 0) > 0;
  }

  async count(): Promise<number> {
    const db = getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as c FROM endpoints');
    const result = stmt.get() as { c: number };
    return result.c;
  }
}
