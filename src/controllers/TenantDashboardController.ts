import { Request, Response } from 'express';
import { DashboardConfigService } from '../services/dashboard/DashboardConfigService';
import { resolveDashboardUserId } from '../services/dashboard/resolveDashboardUserId';
import { resolveClientOrThrow, sendClientResolutionError } from '../services/tenants/resolveClientOrThrow';

export class TenantDashboardController {
  private dashboardService = new DashboardConfigService();

  async getDashboardConfig(req: Request, res: Response) {
    try {
      const client = await resolveClientOrThrow({ clientSlug: getParam(req.params.clientSlug) });
      return this.handleGetDashboardConfig(client, req, res);
    } catch (error) {
      if (sendClientResolutionError(error, res)) return;
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getDashboardConfigById(req: Request, res: Response) {
    try {
      const client = await resolveClientOrThrow({ clientId: getParam(req.params.clientId) });
      return this.handleGetDashboardConfig(client, req, res);
    } catch (error) {
      if (sendClientResolutionError(error, res)) return;
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async putUserLayout(req: Request, res: Response) {
    try {
      const client = await resolveClientOrThrow({ clientSlug: getParam(req.params.clientSlug) });
      return this.handlePutUserLayout(client, req, res);
    } catch (error) {
      if (sendClientResolutionError(error, res)) return;
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async putUserLayoutById(req: Request, res: Response) {
    try {
      const client = await resolveClientOrThrow({ clientId: getParam(req.params.clientId) });
      return this.handlePutUserLayout(client, req, res);
    } catch (error) {
      if (sendClientResolutionError(error, res)) return;
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async resetUserLayout(req: Request, res: Response) {
    try {
      const client = await resolveClientOrThrow({ clientSlug: getParam(req.params.clientSlug) });
      return this.handleResetUserLayout(client, req, res);
    } catch (error) {
      if (sendClientResolutionError(error, res)) return;
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async resetUserLayoutById(req: Request, res: Response) {
    try {
      const client = await resolveClientOrThrow({ clientId: getParam(req.params.clientId) });
      return this.handleResetUserLayout(client, req, res);
    } catch (error) {
      if (sendClientResolutionError(error, res)) return;
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleGetDashboardConfig(
    client: { id: string; slug: string; name: string },
    req: Request,
    res: Response
  ) {
    const userId = resolveDashboardUserId(req);
    const config = await this.dashboardService.getDashboardConfig(client.id, userId);
    return res.json({
      ...config,
      clientId: config.clientId ?? client.id,
      client: { id: client.id, slug: client.slug, name: client.name },
    });
  }

  private async handlePutUserLayout(
    client: { id: string; slug: string; name: string },
    req: Request,
    res: Response
  ) {
    const userId = resolveDashboardUserId(req);
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const layoutPayload = parseLayoutPayload(req.body);
    if (!layoutPayload.ok) return res.status(400).json({ error: layoutPayload.error });

    await this.dashboardService.saveUserLayout(client.id, userId, layoutPayload.layout);
    const config = await this.dashboardService.getDashboardConfig(client.id, userId);
    return res.json({
      ...config,
      clientId: config.clientId ?? client.id,
      client: { id: client.id, slug: client.slug, name: client.name },
    });
  }

  private async handleResetUserLayout(
    client: { id: string; slug: string; name: string },
    req: Request,
    res: Response
  ) {
    const userId = resolveDashboardUserId(req);
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const config = await this.dashboardService.resetUserLayout(client.id, userId);
    return res.json({
      ...config,
      clientId: config.clientId ?? client.id,
      client: { id: client.id, slug: client.slug, name: client.name },
    });
  }
}

function getParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function parseLayoutPayload(body: unknown): { ok: true; layout: unknown } | { ok: false; error: string } {
  if (!isPlainObject(body)) return { ok: false, error: 'Invalid body: expected object' };
  if (!hasOnlyKeys(body, ['layout'])) return { ok: false, error: 'Unexpected body fields' };
  if (!Object.prototype.hasOwnProperty.call(body, 'layout')) {
    return { ok: false, error: 'Missing body field: layout' };
  }
  return { ok: true, layout: body.layout };
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, any>, allowedKeys: string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}
