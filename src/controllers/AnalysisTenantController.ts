import { Request, Response } from 'express';
import { prisma } from '../prisma/client';
import { SinapseClientRepository } from '../repositories/SinapseClientRepository';

function parseOptionalInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.trunc(n);
  if (String(int) !== String(n) && typeof value === 'string' && value.includes('.')) return null;
  return int;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class AnalysisTenantController {
  private clientRepo: SinapseClientRepository;

  constructor() {
    this.clientRepo = new SinapseClientRepository();
  }

  private async resolveCombo(input: {
    clientId: string;
    analysisVersionTag: string;
    scriptKey: string | null;
    scriptVersion: number | null;
  }) {
    let scriptKey = input.scriptKey;
    let scriptVersion = input.scriptVersion;

    if (scriptKey && (!scriptVersion || scriptVersion < 1)) {
      const active = await prisma.analysisScript.findFirst({
        where: { clientId: input.clientId, scriptKey, isActive: true },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      scriptVersion = active?.version ?? null;
    }

    if (!scriptKey) {
      const active = await prisma.analysisScript.findFirst({
        where: { clientId: input.clientId, isActive: true },
        orderBy: [{ updatedAt: 'desc' }, { version: 'desc' }],
        select: { scriptKey: true, version: true },
      });
      scriptKey = active?.scriptKey ?? null;
      scriptVersion = active?.version ?? null;
    }

    if (!scriptKey || !scriptVersion) return null;
    return { scriptKey, scriptVersion, analysisVersionTag: input.analysisVersionTag };
  }

  async getSessionAnalysesSummary(req: Request, res: Response) {
    try {
      const clientSlug = String(req.params.clientSlug ?? '');
      const client = await this.clientRepo.findBySlug(clientSlug);
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const analysisVersionTag =
        typeof req.query.analysisVersionTag === 'string' && req.query.analysisVersionTag.trim()
          ? req.query.analysisVersionTag.trim()
          : 'v1';

      const requestedScriptKey =
        typeof req.query.scriptKey === 'string' && req.query.scriptKey.trim() ? req.query.scriptKey.trim() : null;
      const requestedScriptVersion = parseOptionalInt(req.query.scriptVersion);

      const fromDays = clampInt(parseOptionalInt(req.query.fromDays) ?? 30, 1, 365);
      const now = new Date();
      const from = new Date(now.getTime() - fromDays * 24 * 60 * 60 * 1000);

      const combo = await this.resolveCombo({
        clientId: client.id,
        analysisVersionTag,
        scriptKey: requestedScriptKey,
        scriptVersion: requestedScriptVersion,
      });

      if (!combo) {
        return res.json({
          clientId: client.id,
          clientSlug,
          combo: null,
          window: { from: from.toISOString(), to: now.toISOString(), fromDays },
          queue: { pending: 0, processing: 0, failedRetryable: 0, failedPermanent: 0 },
          results: {
            done: 0,
            avgOverallScore: null,
            temperature: { cold: 0, neutral: 0, warm: 0, hot: 0 },
            lastProcessedAt: null,
          },
          message: 'No active analysis script configured for this client',
        });
      }

      const [queueRow] = await prisma.$queryRaw<
        Array<{
          pending: number;
          processing: number;
          failed_retryable: number;
          failed_permanent: number;
        }>
      >`
        SELECT
          COUNT(*) FILTER (WHERE sa."status" = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE sa."status" = 'processing')::int AS processing,
          COUNT(*) FILTER (WHERE sa."status" = 'failed' AND sa."retryCount" < 4)::int AS failed_retryable,
          COUNT(*) FILTER (WHERE sa."status" = 'failed' AND sa."retryCount" >= 4)::int AS failed_permanent
        FROM public.session_analyses sa
        WHERE sa."clientId" = ${client.id}
          AND sa."scriptKey" = ${combo.scriptKey}
          AND sa."scriptVersion" = ${combo.scriptVersion}
          AND sa."analysisVersionTag" = ${combo.analysisVersionTag}
      `;

      const [resultRow] = await prisma.$queryRaw<
        Array<{
          done: number;
          avg_overall_score: number | null;
          temp_cold: number;
          temp_neutral: number;
          temp_warm: number;
          temp_hot: number;
          last_processed_at: Date | null;
        }>
      >`
        SELECT
          COUNT(*) FILTER (
            WHERE sa."status" = 'done'
              AND sa."processedAt" IS NOT NULL
              AND sa."processedAt" >= ${from}
          )::int AS done,
          AVG(NULLIF((sa."report"->>'overallScore')::int, NULL)) FILTER (
            WHERE sa."status" = 'done'
              AND sa."processedAt" IS NOT NULL
              AND sa."processedAt" >= ${from}
          ) AS avg_overall_score,
          COUNT(*) FILTER (
            WHERE sa."status" = 'done'
              AND sa."processedAt" IS NOT NULL
              AND sa."processedAt" >= ${from}
              AND sa."report"->>'temperature' = 'cold'
          )::int AS temp_cold,
          COUNT(*) FILTER (
            WHERE sa."status" = 'done'
              AND sa."processedAt" IS NOT NULL
              AND sa."processedAt" >= ${from}
              AND sa."report"->>'temperature' = 'neutral'
          )::int AS temp_neutral,
          COUNT(*) FILTER (
            WHERE sa."status" = 'done'
              AND sa."processedAt" IS NOT NULL
              AND sa."processedAt" >= ${from}
              AND sa."report"->>'temperature' = 'warm'
          )::int AS temp_warm,
          COUNT(*) FILTER (
            WHERE sa."status" = 'done'
              AND sa."processedAt" IS NOT NULL
              AND sa."processedAt" >= ${from}
              AND sa."report"->>'temperature' = 'hot'
          )::int AS temp_hot,
          MAX(sa."processedAt") FILTER (WHERE sa."status" = 'done') AS last_processed_at
        FROM public.session_analyses sa
        WHERE sa."clientId" = ${client.id}
          AND sa."scriptKey" = ${combo.scriptKey}
          AND sa."scriptVersion" = ${combo.scriptVersion}
          AND sa."analysisVersionTag" = ${combo.analysisVersionTag}
      `;

      return res.json({
        clientId: client.id,
        clientSlug,
        combo,
        window: { from: from.toISOString(), to: now.toISOString(), fromDays },
        queue: {
          pending: Number(queueRow?.pending ?? 0),
          processing: Number(queueRow?.processing ?? 0),
          failedRetryable: Number(queueRow?.failed_retryable ?? 0),
          failedPermanent: Number(queueRow?.failed_permanent ?? 0),
        },
        results: {
          done: Number(resultRow?.done ?? 0),
          avgOverallScore:
            resultRow?.avg_overall_score === null || resultRow?.avg_overall_score === undefined
              ? null
              : Number(resultRow.avg_overall_score),
          temperature: {
            cold: Number(resultRow?.temp_cold ?? 0),
            neutral: Number(resultRow?.temp_neutral ?? 0),
            warm: Number(resultRow?.temp_warm ?? 0),
            hot: Number(resultRow?.temp_hot ?? 0),
          },
          lastProcessedAt: resultRow?.last_processed_at ? new Date(resultRow.last_processed_at).toISOString() : null,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getSessionAnalysesRanking(req: Request, res: Response) {
    try {
      const clientSlug = String(req.params.clientSlug ?? '');
      const client = await this.clientRepo.findBySlug(clientSlug);
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const analysisVersionTag =
        typeof req.query.analysisVersionTag === 'string' && req.query.analysisVersionTag.trim()
          ? req.query.analysisVersionTag.trim()
          : 'v1';

      const requestedScriptKey =
        typeof req.query.scriptKey === 'string' && req.query.scriptKey.trim() ? req.query.scriptKey.trim() : null;
      const requestedScriptVersion = parseOptionalInt(req.query.scriptVersion);

      const combo = await this.resolveCombo({
        clientId: client.id,
        analysisVersionTag,
        scriptKey: requestedScriptKey,
        scriptVersion: requestedScriptVersion,
      });
      if (!combo) return res.status(404).json({ error: 'No active analysis script configured for this client' });

      const fromDays = clampInt(parseOptionalInt(req.query.fromDays) ?? 30, 1, 365);
      const limit = clampInt(parseOptionalInt(req.query.limit) ?? 10, 1, 200);
      const now = new Date();
      const from = new Date(now.getTime() - fromDays * 24 * 60 * 60 * 1000);

      const rows = await prisma.$queryRaw<
        Array<{
          sessionAnalysisId: string;
          sessionId: string;
          ticketId: string;
          ticketExternalUuid: string;
          sessionStartedAt: Date | null;
          sessionEndedAt: Date | null;
          processedAt: Date | null;
          overallScore: number | null;
          temperature: string | null;
          summary: string | null;
        }>
      >`
        SELECT
          sa.id AS "sessionAnalysisId",
          sa."sessionId" AS "sessionId",
          t.id AS "ticketId",
          t."externalUuid" AS "ticketExternalUuid",
          s."startedAt" AS "sessionStartedAt",
          s."endedAt" AS "sessionEndedAt",
          sa."processedAt" AS "processedAt",
          NULLIF(sa."report"->>'overallScore', '')::int AS "overallScore",
          sa."report"->>'temperature' AS "temperature",
          sa."report"->>'summary' AS "summary"
        FROM public.session_analyses sa
        JOIN public.sessions s ON s.id = sa."sessionId"
        JOIN public.tickets t ON t.id = s."ticketId"
        WHERE sa."clientId" = ${client.id}
          AND sa."scriptKey" = ${combo.scriptKey}
          AND sa."scriptVersion" = ${combo.scriptVersion}
          AND sa."analysisVersionTag" = ${combo.analysisVersionTag}
          AND sa."status" = 'done'
          AND sa."processedAt" IS NOT NULL
          AND sa."processedAt" >= ${from}
        ORDER BY "overallScore" ASC NULLS LAST, sa."processedAt" DESC
        LIMIT ${limit}
      `;

      return res.json({
        clientId: client.id,
        clientSlug,
        combo,
        window: { from: from.toISOString(), to: now.toISOString(), fromDays },
        limit,
        items: rows.map((r) => ({
          sessionAnalysisId: r.sessionAnalysisId,
          sessionId: r.sessionId,
          ticket: { id: r.ticketId, externalUuid: r.ticketExternalUuid },
          session: {
            startedAt: r.sessionStartedAt ? new Date(r.sessionStartedAt).toISOString() : null,
            endedAt: r.sessionEndedAt ? new Date(r.sessionEndedAt).toISOString() : null,
          },
          processedAt: r.processedAt ? new Date(r.processedAt).toISOString() : null,
          overallScore: r.overallScore === null || r.overallScore === undefined ? null : Number(r.overallScore),
          temperature: r.temperature ?? null,
          summary: r.summary ?? null,
        })),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getSessionAnalysesDetails(req: Request, res: Response) {
    try {
      const clientSlug = String(req.params.clientSlug ?? '');
      const client = await this.clientRepo.findBySlug(clientSlug);
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const sessionId =
        typeof req.query.sessionId === 'string' && req.query.sessionId.trim() ? req.query.sessionId.trim() : null;
      if (!sessionId) return res.status(400).json({ error: 'Missing query param: sessionId' });

      const analysisVersionTag =
        typeof req.query.analysisVersionTag === 'string' && req.query.analysisVersionTag.trim()
          ? req.query.analysisVersionTag.trim()
          : 'v1';

      const requestedScriptKey =
        typeof req.query.scriptKey === 'string' && req.query.scriptKey.trim() ? req.query.scriptKey.trim() : null;
      const requestedScriptVersion = parseOptionalInt(req.query.scriptVersion);

      const combo = await this.resolveCombo({
        clientId: client.id,
        analysisVersionTag,
        scriptKey: requestedScriptKey,
        scriptVersion: requestedScriptVersion,
      });
      if (!combo) return res.status(404).json({ error: 'No active analysis script configured for this client' });

      const analysis = await prisma.sessionAnalysis.findFirst({
        where: {
          clientId: client.id,
          sessionId,
          scriptKey: combo.scriptKey,
          scriptVersion: combo.scriptVersion,
          analysisVersionTag: combo.analysisVersionTag,
        },
        select: {
          id: true,
          status: true,
          startedAt: true,
          processedAt: true,
          retryCount: true,
          nextRetryAt: true,
          error: true,
          model: true,
          promptHash: true,
          report: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!analysis) return res.status(404).json({ error: 'Analysis not found for this session/combo' });

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          ticketId: true,
          startedAt: true,
          endedAt: true,
          ticket: { select: { externalUuid: true } },
        },
      });

      return res.json({
        clientId: client.id,
        clientSlug,
        combo,
        session: session
          ? {
              id: session.id,
              ticketId: session.ticketId,
              ticketExternalUuid: session.ticket?.externalUuid ?? null,
              startedAt: session.startedAt ? session.startedAt.toISOString() : null,
              endedAt: session.endedAt ? session.endedAt.toISOString() : null,
            }
          : { id: sessionId, ticketId: null, ticketExternalUuid: null, startedAt: null, endedAt: null },
        analysis: {
          id: analysis.id,
          status: analysis.status,
          startedAt: analysis.startedAt ? analysis.startedAt.toISOString() : null,
          processedAt: analysis.processedAt ? analysis.processedAt.toISOString() : null,
          retryCount: analysis.retryCount,
          nextRetryAt: analysis.nextRetryAt ? analysis.nextRetryAt.toISOString() : null,
          error: analysis.error ?? null,
          model: analysis.model ?? null,
          promptHash: analysis.promptHash ?? null,
          report: analysis.report ?? null,
          createdAt: analysis.createdAt.toISOString(),
          updatedAt: analysis.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
