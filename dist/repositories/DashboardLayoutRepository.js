"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardLayoutRepository = exports.TENANT_DEFAULT_LAYOUT_KEY = void 0;
exports.buildUserLayoutKey = buildUserLayoutKey;
const client_1 = require("@prisma/client");
const client_2 = require("../prisma/client");
exports.TENANT_DEFAULT_LAYOUT_KEY = 'TENANT_DEFAULT';
function buildUserLayoutKey(userId) {
    return `USER:${userId}`;
}
class DashboardLayoutRepository {
    async findTenantDefault(clientId) {
        return client_2.prisma.dashboardLayout.findUnique({
            where: {
                clientId_layoutKey: {
                    clientId,
                    layoutKey: exports.TENANT_DEFAULT_LAYOUT_KEY,
                },
            },
        });
    }
    async upsertTenantDefault(clientId, layout) {
        return client_2.prisma.dashboardLayout.upsert({
            where: {
                clientId_layoutKey: {
                    clientId,
                    layoutKey: exports.TENANT_DEFAULT_LAYOUT_KEY,
                },
            },
            update: {
                scope: client_1.DashboardLayoutScope.TENANT_DEFAULT,
                userId: null,
                layout,
            },
            create: {
                clientId,
                layoutKey: exports.TENANT_DEFAULT_LAYOUT_KEY,
                scope: client_1.DashboardLayoutScope.TENANT_DEFAULT,
                userId: null,
                layout,
            },
        });
    }
    async findUserLayout(clientId, userId) {
        return client_2.prisma.dashboardLayout.findUnique({
            where: {
                clientId_layoutKey: {
                    clientId,
                    layoutKey: buildUserLayoutKey(userId),
                },
            },
        });
    }
    async upsertUserLayout(clientId, userId, layout) {
        const layoutKey = buildUserLayoutKey(userId);
        return client_2.prisma.dashboardLayout.upsert({
            where: {
                clientId_layoutKey: {
                    clientId,
                    layoutKey,
                },
            },
            update: {
                scope: client_1.DashboardLayoutScope.USER,
                userId,
                layout,
            },
            create: {
                clientId,
                layoutKey,
                scope: client_1.DashboardLayoutScope.USER,
                userId,
                layout,
            },
        });
    }
    async deleteUserLayout(clientId, userId) {
        await client_2.prisma.dashboardLayout.deleteMany({
            where: {
                clientId,
                layoutKey: buildUserLayoutKey(userId),
            },
        });
    }
}
exports.DashboardLayoutRepository = DashboardLayoutRepository;
