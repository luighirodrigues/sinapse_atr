import { Prisma } from '@prisma/client';
import { KPI_REGISTRY, getKpiRegistryByKey } from '../../config/kpiRegistry';
import { DashboardLayoutRepository } from '../../repositories/DashboardLayoutRepository';
import { TenantKpiRepository, TenantKpiUpsertInput } from '../../repositories/TenantKpiRepository';
import { sanitizeLayout } from './layoutSanitizer';
import { mergeLayout } from './mergeLayout';
import { AllowedKpiConfig, DashboardLayoutDoc } from './types';

type AdminKpiPayload = {
  kpiKey: string;
  isAllowed: boolean;
  defaultVisible: boolean;
  defaultConfig: unknown | null;
  locked: boolean;
};

type DashboardConfigResponse = {
  clientId: string;
  allowedKpis: Array<{
    kpiKey: string;
    defaultVisible: boolean;
    defaultConfig: unknown | null;
    locked: boolean;
  }>;
  tenantDefaultLayout: DashboardLayoutDoc | null;
  userLayout: DashboardLayoutDoc | null;
  effectiveLayout: DashboardLayoutDoc;
};

export class DashboardConfigService {
  private tenantKpiRepo = new TenantKpiRepository();
  private layoutRepo = new DashboardLayoutRepository();

  async getAdminKpis(clientId: string) {
    const rows = await this.tenantKpiRepo.listByClient(clientId);
    const byKey = new Map(rows.map((row) => [row.kpiKey, row]));
    const kpis = KPI_REGISTRY.map((item) => {
      const row = byKey.get(item.kpiKey);
      return {
        kpiKey: item.kpiKey,
        isAllowed: row?.isAllowed ?? false,
        defaultVisible: row?.defaultVisible ?? true,
        defaultConfig: row?.defaultConfig ?? null,
        locked: row?.locked ?? false,
        updatedAt: row?.updatedAt?.toISOString() ?? null,
      };
    });

    return { clientId, kpis };
  }

  async bulkUpsertAdminKpis(clientId: string, payload: AdminKpiPayload[]): Promise<void> {
    const items: TenantKpiUpsertInput[] = payload.map((item) => ({
      kpiKey: item.kpiKey,
      isAllowed: item.isAllowed,
      defaultVisible: item.defaultVisible,
      defaultConfig: toInputJson(item.defaultConfig),
      locked: item.locked,
    }));
    await this.tenantKpiRepo.bulkUpsert(clientId, items);
  }

  async saveTenantDefaultLayout(clientId: string, layout: unknown): Promise<DashboardLayoutDoc> {
    const sanitized = sanitizeLayout(layout);
    await this.layoutRepo.upsertTenantDefault(clientId, sanitized as Prisma.InputJsonValue);
    return sanitized;
  }

  async getDashboardConfig(clientId: string, userId: string | null): Promise<DashboardConfigResponse> {
    const [allowedRows, tenantDefaultRow, userRow] = await Promise.all([
      this.tenantKpiRepo.listAllowedByClient(clientId),
      this.layoutRepo.findTenantDefault(clientId),
      userId ? this.layoutRepo.findUserLayout(clientId, userId) : Promise.resolve(null),
    ]);

    const allowedKpis: AllowedKpiConfig[] = allowedRows.map((row) => ({
      kpiKey: row.kpiKey,
      defaultVisible: row.defaultVisible,
      defaultConfig: row.defaultConfig ?? null,
      locked: row.locked,
      defaultOrder: getKpiRegistryByKey(row.kpiKey)?.defaultOrder ?? 9999,
    }));
    const tenantDefaultLayout = tenantDefaultRow ? sanitizeLayout(tenantDefaultRow.layout) : null;
    const userLayout = userRow ? sanitizeLayout(userRow.layout) : null;
    const effectiveLayout = mergeLayout({
      tenantDefaultLayout,
      userLayout,
      allowedKpis,
    });

    return {
      clientId,
      allowedKpis: allowedKpis.map((item) => ({
        kpiKey: item.kpiKey,
        defaultVisible: item.defaultVisible,
        defaultConfig: item.defaultConfig,
        locked: item.locked,
      })),
      tenantDefaultLayout,
      userLayout,
      effectiveLayout,
    };
  }

  async saveUserLayout(clientId: string, userId: string, layout: unknown): Promise<DashboardLayoutDoc> {
    const [allowedRows, tenantDefaultRow] = await Promise.all([
      this.tenantKpiRepo.listAllowedByClient(clientId),
      this.layoutRepo.findTenantDefault(clientId),
    ]);

    const allowedKpis: AllowedKpiConfig[] = allowedRows.map((row) => ({
      kpiKey: row.kpiKey,
      defaultVisible: row.defaultVisible,
      defaultConfig: row.defaultConfig ?? null,
      locked: row.locked,
      defaultOrder: getKpiRegistryByKey(row.kpiKey)?.defaultOrder ?? 9999,
    }));
    const allowedKeys = new Set(allowedKpis.map((item) => item.kpiKey));
    const sanitizedInput = sanitizeLayout(layout, { allowedKpiKeys: allowedKeys });
    const persistedLayout = this.sanitizeUserLayoutForPersistence(sanitizedInput, allowedKpis);

    await this.layoutRepo.upsertUserLayout(clientId, userId, persistedLayout as Prisma.InputJsonValue);
    return persistedLayout;
  }

  async resetUserLayout(clientId: string, userId: string): Promise<DashboardConfigResponse> {
    await this.layoutRepo.deleteUserLayout(clientId, userId);
    return this.getDashboardConfig(clientId, userId);
  }

  private sanitizeUserLayoutForPersistence(userLayout: DashboardLayoutDoc, allowedKpis: AllowedKpiConfig[]): DashboardLayoutDoc {
    const allowedKeys = new Set(allowedKpis.map((item) => item.kpiKey));
    const lockedKeys = new Set(allowedKpis.filter((item) => item.locked).map((item) => item.kpiKey));

    const order = dedupe(
      userLayout.order.filter((kpiKey) => allowedKeys.has(kpiKey) && !lockedKeys.has(kpiKey))
    );
    const hidden = dedupe(
      userLayout.hidden.filter((kpiKey) => allowedKeys.has(kpiKey) && !lockedKeys.has(kpiKey))
    );
    const configOverrides: Record<string, unknown> = {};
    for (const [kpiKey, value] of Object.entries(userLayout.configOverrides ?? {})) {
      if (!allowedKeys.has(kpiKey)) continue;
      if (lockedKeys.has(kpiKey)) continue;
      configOverrides[kpiKey] = value;
    }

    return {
      version: 1,
      type: 'ORDER',
      order,
      hidden,
      configOverrides,
    };
  }
}

function toInputJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}
