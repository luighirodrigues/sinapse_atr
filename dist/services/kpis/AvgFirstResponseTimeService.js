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
      WITH Inbounds AS (
        SELECT
          m."sessionId",
          MIN(m."createdAtExternal") as "firstInboundAt"
        FROM "messages" m
        JOIN "tickets" t ON m."ticketId" = t."id"
        WHERE t."clientId" = ${clientId}
          AND t."isGroup" = false
          AND m."sessionId" IS NOT NULL
          AND m."fromMe" = false
          AND m."senderType" = 'HUMAN'
        GROUP BY m."sessionId"
      ),
      InboundsInPeriod AS (
        SELECT *
        FROM Inbounds
        WHERE "firstInboundAt" >= ${startDate} AND "firstInboundAt" <= ${endDate}
      ),
      Outbounds AS (
        SELECT
          m."sessionId",
          MIN(m."createdAtExternal") as "firstOutboundAt"
        FROM "messages" m
        JOIN InboundsInPeriod i ON m."sessionId" = i."sessionId"
        WHERE m."fromMe" = true
          AND m."senderType" IN ('HUMAN', 'AI')
          AND m."createdAtExternal" > i."firstInboundAt"
        GROUP BY m."sessionId"
      )
      SELECT
        i."sessionId",
        i."firstInboundAt",
        o."firstOutboundAt"
      FROM InboundsInPeriod i
      LEFT JOIN Outbounds o ON i."sessionId" = o."sessionId"
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
        WITH Inbounds AS (
          SELECT
            m."sessionId",
            MIN(m."createdAtExternal") as "firstInboundAt"
          FROM "messages" m
          JOIN "tickets" t ON m."ticketId" = t."id"
          WHERE t."clientId" = ${clientId}
            AND t."isGroup" = false
            AND m."sessionId" IS NOT NULL
            AND m."fromMe" = false
            AND m."senderType" = 'HUMAN'
          GROUP BY m."sessionId"
        ),
        InboundsInPeriod AS (
          SELECT *
          FROM Inbounds
          WHERE "firstInboundAt" >= ${startDate} AND "firstInboundAt" <= ${endDate}
        )
        SELECT
          AVG(
            EXTRACT(EPOCH FROM (o."firstOutboundAt" - i."firstInboundAt")) * 1000
          ) as avg_time,
          COUNT(*) FILTER (WHERE o."firstOutboundAt" IS NOT NULL)::int as sessions_with_response,
          COUNT(*) FILTER (WHERE o."firstOutboundAt" IS NULL)::int as sessions_without_response
        FROM InboundsInPeriod i
        LEFT JOIN (
          SELECT
            m."sessionId",
            MIN(m."createdAtExternal") as "firstOutboundAt"
          FROM "messages" m
          JOIN InboundsInPeriod i ON m."sessionId" = i."sessionId"
          WHERE m."fromMe" = true
            AND m."senderType" IN ('HUMAN', 'AI')
            AND m."createdAtExternal" > i."firstInboundAt"
          GROUP BY m."sessionId"
        ) o ON i."sessionId" = o."sessionId"
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
      WITH Inbounds AS (
        SELECT
          m."sessionId",
          MIN(m."createdAtExternal") as "firstInboundAt"
        FROM "messages" m
        JOIN "tickets" t ON m."ticketId" = t."id"
        WHERE t."clientId" = ${clientId}
          AND t."isGroup" = false
          AND m."sessionId" IS NOT NULL
          AND m."fromMe" = false
          AND m."senderType" = 'HUMAN'
        GROUP BY m."sessionId"
      ),
      InboundsInPeriod AS (
        SELECT *
        FROM Inbounds
        WHERE "firstInboundAt" >= ${startDate} AND "firstInboundAt" <= ${endDate}
      )
      SELECT
        TO_CHAR(i."firstInboundAt", ${client_2.Prisma.raw(`'${timeFormat}'`)}) as period,
        AVG(
          EXTRACT(EPOCH FROM (o."firstOutboundAt" - i."firstInboundAt")) * 1000
        ) as avg_time,
        COUNT(*) FILTER (WHERE o."firstOutboundAt" IS NOT NULL)::int as sessions_with_response,
        COUNT(*) FILTER (WHERE o."firstOutboundAt" IS NULL)::int as sessions_without_response
      FROM InboundsInPeriod i
      LEFT JOIN (
        SELECT
          m."sessionId",
          MIN(m."createdAtExternal") as "firstOutboundAt"
        FROM "messages" m
        JOIN InboundsInPeriod i ON m."sessionId" = i."sessionId"
        WHERE m."fromMe" = true
          AND m."senderType" IN ('HUMAN', 'AI')
          AND m."createdAtExternal" > i."firstInboundAt"
        GROUP BY m."sessionId"
      ) o ON i."sessionId" = o."sessionId"
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
