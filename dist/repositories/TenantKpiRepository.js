"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantKpiRepository = void 0;
const client_1 = require("../prisma/client");
class TenantKpiRepository {
    async listByClient(clientId) {
        return client_1.prisma.tenantKpi.findMany({
            where: { clientId },
            orderBy: { kpiKey: 'asc' },
        });
    }
    async listAllowedByClient(clientId) {
        return client_1.prisma.tenantKpi.findMany({
            where: { clientId, isAllowed: true },
            orderBy: { kpiKey: 'asc' },
        });
    }
    async bulkUpsert(clientId, items) {
        if (!items.length)
            return;
        await client_1.prisma.$transaction(items.map((item) => client_1.prisma.tenantKpi.upsert({
            where: {
                clientId_kpiKey: {
                    clientId,
                    kpiKey: item.kpiKey,
                },
            },
            update: {
                isAllowed: item.isAllowed,
                defaultVisible: item.defaultVisible,
                defaultConfig: item.defaultConfig,
                locked: item.locked,
            },
            create: {
                clientId,
                kpiKey: item.kpiKey,
                isAllowed: item.isAllowed,
                defaultVisible: item.defaultVisible,
                defaultConfig: item.defaultConfig,
                locked: item.locked,
            },
        })));
    }
}
exports.TenantKpiRepository = TenantKpiRepository;
