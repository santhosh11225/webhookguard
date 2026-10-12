import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { MockReceiverController } from '../controllers/mockReceiver.controller.js';
import { generateHmacSha256 } from '../utils/hmac.js';

describe('Mock Receiver Controller & Endpoints', () => {
  let server: http.Server;
  let baseUrl: string;
  const sharedSecret = 'whsec_test_98af21d09e023190ab78ff09a1';

  before(async () => {
    const app = express();
    app.use(
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf.toString('utf8');
        },
      })
    );

    const controller = new MockReceiverController();
    app.all('/payment', controller.handlePayment.bind(controller));
    app.all('/orders', controller.handleOrder.bind(controller));
    app.get('/health', controller.getHealth.bind(controller));
    app.post('/reset', controller.resetRetries.bind(controller));

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('accepts valid HMAC signature and valid payment payload (HTTP 200)', async () => {
    const payload = JSON.stringify({
      event: 'payment.success',
      transaction_id: 'txn_rec_001',
      amount: 4999,
    });
    const signature = generateHmacSha256(payload, sharedSecret);

    const res = await fetch(`${baseUrl}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${signature}`,
      },
      body: payload,
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.transaction_id, 'txn_rec_001');
  });

  it('rejects request with missing HMAC signature header (HTTP 401)', async () => {
    const payload = JSON.stringify({
      event: 'payment.success',
      transaction_id: 'txn_rec_002',
      amount: 1000,
    });

    const res = await fetch(`${baseUrl}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    assert.equal(res.status, 401);
    const body = (await res.json()) as any;
    assert.match(body.message, /Missing HMAC signature/i);
  });

  it('rejects request with invalid HMAC signature (HTTP 401)', async () => {
    const payload = JSON.stringify({
      event: 'payment.success',
      transaction_id: 'txn_rec_003',
      amount: 1000,
    });
    const badSignature = generateHmacSha256(payload, 'wrong_secret_key');

    const res = await fetch(`${baseUrl}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${badSignature}`,
      },
      body: payload,
    });

    assert.equal(res.status, 401);
    const body = (await res.json()) as any;
    assert.match(body.message, /Invalid HMAC-SHA256 signature/i);
  });

  it('rejects request whose payload was modified after signing (HTTP 401)', async () => {
    const originalPayload = JSON.stringify({
      event: 'payment.success',
      transaction_id: 'txn_rec_004',
      amount: 1000,
    });
    const signature = generateHmacSha256(originalPayload, sharedSecret);

    const tamperedPayload = JSON.stringify({
      event: 'payment.success',
      transaction_id: 'txn_rec_004',
      amount: 1, // Tampered financial field
    });

    const res = await fetch(`${baseUrl}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${signature}`,
      },
      body: tamperedPayload,
    });

    assert.equal(res.status, 401);
    const body = (await res.json()) as any;
    assert.match(body.message, /Invalid HMAC-SHA256 signature/i);
  });

  it('rejects malformed signature header format (HTTP 401)', async () => {
    const payload = JSON.stringify({
      event: 'payment.success',
      transaction_id: 'txn_rec_005',
      amount: 1000,
    });

    const res = await fetch(`${baseUrl}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': 'sha256=not_a_hex_digest',
      },
      body: payload,
    });

    assert.equal(res.status, 401);
    const body = (await res.json()) as any;
    assert.match(body.message, /Malformed HMAC signature/i);
  });

  it('rejects validly signed request missing required transaction_id (HTTP 400)', async () => {
    const payload = JSON.stringify({
      event: 'payment.success',
      amount: 1000,
    });
    const signature = generateHmacSha256(payload, sharedSecret);

    const res = await fetch(`${baseUrl}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${signature}`,
      },
      body: payload,
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as any;
    assert.match(body.message, /Missing required field: transaction_id/i);
  });

  it('rejects validly signed request missing required amount (HTTP 400)', async () => {
    const payload = JSON.stringify({
      event: 'payment.success',
      transaction_id: 'txn_rec_006',
    });
    const signature = generateHmacSha256(payload, sharedSecret);

    const res = await fetch(`${baseUrl}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${signature}`,
      },
      body: payload,
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as any;
    assert.match(body.message, /Missing required field: amount/i);
  });

  it('rejects validly signed request with non-numeric amount (HTTP 400)', async () => {
    const payload = JSON.stringify({
      event: 'payment.success',
      transaction_id: 'txn_rec_007',
      amount: 'NOT_A_NUMBER',
    });
    const signature = generateHmacSha256(payload, sharedSecret);

    const res = await fetch(`${baseUrl}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${signature}`,
      },
      body: payload,
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as any;
    assert.match(body.message, /Invalid data type: amount/i);
  });

  it('simulates vulnerable endpoint accepting unverified payload (HTTP 200 with warning)', async () => {
    const payload = JSON.stringify({
      event: 'payment.success',
      transaction_id: 'txn_rec_vuln',
      amount: 500,
    });
    const forgedSig = generateHmacSha256(payload, 'forged_key');

    const res = await fetch(`${baseUrl}/payment?vulnerable=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${forgedSig}`,
      },
      body: payload,
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.match(body.warning, /VULNERABILITY DETECTED/i);
  });

  it('recovers after retries on transient 503 order webhook', async () => {
    await fetch(`${baseUrl}/reset`, { method: 'POST' });

    const orderPayload = JSON.stringify({ order_id: 'ord_retry_suite_01' });

    // Attempt 1 -> 503
    const res1 = await fetch(`${baseUrl}/orders?failTimes=2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: orderPayload,
    });
    assert.equal(res1.status, 503);

    // Attempt 2 -> 503
    const res2 = await fetch(`${baseUrl}/orders?failTimes=2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: orderPayload,
    });
    assert.equal(res2.status, 503);

    // Attempt 3 -> 200 Recovery
    const res3 = await fetch(`${baseUrl}/orders?failTimes=2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: orderPayload,
    });
    assert.equal(res3.status, 200);
    const body3 = (await res3.json()) as any;
    assert.equal(body3.success, true);
    assert.equal(body3.attemptSuccessful, 3);
  });

  it('returns health check details for mock receiver (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'WebhookGuard Mock Receiver');
    assert.equal(body.hmac.algorithm, 'sha256');
  });
});
