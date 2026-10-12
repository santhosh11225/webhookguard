import { Request, Response, NextFunction } from 'express';
import { ITestResultRepository } from '../repositories/interfaces/ITestResultRepository.js';

export class TestResultController {
  constructor(private resultRepo: ITestResultRepository) {}

  getByRunId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const results = await this.resultRepo.findByRunId(req.params.runId);
      res.json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.resultRepo.findById(req.params.id);
      if (!result) {
        res.status(404).json({ success: false, error: 'Test result not found' });
        return;
      }
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}
