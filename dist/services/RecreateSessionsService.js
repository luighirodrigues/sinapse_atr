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
        console.log('Starting daily rebuild for tickets with new messages...');
        // 1. Find imported trackings that need rebuild
        // We look for trackings where the parent ticket has received messages AFTER the last rebuild
        // OR where lastRebuildMessageCreatedAt is null.
        // We focus on "weak" trackings (no external start/end) as per requirements.
        // We fetch trackings that are "weak" and include the ticket to check dates in JS.
        const candidates = await client_1.prisma.importedTracking.findMany({
            where: {
                startedAtExternal: null,
                endedAtExternal: null,
                ticket: {
                    lastImportedMessageCreatedAt: { not: null }
                }
            },
            include: {
                ticket: {
                    select: { lastImportedMessageCreatedAt: true }
                }
            }
        });
        // Cast to any to access lastRebuildMessageCreatedAt if types are not regenerated
        const toProcess = candidates.filter((t) => {
            if (!t.ticket || !t.ticket.lastImportedMessageCreatedAt)
                return false;
            if (!t.lastRebuildMessageCreatedAt)
                return true;
            return new Date(t.ticket.lastImportedMessageCreatedAt) > new Date(t.lastRebuildMessageCreatedAt);
        });
        console.log(`Found ${toProcess.length} weak trackings to process out of ${candidates.length} candidates.`);
        for (const tracking of toProcess) {
            try {
                // We pass the ticket's last message date to save it after processing
                await this.processTracking(tracking, tracking.ticket.lastImportedMessageCreatedAt);
                console.log(`Processed tracking ${tracking.id} successfully.`);
            }
            catch (e) {
                console.error(`Error processing tracking ${tracking.id}:`, e);
            }
        }
    }
    async processTracking(tracking, ticketLastMsgDate) {
        await client_1.prisma.$transaction(async (tx) => {
            // 1. Idempotency: Clear previous sessions/links for this tracking
            // Ensure we only touch sessions created by recreation logic for this tracking
            const existingSessions = await tx.session.findMany({
                where: {
                    originImportedTrackingId: tracking.id
                }
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
                    data: {
                        processedAt: new Date(),
                        processingVersion: 'v1-gap24h-empty',
                        lastRebuildMessageCreatedAt: ticketLastMsgDate
                    }
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
            const now = new Date();
            for (const group of groups) {
                const startMsg = group[0];
                const endMsg = group[group.length - 1];
                const endedAt = new Date(endMsg.createdAtExternal);
                // RULE: Closed only if 24h passed since endedAt
                const isClosed = now.getTime() >= endedAt.getTime() + 24 * 60 * 60 * 1000;
                // Determine type
                const type = isClosed ? client_2.SessionType.CLOSED : client_2.SessionType.OPEN_REAL;
                const session = await tx.session.create({
                    data: {
                        ticketId: tracking.ticketId,
                        type: type,
                        startedAt: startMsg.createdAtExternal,
                        endedAt: endedAt,
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
                data: {
                    processedAt: new Date(),
                    processingVersion: 'v1-gap24h',
                    lastRebuildMessageCreatedAt: ticketLastMsgDate
                }
            });
        }, {
            timeout: 20000
        });
    }
}
exports.RecreateSessionsService = RecreateSessionsService;
