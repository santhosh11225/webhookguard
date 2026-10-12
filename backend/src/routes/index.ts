import { Router } from 'express';
import { SqliteEndpointRepository } from '../repositories/sqlite/endpoint.repository.js';
import { SqliteTestSuiteRepository } from '../repositories/sqlite/testSuite.repository.js';
import { SqliteTestRunRepository } from '../repositories/sqlite/testRun.repository.js';
import { SqliteTestResultRepository } from '../repositories/sqlite/testResult.repository.js';

import { DynamoDbEndpointRepository } from '../repositories/dynamodb/endpoint.dynamo.repo.js';
import { DynamoDbTestSuiteRepository } from '../repositories/dynamodb/testSuite.dynamo.repo.js';
import { DynamoDbTestRunRepository } from '../repositories/dynamodb/testRun.dynamo.repo.js';
import { DynamoDbTestResultRepository } from '../repositories/dynamodb/testResult.dynamo.repo.js';

import { IEndpointRepository } from '../repositories/interfaces/IEndpointRepository.js';
import { ITestSuiteRepository } from '../repositories/interfaces/ITestSuiteRepository.js';
import { ITestRunRepository } from '../repositories/interfaces/ITestRunRepository.js';
import { ITestResultRepository } from '../repositories/interfaces/ITestResultRepository.js';

import { EndpointService } from '../services/endpoint.service.js';
import { TestSuiteService } from '../services/testSuite.service.js';
import { TestRunnerService } from '../services/testRunner.service.js';
import { ReportService } from '../services/report.service.js';
import { AnalyticsService } from '../services/analytics.service.js';

import { EndpointController } from '../controllers/endpoint.controller.js';
import { TestSuiteController } from '../controllers/testSuite.controller.js';
import { TestRunController } from '../controllers/testRun.controller.js';
import { TestResultController } from '../controllers/testResult.controller.js';
import { ReportController } from '../controllers/report.controller.js';
import { AnalyticsController } from '../controllers/analytics.controller.js';
import { HealthController } from '../controllers/health.controller.js';
import { MockReceiverController } from '../controllers/mockReceiver.controller.js';

import { createEndpointRoutes } from './endpoint.routes.js';
import { createTestSuiteRoutes } from './testSuite.routes.js';
import { createTestRunRoutes } from './testRun.routes.js';
import { createTestResultRoutes } from './testResult.routes.js';
import { createReportRoutes } from './report.routes.js';
import { createAnalyticsRoutes } from './analytics.routes.js';
import { createHealthRoutes } from './health.routes.js';
import { createMockReceiverRoutes } from './mockReceiver.routes.js';
import { seedDatabase } from '../utils/seedData.js';
import { requireAdminAuth } from '../middleware/auth.js';

export function createApiRouter(): Router {
  const router = Router();

  const useDynamo =
    process.env.DB_PROVIDER === 'dynamodb' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

  // Initialize Repositories (cleanly abstracted behind interfaces)
  let endpointRepo: IEndpointRepository;
  let suiteRepo: ITestSuiteRepository;
  let runRepo: ITestRunRepository;
  let resultRepo: ITestResultRepository;

  if (useDynamo) {
    console.log('[Repositories] Initializing AWS DynamoDB Repositories');
    endpointRepo = new DynamoDbEndpointRepository();
    suiteRepo = new DynamoDbTestSuiteRepository();
    runRepo = new DynamoDbTestRunRepository();
    resultRepo = new DynamoDbTestResultRepository();
  } else {
    console.log('[Repositories] Initializing SQLite Repositories');
    endpointRepo = new SqliteEndpointRepository();
    suiteRepo = new SqliteTestSuiteRepository();
    runRepo = new SqliteTestRunRepository();
    resultRepo = new SqliteTestResultRepository();
  }

  // Initialize Business Services
  const endpointService = new EndpointService(endpointRepo);
  const suiteService = new TestSuiteService(suiteRepo, endpointRepo);
  const testRunnerService = new TestRunnerService(endpointRepo, suiteRepo, runRepo, resultRepo);
  const reportService = new ReportService(runRepo, resultRepo, endpointRepo, suiteRepo);
  const analyticsService = new AnalyticsService(endpointRepo, suiteRepo, runRepo, resultRepo);

  // Initialize Controllers
  const endpointController = new EndpointController(endpointService);
  const suiteController = new TestSuiteController(suiteService);
  const runController = new TestRunController(testRunnerService, runRepo);
  const resultController = new TestResultController(resultRepo);
  const reportController = new ReportController(reportService);
  const analyticsController = new AnalyticsController(analyticsService);
  const healthController = new HealthController();
  const mockReceiverController = new MockReceiverController();


  // Mount Routes
  router.use('/health', createHealthRoutes(healthController));
  router.use('/mock-webhooks', createMockReceiverRoutes(mockReceiverController));

  // Protected Management Routes
  router.use('/endpoints', requireAdminAuth, createEndpointRoutes(endpointController));
  router.use('/test-suites', requireAdminAuth, createTestSuiteRoutes(suiteController));
  router.use('/test-runs', requireAdminAuth, createTestRunRoutes(runController));
  router.use('/test-results', requireAdminAuth, createTestResultRoutes(resultController));
  router.use('/reports', requireAdminAuth, createReportRoutes(reportController));
  router.use('/analytics', requireAdminAuth, createAnalyticsRoutes(analyticsController));

  // Seed endpoint for manual or frontend trigger (protected)
  router.post('/seed', requireAdminAuth, async (req, res, next) => {
    try {
      const port = parseInt(process.env.PORT || '4000', 10);
      await seedDatabase(endpointRepo, suiteRepo, runRepo, resultRepo, port);
      res.json({ success: true, message: 'Database seeded with sample data successfully' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
