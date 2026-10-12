import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApiRouter } from '../routes/index.js';
import { generateHmacSha256 } from '../utils/hmac.js';
import { DEFAULT_MOCK_WEBHOOK_SECRET } from '../controllers/mockReceiver.controller.js';

describe('Management API Authentication & Security Protection', () => {
  let server: any;
  let baseUrl: string;
  const TEST_ADMIN_KEY = 'test_guard_admin_key_sec_999';

  before(async () => {
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    process.env.DB_PATH = ':memory:';

    const app = express();
    app.use(express.json());
    app.use('/api', createApiRouter());

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    delete process.env.ADMIN_API_KEY;
    if (server) {
      await new Promise<void>((resolve) => server.close(resolve));
    }
  });

  // 1. Unauthenticated requests to management routes are rejected with HTTP 401
  it('rejects unauthenticated GET /endpoints with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/endpoints`);
    assert.equal(res.status, 401);
    const body = (await res.json()) as any;
    assert.equal(body.error, 'Unauthorized');
  });

  it('rejects unauthenticated POST /test-runs with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/test-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointId: 'ep-1', suiteId: 'st-1' }),
    });
    assert.equal(res.status, 401);
    const body = (await res.json()) as any;
    assert.equal(body.error, 'Unauthorized');
  });

  it('rejects unauthenticated GET /reports/rep-1 with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/reports/rep-1`);
    assert.equal(res.status, 401);
  });

  it('rejects unauthenticated POST /seed with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/seed`, { method: 'POST' });
    assert.equal(res.status, 401);
  });

  // 2. Authenticated requests with X-API-Key succeed
  it('accepts GET /endpoints when valid X-API-Key is provided (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/endpoints`, {
      headers: { 'X-API-Key': TEST_ADMIN_KEY },
    });
    assert.equal(res.status, 200);
  });

  it('rejects GET /endpoints when invalid X-API-Key is provided (HTTP 401)', async () => {
    const res = await fetch(`${baseUrl}/endpoints`, {
      headers: { 'X-API-Key': 'wrong_key_123' },
    });
    assert.equal(res.status, 401);
  });

  // 3. Health check remains public
  it('allows unauthenticated GET /health without API key (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.status, 'healthy');
  });

  // 4. Mock webhook receiver remains functional and enforces HMAC
  it('allows validly signed webhook to /mock-webhooks/payment without admin key (HTTP 200)', async () => {
    const payload = JSON.stringify({
      event: 'payment.success',
      transaction_id: 'txn_auth_pub_01',
      amount: 1500,
    });
    const sig = generateHmacSha256(payload, DEFAULT_MOCK_WEBHOOK_SECRET);

    const res = await fetch(`${baseUrl}/mock-webhooks/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${sig}`,
      },
      body: payload,
    });

    assert.equal(res.status, 200);
  });

  it('enforces HMAC signature rejection on /mock-webhooks/payment with forged signature (HTTP 401)', async () => {
    const payload = JSON.stringify({
      event: 'payment.success',
      transaction_id: 'txn_forged_999',
      amount: 1500,
    });

    const res = await fetch(`${baseUrl}/mock-webhooks/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': 'sha256=invalid_signature_hex',
      },
      body: payload,
    });

    assert.equal(res.status, 401);
  });
});
