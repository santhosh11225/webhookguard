import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service.js';

export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  getDashboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.analyticsService.getDashboardAnalytics();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
