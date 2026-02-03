import { Request, Response } from 'express';
import { SinapseClientRepository } from '../repositories/SinapseClientRepository';
import { AnalysisScriptService } from '../services/AnalysisScriptService';
import { SessionAnalysisQueueService } from '../services/SessionAnalysisQueueService';
import { SessionAnalysisModelService } from '../services/SessionAnalysisModelService';

function parseBoolean(value: unknown, defaultValue: boolean) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;
  return defaultValue;
}

function parseIntSafe(value: unknown, defaultValue: number) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return defaultValue;
  return n;
}

function shortError(err: any) {
  const status = err?.status ?? err?.statusCode ?? err?.response?.status ?? null;
  const data = err?.response?.data ?? null;
  const extracted =
    (typeof data?.error?.message === 'string' && data.error.message) ||
    (typeof data?.error === 'string' && data.error) ||
    (data?.error != null && typeof data?.error === 'object' ? JSON.stringify(data.error) : null) ||
    (typeof data?.message === 'string' && data.message) ||
    (typeof data === 'string' && data) ||
    err?.message ||
    String(err);

  const normalized = String(extracted).trim().slice(0, 500);
  return status ? `${status}: ${normalized}` : normalized;
}

export class AnalysisAdminController {
  private clientRepo: SinapseClientRepository;
  private scriptService: AnalysisScriptService;
  private queueService: SessionAnalysisQueueService;
  private modelService: SessionAnalysisModelService;

  constructor() {
    this.clientRepo = new SinapseClientRepository();
    this.scriptService = new AnalysisScriptService();
    this.queueService = new SessionAnalysisQueueService();
    this.modelService = new SessionAnalysisModelService();
  }

