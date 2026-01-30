"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvgSessionDurationByTagService = void 0;
const client_1 = require("@prisma/client");
const client_2 = require("../../prisma/client");
class AvgSessionDurationByTagService {
    async getAvgSessionDurationByTag({ clientId, startDate, endDate, granularity }) {
        const timeFormat = granularity === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
        const rows = await client_2.prisma.$queryRaw `
      WITH BaseSessions AS (
        SELECT
          s."id" as "sessionId",
          s."startedAt",
          s."endedAt",
          t."clientId",
          t."contactId"
        FROM "sessions" s
        JOIN "tickets" t ON s."ticketId" = t."id"
        WHERE t."clientId" = ${clientId}
          AND s."endedAt" IS NOT NULL
          AND s."startedAt" >= ${startDate}
          AND s."startedAt" <= ${endDate}
      ),
      SessionTagRows AS (
        SELECT
          TO_CHAR(bs."startedAt", ${client_1.Prisma.raw(`'${timeFormat}'`)}) as period,
          COALESCE(tag."name", 'Sem tag') as tag,
          EXTRACT(EPOCH FROM (bs."endedAt" - bs."startedAt")) * 1000 as duration_ms
        FROM BaseSessions bs
        LEFT JOIN "contact_tags" ct
          ON ct."clientId" = bs."clientId"
         AND ct."contactId" = bs."contactId"
        LEFT JOIN "tags" tag
          ON tag."clientId" = ct."clientId"
         AND tag."id" = ct."tagId"
      )
      SELECT
        period,
        tag,
        AVG(duration_ms) as avg_duration_ms,
        COUNT(*)::int as sessions
      FROM SessionTagRows
      GROUP BY 1, 2
      ORDER BY 1, 3 DESC
    `;
        const byPeriod = new Map();
        for (const row of rows) {
            const items = byPeriod.get(row.period) ?? [];
            items.push({
                tag: row.tag,
                avgDurationMs: row.avg_duration_ms ? Math.round(Number(row.avg_duration_ms)) : 0,
                sessions: Number(row.sessions),
            });
            byPeriod.set(row.period, items);
        }
        const result = Array.from(byPeriod.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([period, items]) => ({
            period,
            items: items.sort((a, b) => b.avgDurationMs - a.avgDurationMs),
        }));
        if (granularity === 'month' && result.length === 1)
            return result[0];
        return result;
    }
}
exports.AvgSessionDurationByTagService = AvgSessionDurationByTagService;
