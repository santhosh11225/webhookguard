import { Router } from 'express';
import { CicdController } from '../controllers/cicd.controller.js';

export function createCicdRoutes(controller: CicdController): Router {
  const router = Router();

  router.post('/dispatch', controller.dispatch);
  router.get('/status', controller.getStatus);

  return router;
}
