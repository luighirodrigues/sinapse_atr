import { Request, Response } from 'express';
import { isAllowedKpiKey } from '../config/kpiRegistry';
import { DashboardConfigService } from '../services/dashboard/DashboardConfigService';
import { resolveClientOrThrow, sendClientResolutionError } from '../services/tenants/resolveClientOrThrow';

type AdminKpiInput = {
  kpiKey: string;
  isAllowed: boolean;
  defaultVisible: boolean;
  defaultConfig: unknown | null;
  locked: boolean;
};

export class AdminDashboardController {
  private dashboardService = new DashboardConfigService();

  async getClientKpis(req: Request, res: Response) {
    try {
      const client = await resolveClientOrThrow({ clientSlug: getParam(req.params.clientSlug) });
      return this.handleGetClientKpis(client, res);
    } catch (error) {
      if (sendClientResolutionError(error, res)) return;
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getClientKpisById(req: Request, res: Response) {
    try {
      const client = await resolveClientOrThrow({ clientId: getParam(req.params.clientId) });
      return this.handleGetClientKpis(client, res);
    } catch (error) {
      if (sendClientResolutionError(error, res)) return;
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async putClientKpis(req: Request, res: Response) {
    try {
      const client = await resolveClientOrThrow({ clientSlug: getParam(req.params.clientSlug) });
      return this.handlePutClientKpis(client, req.body, res);
    } catch (error) {
      if (sendClientResolutionError(error, res)) return;
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async putClientKpisById(req: Request, res: Response) {
    try {
      const client = await resolveClientOrThrow({ clientId: getParam(req.params.clientId) });
      return this.handlePutClientKpis(client, req.body, res);
    } catch (error) {
      if (sendClientResolutionError(error, res)) return;
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async putTenantDefaultLayout(req: Request, res: Response) {
    try {
      const client = await resolveClientOrThrow({ clientSlug: getParam(req.params.clientSlug) });
      return this.handlePutTenantDefaultLayout(client, req.body, res);
    } catch (error) {
      if (sendClientResolutionError(error, res)) return;
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async putTenantDefaultLayoutById(req: Request, res: Response) {
    try {
      const client = await resolveClientOrThrow({ clientId: getParam(req.params.clientId) });
      return this.handlePutTenantDefaultLayout(client, req.body, res);
    } catch (error) {
      if (sendClientResolutionError(error, res)) return;
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleGetClientKpis(
    client: { id: string; slug: string; name: string },
    res: Response
  ) {
    const response = await this.dashboardService.getAdminKpis(client.id);
    return res.json({
      ...response,
      clientId: response.clientId ?? client.id,
      client: { id: client.id, slug: client.slug, name: client.name },
    });
  }

  private async handlePutClientKpis(
    client: { id: string; slug: string; name: string },
    body: unknown,
    res: Response
  ) {
    const parsed = parseBulkKpiPayload(body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    await this.dashboardService.bulkUpsertAdminKpis(client.id, parsed.kpis);
    const response = await this.dashboardService.getAdminKpis(client.id);
    return res.json({
      ...response,
      clientId: response.clientId ?? client.id,
      client: { id: client.id, slug: client.slug, name: client.name },
    });
  }

  private async handlePutTenantDefaultLayout(
    client: { id: string; slug: string; name: string },
    body: unknown,
    res: Response
  ) {
    const layoutPayload = parseLayoutPayload(body);
    if (!layoutPayload.ok) return res.status(400).json({ error: layoutPayload.error });

    const layout = await this.dashboardService.saveTenantDefaultLayout(client.id, layoutPayload.layout);
    return res.json({
      clientId: client.id,
      client: { id: client.id, slug: client.slug, name: client.name },
      layout,
    });
  }
}

function getParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function parseBulkKpiPayload(body: unknown): { ok: true; kpis: AdminKpiInput[] } | { ok: false; error: string } {
  if (!isPlainObject(body)) return { ok: false, error: 'Invalid body: expected object' };
  if (!hasOnlyKeys(body, ['kpis'])) return { ok: false, error: 'Unexpected body fields' };
  if (!Array.isArray(body.kpis)) return { ok: false, error: 'Invalid body: kpis must be array' };

  const kpis: AdminKpiInput[] = [];
  for (const raw of body.kpis) {
    if (!isPlainObject(raw)) return { ok: false, error: 'Invalid kpi item: expected object' };
    if (!hasOnlyKeys(raw, ['kpiKey', 'isAllowed', 'defaultVisible', 'defaultConfig', 'locked'])) {
      return { ok: false, error: 'Invalid kpi item: unexpected fields' };
    }

    const kpiKey = typeof raw.kpiKey === 'string' ? raw.kpiKey.trim() : '';
    if (!isAllowedKpiKey(kpiKey)) {
      return { ok: false, error: `Invalid kpiKey: ${String(raw.kpiKey ?? '')}` };
    }
    if (typeof raw.isAllowed !== 'boolean') return { ok: false, error: `Invalid isAllowed for ${kpiKey}` };
    if (typeof raw.defaultVisible !== 'boolean') return { ok: false, error: `Invalid defaultVisible for ${kpiKey}` };
    if (typeof raw.locked !== 'boolean') return { ok: false, error: `Invalid locked for ${kpiKey}` };

    kpis.push({
      kpiKey,
      isAllowed: raw.isAllowed,
      defaultVisible: raw.defaultVisible,
      defaultConfig: Object.prototype.hasOwnProperty.call(raw, 'defaultConfig') ? raw.defaultConfig : null,
      locked: raw.locked,
    });
  }

  return { ok: true, kpis };
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
