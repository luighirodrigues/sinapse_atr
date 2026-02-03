"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionAnalysisQueueService = void 0;
const SessionAnalysisRepository_1 = require("../repositories/SessionAnalysisRepository");
class SessionAnalysisQueueService {
    constructor() {
        this.repo = new SessionAnalysisRepository_1.SessionAnalysisRepository();
    }
    async getDryRunStats(clientId, combo, criteria) {
        const full = {
            minMessages: criteria.minMessages,
            tagFilter: criteria.tagFilter,
            forceReprocess: criteria.forceReprocess,
            scriptKey: combo.scriptKey,
            scriptVersion: combo.scriptVersion,
            analysisVersionTag: combo.analysisVersionTag,
        };
        return this.repo.getDryRunStats(clientId, full);
    }
    async listEligibleSessions(clientId, combo, criteria) {
        const full = {
            minMessages: criteria.minMessages,
            tagFilter: criteria.tagFilter,
            forceReprocess: criteria.forceReprocess,
            scriptKey: combo.scriptKey,
            scriptVersion: combo.scriptVersion,
            analysisVersionTag: combo.analysisVersionTag,
        };
        return this.repo.listEligibleSessionIds(clientId, full);
    }
    async enqueue(clientId, sessionIds, combo, forceReprocess) {
        return this.repo.enqueueMany(clientId, sessionIds, combo, forceReprocess);
    }
    async claimNext(clientId, combo) {
        return this.repo.claimNext(clientId, combo);
    }
    async loadMessages(sessionId) {
        return this.repo.loadMessagesForSession(sessionId);
    }
    async markDone(id, payload) {
        return this.repo.markDone(id, payload);
    }
    async markFailed(id, error) {
        return this.repo.markFailed(id, error);
    }
    async countRemaining(clientId, combo) {
        return this.repo.countRemaining(clientId, combo);
    }
}
exports.SessionAnalysisQueueService = SessionAnalysisQueueService;
