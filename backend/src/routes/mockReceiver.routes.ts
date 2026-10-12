import { Router } from 'express';
import { MockReceiverController } from '../controllers/mockReceiver.controller.js';

export function createMockReceiverRoutes(controller: MockReceiverController): Router {
  const router = Router();

  router.all('/payment', controller.handlePayment.bind(controller));
  router.all('/orders', controller.handleOrder.bind(controller));
  router.get('/health', controller.getHealth.bind(controller));
  router.post('/reset', controller.resetRetries.bind(controller));

  return router;
}
