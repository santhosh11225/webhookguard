import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller.js';

export function createAnalyticsRoutes(controller: AnalyticsController): Router {
  const router = Router();

  router.get('/', controller.getDashboard);
  router.get('/dashboard', controller.getDashboard);

  return router;
}
