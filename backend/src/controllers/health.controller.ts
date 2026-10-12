import { Request, Response } from 'express';

export class HealthController {
  check = (_req: Request, res: Response): void => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'WebhookGuard API Engine',
      version: '1.0.0',
      uptime: process.uptime(),
      demoMode: process.env.DEMO_MODE === 'true',
    });
  };
}
