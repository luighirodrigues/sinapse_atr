"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NormalizationService = void 0;
const client_1 = require("@prisma/client");
class NormalizationService {
    normalizeTrackings(trackings) {
        // 1. Convert to internal intermediate format
        const mapped = trackings.map((t) => {
            const startedAt = t.startedAt ? new Date(t.startedAt) : new Date(t.createdAt);
            const endedAt = t.finishedAt ? new Date(t.finishedAt) : null;
            let type = client_1.SessionType.OPEN_WEAK;
            if (t.startedAt && t.finishedAt) {
                type = client_1.SessionType.CLOSED;
            }
            else if (t.startedAt && !t.finishedAt) {
                type = client_1.SessionType.OPEN_REAL;
            }
            else {
                type = client_1.SessionType.OPEN_WEAK;
            }
            return {
                externalTrackingId: t.id,
                type,
                startedAt,
                endedAt,
                assignedUser: t.user ? { name: t.user.name, email: t.user.email } : null,
                createdAt: new Date(t.createdAt),
            };
        });
        const closed = mapped.filter((s) => s.type === client_1.SessionType.CLOSED);
        const openReal = mapped.find((s) => s.type === client_1.SessionType.OPEN_REAL); // Assuming only one OPEN_REAL can exist?
        const openWeaks = mapped.filter((s) => s.type === client_1.SessionType.OPEN_WEAK).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        // 2. Deduplicate/Merge OPEN_WEAK
        const mergedWeaks = [];
        if (openWeaks.length > 0) {
            let current = openWeaks[0];
            for (let i = 1; i < openWeaks.length; i++) {
                const next = openWeaks[i];
                // If difference <= 60s
                if (Math.abs(next.createdAt.getTime() - current.createdAt.getTime()) <= 60000) {
                    // Merge: use the earlier start time
                    if (next.startedAt < current.startedAt) {
                        current.startedAt = next.startedAt;
                    }
                    // We keep the ID of the 'current' or 'next'? 
                    // Requirement: "Se dois OPEN_WEAK ... merge em uma única sessão".
                    // We'll keep the ID of the latest one usually or just one of them.
                    // Let's keep the latest one as it represents the 'current' state better?
                    // Or the earliest?
                    // Let's keep the one that started earlier as base, but maybe update properties?
                    // Actually, if we merge, we create a 'synthetic' session or pick one.
                    // Let's pick the one with earliest createdAt as the base for 'startedAt' calculation (already done).
                    // For externalTrackingId, if we merge 5 trackings, which ID do we keep?
                    // If we keep one, the others are 'lost'. 
                    // Let's keep the ID of the *latest* one in the chain, as it's the most recent 'active' one.
                    current.externalTrackingId = next.externalTrackingId;
                    current.createdAt = next.createdAt; // Advance current to next for comparison?
                    // Wait, "diferença <= 60s". Is it diff between A and B? Or A and C?
                    // Usually it's chain: A close to B -> Merge AB. AB close to C -> Merge ABC.
                    // So we update 'current' to be the merged result.
                }
                else {
                    mergedWeaks.push(current);
                    current = next;
                }
            }
            mergedWeaks.push(current);
        }
        // 3. Determine final OPEN session
        // "Se existir OPEN_REAL, ela é a sessão aberta atual"
        // "Caso contrário, se existir OPEN_WEAK, use a OPEN_WEAK mais recente (após merge) como sessão aberta atual"
        let finalOpen = null;
        if (openReal) {
            finalOpen = openReal;
        }
        else if (mergedWeaks.length > 0) {
            // Use the most recent merged weak session
            finalOpen = mergedWeaks[mergedWeaks.length - 1];
        }
        return {
            closed: closed.map(s => ({
                externalTrackingId: s.externalTrackingId,
                type: s.type,
                startedAt: s.startedAt,
                endedAt: s.endedAt,
                assignedUser: s.assignedUser
            })),
            open: finalOpen ? {
                externalTrackingId: finalOpen.externalTrackingId,
                type: finalOpen.type,
                startedAt: finalOpen.startedAt,
                endedAt: finalOpen.endedAt,
                assignedUser: finalOpen.assignedUser
            } : null
        };
    }
    assignMessageToSession(messageCreatedAt, sessions) {
        // 1. Try CLOSED
        for (const session of sessions.closed) {
            if (session.startedAt <= messageCreatedAt && session.endedAt && messageCreatedAt <= session.endedAt) {
                // We need the session ID (internal database ID). 
                // But here we only have NormalizedSession which might not have the DB ID yet.
                // The caller of this function needs to map back to DB IDs.
                // So this function should probably return the "matching session object" or index?
                // Or better: The caller passes sessions with their DB IDs.
                return 'MATCH_CLOSED_' + session.externalTrackingId; // Placeholder return
            }
        }
        // 2. Try OPEN
        if (sessions.open) {
            if (messageCreatedAt >= sessions.open.startedAt) {
                return 'MATCH_OPEN';
            }
        }
        return null;
    }
}
exports.NormalizationService = NormalizationService;
