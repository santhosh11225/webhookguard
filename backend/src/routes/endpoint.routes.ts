import { Router } from 'express';
import { EndpointController } from '../controllers/endpoint.controller.js';

export function createEndpointRoutes(controller: EndpointController): Router {
  const router = Router();

  router.get('/', controller.getAll);
  router.post('/', controller.create);
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);

  return router;
}
