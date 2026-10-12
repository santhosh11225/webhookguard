import { Request, Response } from 'express';
import { verifyHmacSha256 } from '../utils/hmac.js';

let orderRetryCounter: Record<string, number> = {};

export class MockReceiverController {
  /**
   * Mock Payment Webhook Receiver
   * Supports genuine HMAC-SHA256 cryptographic verification, schema validation, and timeout simulation
   */
  async handlePayment(req: Request, res: Response): Promise<void> {
    // 1. Timeout / Delay Simulation
    let delay = parseInt(req.query.delay as string, 10);
    if (isNaN(delay) || delay <= 0) {
      if (req.body?.event === 'payment.heavy_processing') {
        delay = 3000; // Trigger timeout for SLA tests (default timeout is 2000ms)
      }
    }
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // 2. Extract raw body for accurate byte-level cryptographic signature verification
    let rawBody: string;
    if (typeof (req as any).rawBody === 'string') {
      rawBody = (req as any).rawBody;
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      rawBody = JSON.stringify(req.body);
    } else {
      rawBody = '';
    }

    // 3. Extract signature header
    const sigHeader = (req.headers['x-signature'] ||
      req.headers['x-hub-signature-256'] ||
      req.headers['signature']) as string | undefined;

    const isVulnerableMode = req.query.vulnerable === 'true' || req.originalUrl.includes('vulnerable');
    const secret =
      (req.headers['x-mock-secret'] as string) ||
      process.env.MOCK_WEBHOOK_SECRET ||
      process.env.WEBHOOK_SECRET ||
      'whsec_test_98af21d09e023190ab78ff09a1';

    // 4. HMAC Verification Logic
    if (isVulnerableMode) {
      // In vulnerable simulation mode, endpoint dangerously accepts invalid/missing signatures
      const isSignatureValid = sigHeader ? verifyHmacSha256(rawBody, secret, sigHeader) : false;
      if (!isSignatureValid) {
        res.status(200).json({
          success: true,
          warning: 'VULNERABILITY DETECTED: Endpoint accepted unverified payload!',
          transaction_id: req.body?.transaction_id || 'unverified_txn',
          amount: req.body?.amount,
        });
        return;
      }
    } else {
      // Production-grade strict HMAC validation
      if (!sigHeader) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing HMAC signature in request header (X-Signature)',
        });
        return;
      }

      const cleanSig = sigHeader.trim().replace(/^sha256=/, '');
      if (!/^[0-9a-fA-F]{64}$/.test(cleanSig)) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Malformed HMAC signature format. Expected 64-character hexadecimal digest.',
        });
        return;
      }

      const isValid = verifyHmacSha256(rawBody, secret, sigHeader);
      if (!isValid) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid HMAC-SHA256 signature provided in request header',
        });
        return;
      }
    }

    // 5. Payload Schema Validation
    const body = req.body;

    // Check empty body
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0) || rawBody.trim() === '') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Webhook payload body cannot be empty',
      });
      return;
    }

    // Check required transaction_id
    if (!body.transaction_id) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: transaction_id',
      });
      return;
    }

    // Check required amount
    if (body.amount === undefined || body.amount === null) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: amount',
      });
      return;
    }

    // Check amount data type
    if (typeof body.amount !== 'number') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid data type: amount must be a numeric integer',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Payment webhook received and verified successfully',
      transaction_id: body.transaction_id,
      amount: body.amount,
      currency: body.currency || 'USD',
      receivedAt: new Date().toISOString(),
    });
  }

  /**
   * Mock Order Webhook with built-in Retry Simulation
   * Fails 2 times with 503, then succeeds on attempt 3
   */
  async handleOrder(req: Request, res: Response): Promise<void> {
    const delay = parseInt(req.query.delay as string, 10);
    if (!isNaN(delay) && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const orderId = req.body?.order_id || 'default_order';
    const currentCount = (orderRetryCounter[orderId] || 0) + 1;
    orderRetryCounter[orderId] = currentCount;

    const failTimes = parseInt(req.query.failTimes as string, 10) || 2;

    if (currentCount <= failTimes) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: `Transient database lock contention. Attempt ${currentCount}/${failTimes + 1}`,
        attempt: currentCount,
      });
      return;
    }

    // Reset counter on success
    delete orderRetryCounter[orderId];

    res.status(200).json({
      success: true,
      message: 'Order webhook processed successfully after retry recovery',
      order_id: orderId,
      attemptSuccessful: currentCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Reset retry simulation counters
   */
  resetRetries(_req: Request, res: Response): void {
    orderRetryCounter = {};
    res.json({ success: true, message: 'Retry simulation counters reset' });
  }

  /**
   * Health check and inspection endpoint for the mock receiver
   */
  getHealth(_req: Request, res: Response): void {
    res.status(200).json({
      status: 'ok',
      service: 'WebhookGuard Mock Receiver',
      endpoints: {
        payment: '/payment (or /api/mock-webhooks/payment)',
        orders: '/orders (or /api/mock-webhooks/orders)',
      },
      hmac: {
        algorithm: 'sha256',
        header: 'X-Signature',
        prefix: 'optional sha256=',
      },
      timestamp: new Date().toISOString(),
    });
  }
}
