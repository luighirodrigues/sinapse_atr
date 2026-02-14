import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export const requireDashboardWriteToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('x-dashboard-write-token');
  if (!token) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (token !== env.DASHBOARD_WRITE_TOKEN) {
    return res.status(403).json({ error: 'forbidden' });
  }

  return next();
};
