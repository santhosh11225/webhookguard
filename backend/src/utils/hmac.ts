import crypto from 'node:crypto';

/**
 * Generate HMAC-SHA256 signature for a given payload and secret key
 */
export function generateHmacSha256(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Verify HMAC-SHA256 signature using timing-safe comparison
 */
export function verifyHmacSha256(payload: string, secret: string, signature: string): boolean {
  try {
    if (!secret || typeof secret !== 'string') {
      return false;
    }
    if (!signature || typeof signature !== 'string') {
      return false;
    }

    const cleanSignature = signature.trim().replace(/^sha256=/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(cleanSignature)) {
      return false;
    }

    const normalizedPayload = typeof payload === 'string' ? payload : '';
    const expected = generateHmacSha256(normalizedPayload, secret);
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(cleanSignature, 'hex');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}
