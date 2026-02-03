"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionAnalysisRepository = void 0;
const client_1 = require("../prisma/client");
class SessionAnalysisRepository {
    async getDryRunStats(clientId, criteria) {
        if (criteria.tagFilter.mode !== 'none') {
            throw new Error(`Unsupported tagFilter.mode: ${criteria.tagFilter.mode}`);
        }
        const rows = await client_1.prisma.$queryRaw `
      WITH eligible AS (
        SELECT s.id AS "sessionId"
        FROM public.sessions s
        JOIN public.tickets t
          ON t.id = s."ticketId"
         AND t."clientId" = ${clientId}
        JOIN public.messages m
          ON m."sessionId" = s.id
        WHERE s."startedAt" IS NOT NULL
          AND s."endedAt" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.contact_tags ct
            WHERE ct."clientId" = t."clientId"
              AND ct."contactId" = t."contactId"
          )
        GROUP BY s.id
        HAVING COUNT(m.id) >= ${criteria.minMessages}
      )
      SELECT
        (SELECT COUNT(*)::int FROM eligible) AS eligible,
        (
          SELECT COUNT(*)::int
          FROM eligible e
          JOIN public.session_analyses sa
            ON sa."sessionId" = e."sessionId"
           AND sa."clientId" = ${clientId}
           AND sa."scriptKey" = ${criteria.scriptKey}
           AND sa."scriptVersion" = ${criteria.scriptVersion}
           AND sa."analysisVersionTag" = ${criteria.analysisVersionTag}
           AND sa."status" = 'done'
        ) AS already_done,
        (
          SELECT COUNT(*)::int
          FROM eligible e
          JOIN public.session_analyses sa
            ON sa."sessionId" = e."sessionId"
           AND sa."clientId" = ${clientId}
           AND sa."scriptKey" = ${criteria.scriptKey}
           AND sa."scriptVersion" = ${criteria.scriptVersion}
           AND sa."analysisVersionTag" = ${criteria.analysisVersionTag}
           AND sa."status" IN ('pending','failed')
        ) AS already_queued
    `;
        const row = rows[0] ?? { eligible: 0, already_done: 0, already_queued: 0 };
        const eligible = Number(row.eligible) || 0;
        const alreadyDone = Number(row.already_done) || 0;
        const alreadyQueued = Number(row.already_queued) || 0;
        const wouldEnqueue = Math.max(0, eligible - alreadyDone);
        return { eligible, alreadyDone, alreadyQueued, wouldEnqueue };
    }
    async listEligibleSessionIds(clientId, criteria) {
        if (criteria.tagFilter.mode !== 'none') {
            throw new Error(`Unsupported tagFilter.mode: ${criteria.tagFilter.mode}`);
        }
        const rows = await client_1.prisma.$queryRaw `
      SELECT s.id AS "sessionId"
      FROM public.sessions s
      JOIN public.tickets t
        ON t.id = s."ticketId"
       AND t."clientId" = ${clientId}
      JOIN public.messages m
        ON m."sessionId" = s.id
      WHERE s."startedAt" IS NOT NULL
        AND s."endedAt" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.contact_tags ct
          WHERE ct."clientId" = t."clientId"
            AND ct."contactId" = t."contactId"
        )
        AND (
          ${criteria.forceReprocess} = true OR
          NOT EXISTS (
            SELECT 1
            FROM public.session_analyses sa
            WHERE sa."clientId" = ${clientId}
              AND sa."sessionId" = s.id
              AND sa."scriptKey" = ${criteria.scriptKey}
              AND sa."scriptVersion" = ${criteria.scriptVersion}
              AND sa."analysisVersionTag" = ${criteria.analysisVersionTag}
              AND sa."status" = 'done'
          )
        )
      GROUP BY s.id
      HAVING COUNT(m.id) >= ${criteria.minMessages}
    `;
        return rows.map((r) => r.sessionId);
    }
    async enqueueMany(clientId, sessionIds, combo, forceReprocess) {
        if (sessionIds.length === 0)
            return 0;
        if (!forceReprocess) {
            const affected = await client_1.prisma.$executeRaw `
        INSERT INTO public.session_analyses
          ("clientId","sessionId","scriptKey","scriptVersion","analysisVersionTag","status")
        SELECT
          ${clientId},
          x."sessionId",
          ${combo.scriptKey},
          ${combo.scriptVersion},
          ${combo.analysisVersionTag},
          'pending'
        FROM unnest(${sessionIds}::text[]) AS x("sessionId")
        ON CONFLICT ("sessionId","scriptKey","scriptVersion","analysisVersionTag")
        DO NOTHING
      `;
            return Number(affected) || 0;
        }
        const affected = await client_1.prisma.$executeRaw `
      INSERT INTO public.session_analyses
        ("clientId","sessionId","scriptKey","scriptVersion","analysisVersionTag","status")
      SELECT
        ${clientId},
        x."sessionId",
        ${combo.scriptKey},
        ${combo.scriptVersion},
        ${combo.analysisVersionTag},
        'pending'
      FROM unnest(${sessionIds}::text[]) AS x("sessionId")
      ON CONFLICT ("sessionId","scriptKey","scriptVersion","analysisVersionTag")
      DO UPDATE SET
        "status" = 'pending',
        "report" = NULL,
        "error" = NULL,
        "retryCount" = 0,
        "nextRetryAt" = NULL,
        "processedAt" = NULL,
        "startedAt" = NULL,
        "model" = NULL,
        "promptHash" = NULL,
        "updatedAt" = now()
    `;
        return Number(affected) || 0;
    }
    async claimNext(clientId, combo) {
        const rows = await client_1.prisma.$queryRaw `
      WITH candidate AS (
        SELECT sa.id
        FROM public.session_analyses sa
        JOIN public.sessions s ON s.id = sa."sessionId"
        WHERE sa."clientId" = ${clientId}
          AND sa."scriptKey" = ${combo.scriptKey}
          AND sa."scriptVersion" = ${combo.scriptVersion}
          AND sa."analysisVersionTag" = ${combo.analysisVersionTag}
          AND sa."status" IN ('pending','failed')
          AND (
            sa."status" = 'pending' OR
            (sa."status" = 'failed' AND sa."retryCount" < 4)
          )
          AND (sa."nextRetryAt" IS NULL OR sa."nextRetryAt" <= now())
        ORDER BY s."endedAt" DESC NULLS LAST, sa."createdAt" DESC
        LIMIT 1
      )
      UPDATE public.session_analyses sa
      SET "status" = 'processing', "startedAt" = now(), "error" = NULL, "updatedAt" = now()
      FROM candidate c
      WHERE sa.id = c.id
      RETURNING sa.id, sa."sessionId" AS "sessionId"
    `;
        const row = rows[0];
        if (!row)
            return null;
        return { id: row.id, sessionId: row.sessionId };
    }
    async loadMessagesForSession(sessionId) {
        const rows = await client_1.prisma.$queryRaw `
      SELECT
        m.id,
        m.body,
        m."fromMe",
        m."mediaType",
        m."mediaUrl",
        m."createdAtExternal",
        m."updatedAtExternal",
        m."createdAt",
        m."senderType"
      FROM public.messages m
      WHERE m."sessionId" = ${sessionId}
      ORDER BY COALESCE(m."updatedAtExternal", m."createdAtExternal", m."createdAt") ASC, m.id ASC
    `;
        return rows;
    }
    async markDone(id, payload) {
        await client_1.prisma.sessionAnalysis.update({
            where: { id },
            data: {
                status: 'done',
                processedAt: new Date(),
                report: payload.report,
                retryCount: 0,
                nextRetryAt: null,
                error: null,
                model: payload.model ?? null,
                promptHash: payload.promptHash ?? null,
                updatedAt: new Date(),
            },
        });
    }
    async markFailed(id, error) {
        const existing = await client_1.prisma.sessionAnalysis.findUnique({
            where: { id },
            select: { retryCount: true },
        });
        const currentRetry = existing?.retryCount ?? 0;
        const nextRetryCount = currentRetry + 1;
        const nextRetryAt = nextRetryCount === 1
            ? new Date(Date.now() + 1 * 60000)
            : nextRetryCount === 2
                ? new Date(Date.now() + 5 * 60000)
                : nextRetryCount === 3
                    ? new Date(Date.now() + 15 * 60000)
                    : null;
        await client_1.prisma.sessionAnalysis.update({
            where: { id },
            data: {
                status: 'failed',
                retryCount: nextRetryCount,
                nextRetryAt,
                error,
                updatedAt: new Date(),
            },
        });
    }
    async countRemaining(clientId, combo) {
        const rows = await client_1.prisma.$queryRaw `
      SELECT COUNT(*)::int AS count
      FROM public.session_analyses sa
      WHERE sa."clientId" = ${clientId}
        AND sa."scriptKey" = ${combo.scriptKey}
        AND sa."scriptVersion" = ${combo.scriptVersion}
        AND sa."analysisVersionTag" = ${combo.analysisVersionTag}
        AND (
          sa."status" = 'pending' OR
          (sa."status" = 'failed' AND sa."retryCount" < 4)
        )
    `;
        return Number(rows[0]?.count ?? 0);
    }
}
exports.SessionAnalysisRepository = SessionAnalysisRepository;
