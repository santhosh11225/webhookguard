import { Request, Response, NextFunction } from 'express';
import { TestSuiteService } from '../services/testSuite.service.js';

export class TestSuiteController {
  constructor(private suiteService: TestSuiteService) {}

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const endpointId = req.query.endpointId as string | undefined;
      let suites;
      if (endpointId) {
        suites = await this.suiteService.findByEndpointId(endpointId);
      } else {
        suites = await this.suiteService.findAll();
      }
      res.json({ success: true, data: suites });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suite = await this.suiteService.findById(req.params.id);
      if (!suite) {
        res.status(404).json({ success: false, error: 'Test Suite not found' });
        return;
      }
      res.json({ success: true, data: suite });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suite = await this.suiteService.create(req.body);
      res.status(201).json({ success: true, data: suite });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suite = await this.suiteService.update(req.params.id, req.body);
      if (!suite) {
        res.status(404).json({ success: false, error: 'Test Suite not found' });
        return;
      }
      res.json({ success: true, data: suite });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deleted = await this.suiteService.delete(req.params.id);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Test Suite not found' });
        return;
      }
      res.json({ success: true, message: 'Test Suite deleted successfully' });
    } catch (err) {
      next(err);
    }
  };
}
