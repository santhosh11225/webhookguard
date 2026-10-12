import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service.js';

export class ReportController {
  constructor(private reportService: ReportService) {}

  getRunReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = await this.reportService.generateRunReport(req.params.runId);
      res.json({ success: true, data: report });
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        res.status(404).json({ success: false, error: err.message });
      } else {
        next(err);
      }
    }
  };
}