  async createScript(req: Request, res: Response) {
    try {
      const clientSlug = String(req.params.clientSlug);
      const client = await this.clientRepo.findBySlug(clientSlug);
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const body = req.body ?? {};
      const scriptKey = typeof body.scriptKey === 'string' ? body.scriptKey.trim() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const scriptText = typeof body.scriptText === 'string' ? body.scriptText : '';

      if (!scriptKey) return res.status(400).json({ error: 'Missing scriptKey' });
      if (!name) return res.status(400).json({ error: 'Missing name' });
      if (!scriptText) return res.status(400).json({ error: 'Missing scriptText' });

      const version = body.version == null ? undefined : parseIntSafe(body.version, NaN);
      if (version !== undefined && (!Number.isFinite(version) || version < 1)) {
        return res.status(400).json({ error: 'Invalid version (must be int >= 1)' });
      }

      const isActive = body.isActive == null ? undefined : Boolean(body.isActive);
      const topics = body.topics;

      const created = await this.scriptService.create({
        clientId: client.id,
        scriptKey,
        version,
        name,
        description: body.description ?? null,
        scriptText,
        topics,
        isActive,
      });

      return res.status(201).json(created);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async listScripts(req: Request, res: Response) {
    try {
      const clientSlug = String(req.params.clientSlug);
      const client = await this.clientRepo.findBySlug(clientSlug);
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const scriptKey = typeof req.query.scriptKey === 'string' ? req.query.scriptKey.trim() : undefined;
      const activeOnly = parseBoolean(req.query.activeOnly, false);

      const scripts = await this.scriptService.list(client.id, {
        scriptKey,
        activeOnly,
      });

      return res.json(scripts);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async activateScript(req: Request, res: Response) {
    try {
      const clientSlug = String(req.params.clientSlug);
      const scriptKey = String(req.params.scriptKey);
      const client = await this.clientRepo.findBySlug(clientSlug);
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const version = parseIntSafe(req.body?.version, NaN);
      if (!Number.isFinite(version) || version < 1) {
        return res.status(400).json({ error: 'Missing/invalid version' });
      }

      const deactivateOthers = parseBoolean(req.body?.deactivateOthers, true);

      const result = await this.scriptService.activate(client.id, scriptKey, version, deactivateOthers);
      if (result.updated === 0) return res.status(404).json({ error: 'Script version not found' });

      return res.json({ ok: true, scriptKey, version, deactivateOthers });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async runSessionAnalyses(req: Request, res: Response) {
    try {
      const clientSlug = String(req.params.clientSlug);
      const client = await this.clientRepo.findBySlug(clientSlug);
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const body = req.body ?? {};
      const scriptKey = typeof body.scriptKey === 'string' ? body.scriptKey.trim() : '';
      if (!scriptKey) return res.status(400).json({ error: 'Missing scriptKey' });

      const analysisVersionTag =
        typeof body.analysisVersionTag === 'string' && body.analysisVersionTag.trim()
          ? body.analysisVersionTag.trim()
          : 'v1';

      const minMessages = Math.max(1, parseIntSafe(body.minMessages, 20));
      const limit = (() => {
        const requested = body.limit == null ? 200 : parseIntSafe(body.limit, 200);
        if (!Number.isFinite(requested) || requested < 1) return 1;
        if (requested > 500) return 500;
        return requested;
      })();

      const forceReprocess = Boolean(body.forceReprocess ?? false);
      const dryRun = Boolean(body.dryRun ?? false);

      const tagFilter = body.tagFilter?.mode ? body.tagFilter : { mode: 'none' };
      if (tagFilter?.mode !== 'none') {
        return res.status(400).json({ error: `tagFilter.mode '${tagFilter?.mode}' não implementado` });
      }

      const scriptVersion = body.scriptVersion == null ? undefined : parseIntSafe(body.scriptVersion, NaN);
      if (scriptVersion !== undefined && (!Number.isFinite(scriptVersion) || scriptVersion < 1)) {
        return res.status(400).json({ error: 'Invalid scriptVersion (must be int >= 1)' });
      }

      const resolved = await this.scriptService.resolve(client.id, scriptKey, scriptVersion);
      if (!resolved) {
        return res.status(400).json({
          error: scriptVersion == null ? 'No active script version found for scriptKey' : 'Script version not found',
        });
      }

      const combo = {
        scriptKey,
        scriptVersion: resolved.version,
        analysisVersionTag,
      };

      const criteria = { minMessages, tagFilter: { mode: 'none' as const }, forceReprocess };

      if (dryRun) {
        const stats = await this.queueService.getDryRunStats(client.id, combo, criteria);
        const remainingQueue = await this.queueService.countRemaining(client.id, combo);

        return res.json({
          clientId: client.id,
          scriptKey,
          scriptVersion: combo.scriptVersion,
          analysisVersionTag,
          criteria: { minMessages, tagFilter: criteria.tagFilter, forceReprocess },
          eligible: stats.eligible,
          alreadyDone: stats.alreadyDone,
          alreadyQueued: stats.alreadyQueued,
          wouldEnqueue: stats.wouldEnqueue,
          enqueued: 0,
          processed: 0,
          failed: 0,
          remainingQueue,
          sample: { processedIds: [], failedIds: [] },
        });
      }

      const eligibleSessionIds = await this.queueService.listEligibleSessions(client.id, combo, criteria);

      const enqueued = await this.queueService.enqueue(client.id, eligibleSessionIds, combo, forceReprocess);

      let processed = 0;
      let failed = 0;
      const processedIds: string[] = [];
      const failedIds: string[] = [];

      while (processed + failed < limit) {
        const claimed = await this.queueService.claimNext(client.id, combo);
        if (!claimed) break;

        try {
          const messages = await this.queueService.loadMessages(claimed.sessionId);
          if (messages.length === 0) {
            throw new Error('No messages found for session');
          }

          const { report, model, promptHash } = await this.modelService.generateReport({
            script: {
              scriptKey,
              scriptVersion: combo.scriptVersion,
              analysisVersionTag,
              scriptText: resolved.scriptText,
              topics: resolved.topics,
            },
            messages,
          });

          await this.queueService.markDone(claimed.id, { report, model, promptHash });
          processed++;
          if (processedIds.length < 20) processedIds.push(claimed.id);
        } catch (e) {
          await this.queueService.markFailed(claimed.id, shortError(e));
          failed++;
          if (failedIds.length < 20) failedIds.push(claimed.id);
        }
      }

      const remainingQueue = await this.queueService.countRemaining(client.id, combo);

      return res.json({
        clientId: client.id,
        scriptKey,
        scriptVersion: combo.scriptVersion,
        analysisVersionTag,
        criteria: { minMessages, tagFilter: criteria.tagFilter, forceReprocess },
        enqueued,
        processed,
        failed,
        remainingQueue,
        sample: { processedIds, failedIds },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
