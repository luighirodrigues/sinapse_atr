import { Request } from 'express';
import { env } from '../../config/env';

export function resolveDashboardUserId(req: Request): string | null {
  if (env.DASHBOARD_INSECURE_USER_HEADER !== 'true') {
    return null;
  }

  const value = req.header('x-user-id');
  if (!value) return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}
