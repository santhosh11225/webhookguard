import { Router } from 'express';
import { TestRunController } from '../controllers/testRun.controller.js';

export function createTestRunRoutes(controller: TestRunController): Router {
  const router = Router();

  router.get('/', controller.getAll);
  router.post('/', controller.createRun);
  router.get('/:id', controller.getById);

  return router;
}
