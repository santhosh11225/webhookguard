import { Request, Response } from 'express';
import { verifyHmacSha256 } from '../utils/hmac.js';

let orderRetryCounter: Record<string, number> = {};
let paymentRetryCounter: Record<string, number> = {};

export const DEFAULT_MOCK_WEBHOOK_SECRET = 'whsec_test_98af21d09e023190ab78ff09a1';

export class MockReceiverController {
  /**
   * Mock Payment Webhook Receiver
   * Supports genuine HMAC-SHA256 cryptographic verification, schema validation, and timeout simulation
   */
  async handlePayment(req: Request, res: Response): Promise<void> {
    // 1. Timeout / Delay Simulation
    let delay = parseInt(req.query.delay as string, 10);
    if (isNaN(delay) || delay <= 0) {
      if (req.body?.delay && !isNaN(parseInt(req.body.delay, 10))) {
        delay = parseInt(req.body.delay, 10);
      } else if (req.body?.event === 'payment.heavy_processing' || req.body?.event === 'payment.slow') {
        delay = 3000; // Trigger timeout for SLA tests (default timeout threshold is 2000ms)
      }
    }
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (res.headersSent || res.writableEnded) {
      return;
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
      DEFAULT_MOCK_WEBHOOK_SECRET;

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

    // 6. Transient Retry Simulation for Payment Webhooks
    if (body.event === 'payment.retry') {
      const retryKey = body.transaction_id || 'default_payment_retry';
      const currentAttempt = (paymentRetryCounter[retryKey] || 0) + 1;
      paymentRetryCounter[retryKey] = currentAttempt;

      if (currentAttempt <= 2) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: `Transient payment gateway unavailable. Attempt ${currentAttempt}/3`,
          attempt: currentAttempt,
        });
        return;
      }

      delete paymentRetryCounter[retryKey];
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
    let delay = parseInt(req.query.delay as string, 10);
    if (isNaN(delay) || delay <= 0) {
      if (req.body?.delay && !isNaN(parseInt(req.body.delay, 10))) {
        delay = parseInt(req.body.delay, 10);
      } else if (req.body?.order_id === 'ord_slow_lock' || req.body?.event === 'order.slow') {
        delay = 3000;
      }
    }
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (res.headersSent || res.writableEnded) {
      return;
    }

    const orderId = req.body?.order_id || 'default_order';
    const isRetryTest =
      req.query.failTimes !== undefined ||
      req.body?.event === 'order.retry' ||
      orderId.includes('retry');

    if (isRetryTest) {
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
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Order webhook processed successfully',
      order_id: orderId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Mock Inventory Webhook Receiver
   * Supports API Key authentication (X-API-Key) and schema validation
   */
  async handleInventory(req: Request, res: Response): Promise<void> {
    // 1. Timeout / Delay Simulation
    let delay = parseInt(req.query.delay as string, 10);
    if (isNaN(delay) || delay <= 0) {
      if (req.body?.delay && !isNaN(parseInt(req.body.delay, 10))) {
        delay = parseInt(req.body.delay, 10);
      } else if (req.body?.event === 'inventory.slow') {
        delay = 3000;
      }
    }
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (res.headersSent || res.writableEnded) {
      return;
    }

    // 2. Authentication Check
    const apiKey =
      (req.headers['x-api-key'] as string) ||
      (req.headers['authorization']?.replace(/^ApiKey\s+/i, '')) ||
      (req.query.apiKey as string);

    const expectedKey = process.env.INVENTORY_API_KEY || 'ak_sec_wh_789123400';

    if (!apiKey || apiKey !== expectedKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or missing API key in request header (X-API-Key)',
      });
      return;
    }

    // 3. Schema Validation
    const body = req.body;
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Webhook payload body cannot be empty',
      });
      return;
    }

    if (!body.sku && !body.item_id) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: sku',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Warehouse inventory replenishment received successfully',
      sku: body.sku || body.item_id,
      quantity: body.quantity ?? 1,
      zone: req.headers['x-warehouse-zone'] || 'us-east-1a',
      receivedAt: new Date().toISOString(),
    });
  }

  /**
   * Reset retry simulation counters
   */
  resetRetries(_req: Request, res: Response): void {
    orderRetryCounter = {};
    paymentRetryCounter = {};
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
        inventory: '/inventory (or /api/mock-webhooks/inventory)',
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
