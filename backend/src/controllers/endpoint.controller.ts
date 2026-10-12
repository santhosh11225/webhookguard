import { Request, Response, NextFunction } from 'express';
import { EndpointService } from '../services/endpoint.service.js';

export class EndpointController {
  constructor(private endpointService: EndpointService) {}

  getAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const endpoints = await this.endpointService.findAll();
      res.json({ success: true, data: endpoints });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const endpoint = await this.endpointService.findById(req.params.id);
      if (!endpoint) {
        res.status(404).json({ success: false, error: 'Endpoint not found' });
        return;
      }
      res.json({ success: true, data: endpoint });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const endpoint = await this.endpointService.create(req.body);
      res.status(201).json({ success: true, data: endpoint });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const endpoint = await this.endpointService.update(req.params.id, req.body);
      if (!endpoint) {
        res.status(404).json({ success: false, error: 'Endpoint not found' });
        return;
      }
      res.json({ success: true, data: endpoint });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deleted = await this.endpointService.delete(req.params.id);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Endpoint not found' });
        return;
      }
      res.json({ success: true, message: 'Endpoint deleted successfully' });
    } catch (err) {
      next(err);
    }
  };
}
