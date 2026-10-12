import { Router } from 'express';
import { TestSuiteController } from '../controllers/testSuite.controller.js';

export function createTestSuiteRoutes(controller: TestSuiteController): Router {
  const router = Router();

  router.get('/', controller.getAll);
  router.post('/', controller.create);
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);

  return router;
}
