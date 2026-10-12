import { Router } from 'express';
import { TestResultController } from '../controllers/testResult.controller.js';

export function createTestResultRoutes(controller: TestResultController): Router {
  const router = Router();

  router.get('/:runId', controller.getByRunId);
  router.get('/detail/:id', controller.getById);

  return router;
}
