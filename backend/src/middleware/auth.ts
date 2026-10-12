import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Authentication middleware for WebhookGuard management APIs.
 * Enforces X-API-Key header (or Bearer token) when ADMIN_API_KEY is configured in the environment.
 * Leaves health check and mock webhook receiver routes publicly accessible for webhook testing.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.ADMIN_API_KEY || process.env.WEBHOOKGUARD_ADMIN_KEY;

  // If no admin key is configured in the environment, bypass (e.g. local automated test runs)
  if (!adminKey) {
    return next();
  }

  const providedKey =
    (req.headers['x-api-key'] as string) ||
    (req.headers['x-admin-key'] as string) ||
    (req.headers['authorization']?.replace(/^Bearer\s+/i, '')) ||
    (req.query.apiKey as string);

  if (!providedKey || !safeCompare(providedKey, adminKey)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid API Key required for WebhookGuard management operations. Provide X-API-Key header.',
    });
    return;
  }

  next();
}
