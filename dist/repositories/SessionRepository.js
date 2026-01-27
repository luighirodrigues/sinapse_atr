"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionRepository = void 0;
const client_1 = require("../prisma/client");
class SessionRepository {
    async upsertMany(sessions) {
        // Prisma doesn't support upsertMany directly. We use a transaction.
        // Optimization: createMany for new ones? But we need to handle updates.
        // For simplicity and safety (as volume per ticket isn't huge per run), we loop.
        return client_1.prisma.$transaction(sessions.map((session) => {
            // If externalTrackingId is present, we use it for uniqueness
            if (session.externalTrackingId) {
                return client_1.prisma.session.upsert({
                    where: {
                        ticketId_externalTrackingId: {
                            ticketId: session.ticketId,
                            externalTrackingId: session.externalTrackingId,
                        },
                    },
                    update: session,
                    create: session,
                });
            }
            else {
                // For sessions without externalTrackingId (e.g. merged weak sessions if we treat them so, 
                // but usually we pick one tracking ID or generate a custom ID?)
                // If the logic generates a session without externalTrackingId, we need a way to identify it.
                // For now, assume we might delete/recreate OPEN sessions or handle them specifically.
                // But if we just want to insert if not exists:
                // This part depends on how NormalizationService creates the payload.
                // Let's assume for now we only upsert those with externalTrackingId here, 
                // or we handle non-external ones differently.
                // However, the schema allows externalTrackingId to be null.
                // If it's null, we can't easily upsert unless we have a known ID.
                // For this implementation, I will assume we create them if no ID is provided (and they are new).
                // But to avoid duplicates on re-runs, we might need a strategy.
                // Strategy: The caller should handle cleanup of open sessions if needed.
                return client_1.prisma.session.create({ data: session });
            }
        }));
    }
    async listByTicket(ticketId) {
        return client_1.prisma.session.findMany({
            where: { ticketId },
            orderBy: { startedAt: 'asc' },
        });
    }
    async deleteOpenSessions(ticketId) {
        // Helper to clear open sessions before recalculating/reinserting if that's the strategy
        return client_1.prisma.session.deleteMany({
            where: {
                ticketId,
                type: { in: ['OPEN_REAL', 'OPEN_WEAK', 'UNTRACKED'] }, // Be careful with UNTRACKED?
            },
        });
    }
    // Clean way to sync open session: 
    // We might want to find the existing open session and update it, or delete and create.
    async syncOpenSession(ticketId, sessionData) {
        // Find existing open sessions
        const existing = await client_1.prisma.session.findMany({
            where: { ticketId, type: { in: ['OPEN_REAL', 'OPEN_WEAK'] } }
        });
        // Delete all existing open sessions
        // (Ideally we would keep the one that matches to preserve ID, but message reassignment handles ID change)
        if (existing.length > 0) {
            await client_1.prisma.session.deleteMany({
                where: { id: { in: existing.map(s => s.id) } }
            });
        }
        if (sessionData) {
            return client_1.prisma.session.create({ data: sessionData });
        }
    }
}
exports.SessionRepository = SessionRepository;
