"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecreateSessionsService = void 0;
const ImportedTrackingRepository_1 = require("../repositories/ImportedTrackingRepository");
const client_1 = require("../prisma/client");
const client_2 = require("@prisma/client");
class RecreateSessionsService {
    constructor() {
        this.importedTrackingRepo = new ImportedTrackingRepository_1.ImportedTrackingRepository();
    }
    async runRecreation() {
        const unprocessed = await this.importedTrackingRepo.findUnprocessedWeak();
        console.log(`Found ${unprocessed.length} weak trackings to process.`);
        for (const tracking of unprocessed) {
            try {
                await this.processTracking(tracking);
                console.log(`Processed tracking ${tracking.id} successfully.`);
            }
            catch (e) {
                console.error(`Error processing tracking ${tracking.id}:`, e);
            }
        }
    }
    async processTracking(tracking) {
        await client_1.prisma.$transaction(async (tx) => {
            // 1. Idempotency: Clear previous sessions/links for this tracking
            const existingSessions = await tx.session.findMany({
                where: { originImportedTrackingId: tracking.id }
            });
            if (existingSessions.length > 0) {
                const sessionIds = existingSessions.map(s => s.id);
                // Unlink messages
                await tx.message.updateMany({
                    where: { sessionId: { in: sessionIds } },
                    data: { sessionId: null }
                });
                // Delete sessions
                await tx.session.deleteMany({
                    where: { id: { in: sessionIds } }
                });
            }
            // 2. Fetch Messages
            const messages = await tx.message.findMany({
                where: {
                    ticketId: tracking.ticketId,
                    createdAtExternal: { gte: tracking.createdAtExternal }
                },
                orderBy: { createdAtExternal: 'asc' }
            });
            if (messages.length === 0) {
                await tx.importedTracking.update({
                    where: { id: tracking.id },
                    data: { processedAt: new Date(), processingVersion: 'v1-gap24h-empty' }
                });
                return;
            }
            // 3. Group Messages (Gap > 24h)
            const groups = [];
            let currentGroup = [];
            for (const msg of messages) {
                if (currentGroup.length === 0) {
                    currentGroup.push(msg);
                }
                else {
                    const lastMsg = currentGroup[currentGroup.length - 1];
                    const diff = new Date(msg.createdAtExternal).getTime() - new Date(lastMsg.createdAtExternal).getTime();
                    const hours = diff / (1000 * 60 * 60);
                    if (hours > 24) {
                        groups.push(currentGroup);
                        currentGroup = [msg];
                    }
                    else {
                        currentGroup.push(msg);
                    }
                }
            }
            if (currentGroup.length > 0)
                groups.push(currentGroup);
            // 4. Create Sessions and Link
            for (const group of groups) {
                const startMsg = group[0];
                const endMsg = group[group.length - 1];
                const session = await tx.session.create({
                    data: {
                        ticketId: tracking.ticketId,
                        type: client_2.SessionType.CLOSED,
                        startedAt: startMsg.createdAtExternal,
                        endedAt: endMsg.createdAtExternal,
                        source: 'recreated',
                        originImportedTrackingId: tracking.id,
                        processingVersion: 'v1-gap24h'
                    }
                });
                const messageIds = group.map(m => m.id);
                await tx.message.updateMany({
                    where: { id: { in: messageIds } },
                    data: { sessionId: session.id }
                });
            }
            // 5. Update ImportedTracking
            await tx.importedTracking.update({
                where: { id: tracking.id },
                data: { processedAt: new Date(), processingVersion: 'v1-gap24h' }
            });
        }, {
            timeout: 20000
        });
    }
}
exports.RecreateSessionsService = RecreateSessionsService;
