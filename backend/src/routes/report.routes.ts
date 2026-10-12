import { Router } from 'express';
import { ReportController } from '../controllers/report.controller.js';

export function createReportRoutes(controller: ReportController): Router {
  const router = Router();

  router.get('/:runId', controller.getRunReport);

  return router;
}
