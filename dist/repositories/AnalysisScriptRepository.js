"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisScriptRepository = void 0;
const client_1 = require("../prisma/client");
class AnalysisScriptRepository {
    async create(input) {
        return client_1.prisma.analysisScript.create({
            data: {
                clientId: input.clientId,
                scriptKey: input.scriptKey,
                version: input.version,
                name: input.name,
                description: input.description ?? null,
                scriptText: input.scriptText,
                topics: input.topics,
                isActive: input.isActive,
            },
        });
    }
    async list(clientId, filter) {
        const where = { clientId };
        if (filter?.scriptKey)
            where.scriptKey = filter.scriptKey;
        if (filter?.activeOnly)
            where.isActive = true;
        return client_1.prisma.analysisScript.findMany({
            where,
            orderBy: [{ scriptKey: 'asc' }, { version: 'desc' }],
        });
    }
    async findByKeyVersion(clientId, scriptKey, version) {
        return client_1.prisma.analysisScript.findUnique({
            where: {
                clientId_scriptKey_version: {
                    clientId,
                    scriptKey,
                    version,
                },
            },
        });
    }
    async findActiveHighestVersion(clientId, scriptKey) {
        return client_1.prisma.analysisScript.findFirst({
            where: { clientId, scriptKey, isActive: true },
            orderBy: { version: 'desc' },
        });
    }
    async getNextVersion(clientId, scriptKey) {
        const row = await client_1.prisma.analysisScript.findFirst({
            where: { clientId, scriptKey },
            orderBy: { version: 'desc' },
            select: { version: true },
        });
        return (row?.version ?? 0) + 1;
    }
    async activate(clientId, scriptKey, version, deactivateOthers) {
        return client_1.prisma.$transaction(async (tx) => {
            const updated = await tx.analysisScript.updateMany({
                where: { clientId, scriptKey, version },
                data: { isActive: true, updatedAt: new Date() },
            });
            if (updated.count === 0)
                return { updated: 0 };
            if (deactivateOthers) {
                await tx.analysisScript.updateMany({
                    where: { clientId, scriptKey, version: { not: version } },
                    data: { isActive: false, updatedAt: new Date() },
                });
            }
            return { updated: updated.count };
        });
    }
}
exports.AnalysisScriptRepository = AnalysisScriptRepository;
