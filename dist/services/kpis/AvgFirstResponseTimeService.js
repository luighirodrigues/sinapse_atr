"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvgFirstResponseTimeService = void 0;
const client_1 = require("../../prisma/client");
class AvgFirstResponseTimeService {
    async calculateAndStoreFirstResponseTimes({ clientId, startDate, endDate }) {
        // 1. Find sessions with inbound in period and their first response
        const results = await client_1.prisma.$queryRaw `
      WITH Inbounds AS (
        SELECT
          m."sessionId",
          MIN(m."createdAt") as "firstInboundAt"
        FROM "messages" m
        JOIN "tickets" t ON m."ticketId" = t."id"
        WHERE t."clientId" = ${clientId}
          AND m."sessionId" IS NOT NULL
          AND m."fromMe" = false
          AND m."mediaType" IN ('conversation', 'extendedTextMessage')
          AND m."createdAt" >= ${startDate} AND m."createdAt" <= ${endDate}
        GROUP BY m."sessionId"
      ),
      Outbounds AS (
        SELECT
          m."sessionId",
          MIN(m."createdAt") as "firstOutboundAt"
        FROM "messages" m
        JOIN Inbounds i ON m."sessionId" = i."sessionId"
        WHERE m."fromMe" = true
          AND m."senderType" = 'HUMAN'
          AND m."createdAt" > i."firstInboundAt"
        GROUP BY m."sessionId"
      )
      SELECT
        i."sessionId",
        i."firstInboundAt",
        o."firstOutboundAt"
      FROM Inbounds i
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
            const aggs = await client_1.prisma.conversationMetrics.aggregate({
                where: {
                    clientId,
                    firstInboundAt: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                _avg: { firstResponseTimeMs: true },
                _count: { sessionId: true }
            });
            return [{
                    period: 'total',
                    avgFirstResponseTimeMs: aggs._avg.firstResponseTimeMs || 0,
                    sessionsWithResponse: aggs._count.sessionId,
                    sessionsWithoutResponse: 0
                }];
        }
        const timeFormat = groupBy === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
        const metrics = await client_1.prisma.$queryRaw `
        SELECT
            TO_CHAR("firstInboundAt", ${timeFormat}) as period,
            AVG("firstResponseTimeMs") as avg_time,
            COUNT("sessionId") as count
        FROM "conversation_metrics"
        WHERE "clientId" = ${clientId}
          AND "firstInboundAt" >= ${startDate}
          AND "firstInboundAt" <= ${endDate}
        GROUP BY TO_CHAR("firstInboundAt", ${timeFormat})
        ORDER BY period
    `;
        return metrics.map(m => ({
            period: m.period,
            avgFirstResponseTimeMs: Math.round(Number(m.avg_time)),
            sessionsWithResponse: Number(m.count),
            sessionsWithoutResponse: 0
        }));
    }
}
exports.AvgFirstResponseTimeService = AvgFirstResponseTimeService;
