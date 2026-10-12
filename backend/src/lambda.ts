import express from 'express';
import cors from 'cors';
import serverlessExpress from '@vendia/serverless-express';
import { createApiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { MockReceiverController } from './controllers/mockReceiver.controller.js';
import { createMockReceiverRoutes } from './routes/mockReceiver.routes.js';

const app = express();

// Middleware
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Signature',
      'X-API-Key',
      'X-Signature-Header',
      'X-Requested-With',
    ],
  })
);

app.use(
  express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);
app.use(
  express.text({
    type: ['text/*', 'application/xml'],
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);

// Fallback to extract raw body from API Gateway event if available
app.use((req: any, _res, next) => {
  if (!req.rawBody && req.apiGateway?.event?.body) {
    const raw = req.apiGateway.event.body;
    req.rawBody = req.apiGateway.event.isBase64Encoded
      ? Buffer.from(raw, 'base64').toString('utf8')
      : raw;
  }
  next();
});

// Request logging in CloudWatch
app.use((req, _res, next) => {
  console.log(`[Lambda Request] ${req.method} ${req.originalUrl}`);
  next();
});

// API Routes
app.use('/api', createApiRouter());

// Mock Webhook Receiver direct aliases (ensures /payment, /orders, /inventory, /mock-webhooks/* work directly)
const mockReceiverController = new MockReceiverController();
const mockReceiverRouter = createMockReceiverRoutes(mockReceiverController);
app.use('/mock-webhooks', mockReceiverRouter);
app.use('/', mockReceiverRouter);

// Root path handler
app.get('/', (_req, res) => {
  res.json({
    name: 'WebhookGuard API (AWS Lambda)',
    tagline: 'Test every webhook. Catch failures before production.',
    status: 'online',
    runtime: 'AWS Lambda + API Gateway',
    version: '1.0.0',
    docs: '/api/health',
  });
});

// Error handling middleware
app.use(errorHandler);

// Export serverless handler
export const handler = serverlessExpress({ app });
