import express from 'express';
import cors from 'cors';
import serverlessExpress from '@vendia/serverless-express';
import { createApiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in CloudWatch
app.use((req, _res, next) => {
  console.log(`[Lambda Request] ${req.method} ${req.originalUrl}`);
  next();
});

// API Routes
app.use('/api', createApiRouter());

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
