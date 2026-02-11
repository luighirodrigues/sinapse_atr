"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvgFirstResponseTimeService = void 0;
const client_1 = require("../../prisma/client");
const client_2 = require("@prisma/client");
class AvgFirstResponseTimeService {
    async calculateAndStoreFirstResponseTimes({ clientId, startDate, endDate }) {
        await client_1.prisma.conversationMetrics.deleteMany({
            where: {
                clientId,
                firstInboundAt: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });
        // 1. Find sessions with inbound in period and their first response
        const results = await client_1.prisma.$queryRaw `
      SELECT
        s."id" as "sessionId",
        s."createdAtExternal" as "firstInboundAt",
        CASE
          WHEN s."startedAt" >= s."createdAtExternal" THEN s."startedAt"
          ELSE NULL
        END as "firstOutboundAt"
      FROM "sessions" s
      JOIN "tickets" t ON s."ticketId" = t."id"
      WHERE t."clientId" = ${clientId}
        AND t."isGroup" = false
        AND s."createdAtExternal" IS NOT NULL
        AND s."createdAtExternal" >= ${startDate}
        AND s."createdAtExternal" <= ${endDate}
    `;
        let inserted = 0;
        let updated = 0;
        let unansweredSessions = 0;
        let processedSessions = 0;
        for (const row of results) {
            processedSessions++;
            if (!row.firstOutboundAt) {
                unansweredSessions++;
                continue;
            }
            const firstResponseTimeMs = new Date(row.firstOutboundAt).getTime() - new Date(row.firstInboundAt).getTime();
            // Upsert
            const existing = await client_1.prisma.conversationMetrics.findUnique({
                where: {
                    clientId_sessionId: {
                        clientId,
                        sessionId: row.sessionId
                    }
                }
            });
            if (existing) {
                await client_1.prisma.conversationMetrics.update({
                    where: { id: existing.id },
                    data: {
                        firstInboundAt: row.firstInboundAt,
                        firstOutboundAt: row.firstOutboundAt,
                        firstResponseTimeMs
                    }
                });
                updated++;
            }
            else {
                await client_1.prisma.conversationMetrics.create({
                    data: {
                        clientId,
                        sessionId: row.sessionId,
                        firstInboundAt: row.firstInboundAt,
                        firstOutboundAt: row.firstOutboundAt,
                        firstResponseTimeMs
                    }
                });
                inserted++;
            }
        }
        return { processedSessions, inserted, updated, unansweredSessions };
    }
    async getAvgFirstResponseTime({ clientId, startDate, endDate, groupBy }) {
        if (groupBy === 'total') {
            const rows = await client_1.prisma.$queryRaw `
        WITH SessionsInPeriod AS (
        SELECT
            s."createdAtExternal" as "firstInboundAt",
            CASE
              WHEN s."startedAt" >= s."createdAtExternal" THEN s."startedAt"
              ELSE NULL
            END as "firstOutboundAt"
          FROM "sessions" s
          JOIN "tickets" t ON s."ticketId" = t."id"
        WHERE t."clientId" = ${clientId}
          AND t."isGroup" = false
            AND s."createdAtExternal" IS NOT NULL
            AND s."createdAtExternal" >= ${startDate}
            AND s."createdAtExternal" <= ${endDate}
        )
        SELECT
          AVG(
            EXTRACT(EPOCH FROM ("firstOutboundAt" - "firstInboundAt")) * 1000
          ) as avg_time,
          COUNT(*) FILTER (WHERE "firstOutboundAt" IS NOT NULL)::int as sessions_with_response,
          COUNT(*) FILTER (WHERE "firstOutboundAt" IS NULL)::int as sessions_without_response
        FROM SessionsInPeriod
      `;
            const row = rows[0] ?? { avg_time: null, sessions_with_response: 0, sessions_without_response: 0 };
            return [
                {
                    period: 'total',
                    avgFirstResponseTimeMs: row.avg_time ? Math.round(Number(row.avg_time)) : 0,
                    sessionsWithResponse: Number(row.sessions_with_response),
                    sessionsWithoutResponse: Number(row.sessions_without_response)
                }
            ];
        }
        const timeFormat = groupBy === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
        const rows = await client_1.prisma.$queryRaw `
      WITH SessionsInPeriod AS (
        SELECT
          s."createdAtExternal" as "firstInboundAt",
          CASE
            WHEN s."startedAt" >= s."createdAtExternal" THEN s."startedAt"
            ELSE NULL
          END as "firstOutboundAt"
        FROM "sessions" s
        JOIN "tickets" t ON s."ticketId" = t."id"
        WHERE t."clientId" = ${clientId}
          AND t."isGroup" = false
          AND s."createdAtExternal" IS NOT NULL
          AND s."createdAtExternal" >= ${startDate}
          AND s."createdAtExternal" <= ${endDate}
      )
      SELECT
        TO_CHAR("firstInboundAt", ${client_2.Prisma.raw(`'${timeFormat}'`)}) as period,
        AVG(
          EXTRACT(EPOCH FROM ("firstOutboundAt" - "firstInboundAt")) * 1000
        ) as avg_time,
        COUNT(*) FILTER (WHERE "firstOutboundAt" IS NOT NULL)::int as sessions_with_response,
        COUNT(*) FILTER (WHERE "firstOutboundAt" IS NULL)::int as sessions_without_response
      FROM SessionsInPeriod
      GROUP BY 1
      ORDER BY 1
    `;
        return rows.map(r => ({
            period: r.period,
            avgFirstResponseTimeMs: r.avg_time ? Math.round(Number(r.avg_time)) : 0,
            sessionsWithResponse: Number(r.sessions_with_response),
            sessionsWithoutResponse: Number(r.sessions_without_response)
        }));
    }
}
exports.AvgFirstResponseTimeService = AvgFirstResponseTimeService;
