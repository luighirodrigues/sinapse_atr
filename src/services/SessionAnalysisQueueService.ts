import {
  EligibleSessionsCriteria,
  SessionAnalysisRepository,
  TagFilter,
} from '../repositories/SessionAnalysisRepository';

export type RunCriteria = {
  minMessages: number;
  tagFilter: TagFilter;
  forceReprocess: boolean;
};

export class SessionAnalysisQueueService {
  private repo: SessionAnalysisRepository;

  constructor() {
    this.repo = new SessionAnalysisRepository();
  }

  async getDryRunStats(
    clientId: string,
    combo: { scriptKey: string; scriptVersion: number; analysisVersionTag: string },
    criteria: RunCriteria
  ) {
    const full: EligibleSessionsCriteria = {
      minMessages: criteria.minMessages,
      tagFilter: criteria.tagFilter,
      forceReprocess: criteria.forceReprocess,
      scriptKey: combo.scriptKey,
      scriptVersion: combo.scriptVersion,
      analysisVersionTag: combo.analysisVersionTag,
    };
    return this.repo.getDryRunStats(clientId, full);
  }

  async listEligibleSessions(
    clientId: string,
    combo: { scriptKey: string; scriptVersion: number; analysisVersionTag: string },
    criteria: RunCriteria
  ) {
    const full: EligibleSessionsCriteria = {
      minMessages: criteria.minMessages,
      tagFilter: criteria.tagFilter,
      forceReprocess: criteria.forceReprocess,
      scriptKey: combo.scriptKey,
      scriptVersion: combo.scriptVersion,
      analysisVersionTag: combo.analysisVersionTag,
    };
    return this.repo.listEligibleSessionIds(clientId, full);
  }

  async enqueue(
    clientId: string,
    sessionIds: string[],
    combo: { scriptKey: string; scriptVersion: number; analysisVersionTag: string },
    forceReprocess: boolean
  ) {
    return this.repo.enqueueMany(clientId, sessionIds, combo, forceReprocess);
  }

  async claimNext(
    clientId: string,
    combo: { scriptKey: string; scriptVersion: number; analysisVersionTag: string }
  ) {
    return this.repo.claimNext(clientId, combo);
  }

  async loadMessages(sessionId: string) {
    return this.repo.loadMessagesForSession(sessionId);
  }

  async markDone(id: string, payload: { report: unknown; model?: string | null; promptHash?: string | null }) {
    return this.repo.markDone(id, payload);
  }

  async markFailed(id: string, error: string) {
    return this.repo.markFailed(id, error);
  }

  async countRemaining(
    clientId: string,
    combo: { scriptKey: string; scriptVersion: number; analysisVersionTag: string }
  ) {
    return this.repo.countRemaining(clientId, combo);
  }
}

