"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardConfigService = void 0;
const client_1 = require("@prisma/client");
const kpiRegistry_1 = require("../../config/kpiRegistry");
const DashboardLayoutRepository_1 = require("../../repositories/DashboardLayoutRepository");
const TenantKpiRepository_1 = require("../../repositories/TenantKpiRepository");
const layoutSanitizer_1 = require("./layoutSanitizer");
const mergeLayout_1 = require("./mergeLayout");
class DashboardConfigService {
    constructor() {
        this.tenantKpiRepo = new TenantKpiRepository_1.TenantKpiRepository();
        this.layoutRepo = new DashboardLayoutRepository_1.DashboardLayoutRepository();
    }
    async getAdminKpis(clientId) {
        const rows = await this.tenantKpiRepo.listByClient(clientId);
        const byKey = new Map(rows.map((row) => [row.kpiKey, row]));
        const kpis = kpiRegistry_1.KPI_REGISTRY.map((item) => {
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
    async bulkUpsertAdminKpis(clientId, payload) {
        const items = payload.map((item) => ({
            kpiKey: item.kpiKey,
            isAllowed: item.isAllowed,
            defaultVisible: item.defaultVisible,
            defaultConfig: toInputJson(item.defaultConfig),
            locked: item.locked,
        }));
        await this.tenantKpiRepo.bulkUpsert(clientId, items);
    }
    async saveTenantDefaultLayout(clientId, layout) {
        const sanitized = (0, layoutSanitizer_1.sanitizeLayout)(layout);
        await this.layoutRepo.upsertTenantDefault(clientId, sanitized);
        return sanitized;
    }
    async getDashboardConfig(clientId, userId) {
        const [allowedRows, tenantDefaultRow, userRow] = await Promise.all([
            this.tenantKpiRepo.listAllowedByClient(clientId),
            this.layoutRepo.findTenantDefault(clientId),
            userId ? this.layoutRepo.findUserLayout(clientId, userId) : Promise.resolve(null),
        ]);
        const allowedKpis = allowedRows.map((row) => ({
            kpiKey: row.kpiKey,
            defaultVisible: row.defaultVisible,
            defaultConfig: row.defaultConfig ?? null,
            locked: row.locked,
            defaultOrder: (0, kpiRegistry_1.getKpiRegistryByKey)(row.kpiKey)?.defaultOrder ?? 9999,
        }));
        const tenantDefaultLayout = tenantDefaultRow ? (0, layoutSanitizer_1.sanitizeLayout)(tenantDefaultRow.layout) : null;
        const userLayout = userRow ? (0, layoutSanitizer_1.sanitizeLayout)(userRow.layout) : null;
        const effectiveLayout = (0, mergeLayout_1.mergeLayout)({
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
    async saveUserLayout(clientId, userId, layout) {
        const [allowedRows, tenantDefaultRow] = await Promise.all([
            this.tenantKpiRepo.listAllowedByClient(clientId),
            this.layoutRepo.findTenantDefault(clientId),
        ]);
        const allowedKpis = allowedRows.map((row) => ({
            kpiKey: row.kpiKey,
            defaultVisible: row.defaultVisible,
            defaultConfig: row.defaultConfig ?? null,
            locked: row.locked,
            defaultOrder: (0, kpiRegistry_1.getKpiRegistryByKey)(row.kpiKey)?.defaultOrder ?? 9999,
        }));
        const allowedKeys = new Set(allowedKpis.map((item) => item.kpiKey));
        const sanitizedInput = (0, layoutSanitizer_1.sanitizeLayout)(layout, { allowedKpiKeys: allowedKeys });
        const persistedLayout = this.sanitizeUserLayoutForPersistence(sanitizedInput, allowedKpis);
        await this.layoutRepo.upsertUserLayout(clientId, userId, persistedLayout);
        return persistedLayout;
    }
    async resetUserLayout(clientId, userId) {
        await this.layoutRepo.deleteUserLayout(clientId, userId);
        return this.getDashboardConfig(clientId, userId);
    }
    sanitizeUserLayoutForPersistence(userLayout, allowedKpis) {
        const allowedKeys = new Set(allowedKpis.map((item) => item.kpiKey));
        const lockedKeys = new Set(allowedKpis.filter((item) => item.locked).map((item) => item.kpiKey));
        const order = dedupe(userLayout.order.filter((kpiKey) => allowedKeys.has(kpiKey) && !lockedKeys.has(kpiKey)));
        const hidden = dedupe(userLayout.hidden.filter((kpiKey) => allowedKeys.has(kpiKey) && !lockedKeys.has(kpiKey)));
        const configOverrides = {};
        for (const [kpiKey, value] of Object.entries(userLayout.configOverrides ?? {})) {
            if (!allowedKeys.has(kpiKey))
                continue;
            if (lockedKeys.has(kpiKey))
                continue;
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
exports.DashboardConfigService = DashboardConfigService;
function toInputJson(value) {
    if (value === null || value === undefined)
        return client_1.Prisma.DbNull;
    return value;
}
function dedupe(list) {
    const seen = new Set();
    const out = [];
    for (const item of list) {
        if (seen.has(item))
            continue;
        seen.add(item);
        out.push(item);
    }
    return out;
}
