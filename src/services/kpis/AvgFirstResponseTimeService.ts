import { prisma } from '../../prisma/client';
import { MessageSenderType, Prisma } from '@prisma/client';

interface CalculateKpiParams {
  clientId: string;
  startDate: Date;
  endDate: Date;
}

interface GetKpiParams {
  clientId: string;
  startDate: Date;
  endDate: Date;
  groupBy: 'day' | 'month' | 'total';
}

export class AvgFirstResponseTimeService {
  async calculateAndStoreFirstResponseTimes({ clientId, startDate, endDate }: CalculateKpiParams) {
    await prisma.conversationMetrics.deleteMany({
      where: {
        clientId,
        firstInboundAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // 1. Find sessions with inbound in period and their first response
    const results = await prisma.$queryRaw<Array<{ sessionId: string; firstInboundAt: Date; firstOutboundAt: Date | null }>>`
      WITH Inbounds AS (
        SELECT
          m."sessionId",
          MIN(m."createdAtExternal") as "firstInboundAt"
        FROM "messages" m
        JOIN "tickets" t ON m."ticketId" = t."id"
        WHERE t."clientId" = ${clientId}
          AND m."sessionId" IS NOT NULL
          AND m."fromMe" = false
          AND m."senderType" = 'HUMAN'
          AND m."mediaType" IN ('conversation', 'extendedTextMessage')
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
          AND m."createdAtExternal" <= i."firstInboundAt" + INTERVAL '24 hours'
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
      const existing = await prisma.conversationMetrics.findUnique({
        where: {
          clientId_sessionId: {
            clientId,
            sessionId: row.sessionId
          }
        }
      });

      if (existing) {
        await prisma.conversationMetrics.update({
            where: { id: existing.id },
            data: {
                firstInboundAt: row.firstInboundAt,
                firstOutboundAt: row.firstOutboundAt,
                firstResponseTimeMs
            }
        });
        updated++;
      } else {
        await prisma.conversationMetrics.create({
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

  async getAvgFirstResponseTime({ clientId, startDate, endDate, groupBy }: GetKpiParams) {
    if (groupBy === 'total') {
        const aggs = await prisma.conversationMetrics.aggregate({
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
    
    const metrics = await prisma.$queryRaw<Array<{ period: string; avg_time: number; count: number }>>`
        SELECT
            TO_CHAR("firstInboundAt", ${Prisma.raw(`'${timeFormat}'`)}) as period,
            AVG("firstResponseTimeMs") as avg_time,
            COUNT("sessionId") as count
        FROM "conversation_metrics"
        WHERE "clientId" = ${clientId}
          AND "firstInboundAt" >= ${startDate}
          AND "firstInboundAt" <= ${endDate}
        GROUP BY TO_CHAR("firstInboundAt", ${Prisma.raw(`'${timeFormat}'`)})
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
