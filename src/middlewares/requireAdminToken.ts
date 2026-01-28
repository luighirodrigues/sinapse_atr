import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export const requireAdminToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('x-admin-token');
  
  if (token === env.ADMIN_TOKEN) {
    return next();
  }

  res.status(401).json({ error: 'unauthorized' });
};
