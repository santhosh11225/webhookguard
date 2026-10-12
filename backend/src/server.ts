import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createApiRouter } from './routes/index.js';
import { MockReceiverController } from './controllers/mockReceiver.controller.js';
import { createMockReceiverRoutes } from './routes/mockReceiver.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getDatabase } from './repositories/sqlite/database.js';
import { SqliteEndpointRepository } from './repositories/sqlite/endpoint.repository.js';
import { SqliteTestSuiteRepository } from './repositories/sqlite/testSuite.repository.js';
import { SqliteTestRunRepository } from './repositories/sqlite/testRun.repository.js';
import { SqliteTestResultRepository } from './repositories/sqlite/testResult.repository.js';
import { seedDatabase } from './utils/seedData.js';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '4000', 10);
const isDemoMode = process.env.DEMO_MODE === 'true';

// Middleware
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Signature', 'X-API-Key', 'X-Signature-Header', 'X-Requested-With'],
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

// Request logger
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// API Routes
app.use('/api', createApiRouter());

// Mock Webhook Receiver direct aliases (ensures /payment, /orders, /mock-webhooks/* work directly)
const mockReceiverController = new MockReceiverController();
const mockReceiverRouter = createMockReceiverRoutes(mockReceiverController);
app.use('/mock-webhooks', mockReceiverRouter);
app.use('/', mockReceiverRouter);

// Root health & welcome
app.get('/', (_req, res) => {
  res.json({
    name: 'WebhookGuard API',
    tagline: 'Test every webhook. Catch failures before production.',
    status: 'online',
    version: '1.0.0',
    docs: '/api/health',
    endpoints: '/api/endpoints',
    mockReceiver: {
      payment: '/payment (or /api/mock-webhooks/payment)',
      orders: '/orders (or /api/mock-webhooks/orders)',
      inventory: '/inventory (or /api/mock-webhooks/inventory)',
      health: '/api/mock-webhooks/health',
    },
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize DB and Auto-Seed
async function bootstrap() {
  try {
    getDatabase(); // Initialize schema

    const endpointRepo = new SqliteEndpointRepository();
    const suiteRepo = new SqliteTestSuiteRepository();
    const runRepo = new SqliteTestRunRepository();
    const resultRepo = new SqliteTestResultRepository();

    // Auto-seed if database is new or heal existing endpoint URLs to active port
    await seedDatabase(endpointRepo, suiteRepo, runRepo, resultRepo, port);

    app.listen(port, () => {
      console.log(`
=====================================================
  🛡️  WebhookGuard Backend Server Running
  URL:           http://localhost:${port}
  Health:        http://localhost:${port}/api/health
  API Docs:      http://localhost:${port}/api/endpoints
  Mock Receiver: http://localhost:${port}/api/mock-webhooks/payment
                 (also listening at http://localhost:${port}/payment)
  Mock Health:   http://localhost:${port}/api/mock-webhooks/health
  Demo Mode:     ${isDemoMode ? 'ENABLED (preloaded fixtures)' : 'LIVE (actual HTTP testing)'}
=====================================================
      `);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
