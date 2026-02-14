import { Request } from 'express';

const DEFAULT_DASHBOARD_USER_ID = 'authorized_frontend_user';

export function resolveDashboardUserId(_req: Request): string {
  return DEFAULT_DASHBOARD_USER_ID;
}
