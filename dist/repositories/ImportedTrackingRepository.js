"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportedTrackingRepository = void 0;
const client_1 = require("../prisma/client");
class ImportedTrackingRepository {
    async upsertMany(trackings) {
        return client_1.prisma.$transaction(async (tx) => {
            const results = [];
            for (const tracking of trackings) {
                if (tracking.externalTrackingId !== null && tracking.externalTrackingId !== undefined) {
                    const existing = await tx.importedTracking.findFirst({
                        where: {
                            ticketId: tracking.ticketId,
                            externalTrackingId: tracking.externalTrackingId
                        }
                    });
                    if (existing) {
                        results.push(await tx.importedTracking.update({
                            where: { id: existing.id },
                            data: tracking
                        }));
                    }
                    else {
                        results.push(await tx.importedTracking.create({ data: tracking }));
                    }
                }
                else {
                    results.push(await tx.importedTracking.create({ data: tracking }));
                }
            }
            return results;
        });
    }
    async findUnprocessedWeak(limit = 100) {
        return client_1.prisma.importedTracking.findMany({
            where: {
                processedAt: null,
                startedAtExternal: null,
                endedAtExternal: null
            },
            take: limit,
            orderBy: { createdAtExternal: 'asc' }
        });
    }
    async markProcessed(id, version) {
        return client_1.prisma.importedTracking.update({
            where: { id },
            data: {
                processedAt: new Date(),
                processingVersion: version
            }
        });
    }
    async findByTicketId(ticketId) {
        return client_1.prisma.importedTracking.findMany({
            where: { ticketId },
            orderBy: { createdAtExternal: 'asc' }
        });
    }
}
exports.ImportedTrackingRepository = ImportedTrackingRepository;
