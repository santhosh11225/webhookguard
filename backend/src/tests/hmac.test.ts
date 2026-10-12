import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateHmacSha256, verifyHmacSha256 } from '../utils/hmac.js';

describe('HMAC-SHA256 Utility', () => {
  const secret = 'whsec_test_secret_key_12345';
  const payload = JSON.stringify({
    event: 'payment.success',
    transaction_id: 'txn_987654321',
    amount: 5000,
  });

  it('generates a valid 64-character lowercase hex digest', () => {
    const signature = generateHmacSha256(payload, secret);
    assert.equal(typeof signature, 'string');
    assert.equal(signature.length, 64);
    assert.match(signature, /^[0-9a-f]{64}$/);
  });

  it('accepts a correct HMAC signature with sha256= prefix', () => {
    const signature = generateHmacSha256(payload, secret);
    const valid = verifyHmacSha256(payload, secret, `sha256=${signature}`);
    assert.equal(valid, true);
  });

  it('accepts a correct HMAC signature without sha256= prefix', () => {
    const signature = generateHmacSha256(payload, secret);
    const valid = verifyHmacSha256(payload, secret, signature);
    assert.equal(valid, true);
  });

  it('rejects an incorrect HMAC signature', () => {
    const wrongSignature = generateHmacSha256(payload, 'wrong_secret_key_abc');
    const valid = verifyHmacSha256(payload, secret, `sha256=${wrongSignature}`);
    assert.equal(valid, false);
  });

  it('rejects payload modified after signing (tampered request body)', () => {
    const originalSignature = generateHmacSha256(payload, secret);
    const tamperedPayload = JSON.stringify({
      event: 'payment.success',
      transaction_id: 'txn_987654321',
      amount: 1, // Attacker lowered the amount
    });

    const valid = verifyHmacSha256(tamperedPayload, secret, `sha256=${originalSignature}`);
    assert.equal(valid, false);
  });

  it('rejects missing or empty signature', () => {
    assert.equal(verifyHmacSha256(payload, secret, ''), false);
    assert.equal(verifyHmacSha256(payload, secret, undefined as any), false);
    assert.equal(verifyHmacSha256(payload, secret, null as any), false);
  });

  it('rejects malformed signature formats (non-hex characters or invalid length)', () => {
    assert.equal(verifyHmacSha256(payload, secret, 'invalid_signature_deadbeef'), false);
    assert.equal(verifyHmacSha256(payload, secret, 'sha256=too_short'), false);
    assert.equal(
      verifyHmacSha256(
        payload,
        secret,
        'sha256=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'
      ),
      false
    );
  });

  it('rejects when secret is missing or empty', () => {
    const signature = generateHmacSha256(payload, secret);
    assert.equal(verifyHmacSha256(payload, '', signature), false);
    assert.equal(verifyHmacSha256(payload, undefined as any, signature), false);
  });

  it('handles empty payload string correctly', () => {
    const emptyPayload = '';
    const signature = generateHmacSha256(emptyPayload, secret);
    assert.equal(verifyHmacSha256(emptyPayload, secret, signature), true);
    assert.equal(verifyHmacSha256('not empty', secret, signature), false);
  });
});
