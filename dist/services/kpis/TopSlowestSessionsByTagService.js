"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopSlowestSessionsByTagService = void 0;
const client_1 = require("../../prisma/client");
class TopSlowestSessionsByTagService {
    async getTopSlowestSessionsByTag({ clientId, startDate, endDate, tag, limit, includeTags }) {
        const normalizedTag = typeof tag === 'string' && tag.trim() ? tag.trim() : undefined;
        if (includeTags) {
            const rows = normalizedTag
                ? await client_1.prisma.$queryRaw `
            WITH Ranked AS (
              SELECT
                s."id" as "sessionId",
                s."ticketId" as "ticketId",
                t."externalUuid" as "ticketExternalUuid",
                s."startedAt" as "startedAt",
                s."endedAt" as "endedAt",
                EXTRACT(EPOCH FROM (s."endedAt" - s."startedAt")) * 1000 as "durationMs",
                s."assignedUserName" as "assignedUserName",
                s."assignedUserEmail" as "assignedUserEmail",
                t."contactId" as "contactId",
                c."name" as "contactName",
                c."number" as "contactNumber"
              FROM "sessions" s
              JOIN "tickets" t ON s."ticketId" = t."id"
              LEFT JOIN "contacts" c
                ON c."clientId" = t."clientId"
               AND c."id" = t."contactId"
              WHERE t."clientId" = ${clientId}
                AND s."endedAt" IS NOT NULL
                AND s."startedAt" >= ${startDate}
                AND s."startedAt" < ${endDate}
                AND t."contactId" IS NOT NULL
                AND EXISTS (
                  SELECT 1
                  FROM "contact_tags" ct2
                  JOIN "tags" tag2
                    ON tag2."clientId" = ct2."clientId"
                   AND tag2."id" = ct2."tagId"
                  WHERE ct2."clientId" = t."clientId"
                    AND ct2."contactId" = t."contactId"
                    AND LOWER(tag2."name") = LOWER(${normalizedTag})
                )
              ORDER BY "durationMs" DESC
              LIMIT ${limit}
            )
            SELECT
              r.*,
              COALESCE(tags."contactTags", ARRAY['Sem tag']::text[]) as "contactTags"
            FROM Ranked r
            LEFT JOIN LATERAL (
              SELECT
                ARRAY_AGG(DISTINCT tag."name" ORDER BY tag."name") as "contactTags"
              FROM "contact_tags" ct
              JOIN "tags" tag
                ON tag."clientId" = ct."clientId"
               AND tag."id" = ct."tagId"
              WHERE ct."clientId" = ${clientId}
                AND ct."contactId" = r."contactId"
            ) tags ON true
            ORDER BY r."durationMs" DESC
          `
                : await client_1.prisma.$queryRaw `
            WITH Ranked AS (
              SELECT
                s."id" as "sessionId",
                s."ticketId" as "ticketId",
                t."externalUuid" as "ticketExternalUuid",
                s."startedAt" as "startedAt",
                s."endedAt" as "endedAt",
                EXTRACT(EPOCH FROM (s."endedAt" - s."startedAt")) * 1000 as "durationMs",
                s."assignedUserName" as "assignedUserName",
                s."assignedUserEmail" as "assignedUserEmail",
                t."contactId" as "contactId",
                c."name" as "contactName",
                c."number" as "contactNumber"
              FROM "sessions" s
              JOIN "tickets" t ON s."ticketId" = t."id"
              LEFT JOIN "contacts" c
                ON c."clientId" = t."clientId"
               AND c."id" = t."contactId"
              WHERE t."clientId" = ${clientId}
                AND s."endedAt" IS NOT NULL
                AND s."startedAt" >= ${startDate}
                AND s."startedAt" < ${endDate}
                AND t."contactId" IS NOT NULL
              ORDER BY "durationMs" DESC
              LIMIT ${limit}
            )
            SELECT
              r.*,
              COALESCE(tags."contactTags", ARRAY['Sem tag']::text[]) as "contactTags"
            FROM Ranked r
            LEFT JOIN LATERAL (
              SELECT
                ARRAY_AGG(DISTINCT tag."name" ORDER BY tag."name") as "contactTags"
              FROM "contact_tags" ct
              JOIN "tags" tag
                ON tag."clientId" = ct."clientId"
               AND tag."id" = ct."tagId"
              WHERE ct."clientId" = ${clientId}
                AND ct."contactId" = r."contactId"
            ) tags ON true
            ORDER BY r."durationMs" DESC
          `;
            return rows.map((row) => ({
                sessionId: row.sessionId,
                ticketId: row.ticketId,
                ticketExternalUuid: row.ticketExternalUuid,
                startedAt: row.startedAt,
                endedAt: row.endedAt,
                durationMs: Math.round(Number(row.durationMs)),
                assignedUserName: row.assignedUserName,
                assignedUserEmail: row.assignedUserEmail,
                contactId: String(row.contactId),
                contactName: row.contactName,
                contactNumber: row.contactNumber,
                contactTags: row.contactTags?.length ? row.contactTags : ['Sem tag'],
            }));
        }
        const rows = normalizedTag
            ? await client_1.prisma.$queryRaw `
          SELECT
            s."id" as "sessionId",
            s."ticketId" as "ticketId",
            t."externalUuid" as "ticketExternalUuid",
            s."startedAt" as "startedAt",
            s."endedAt" as "endedAt",
            EXTRACT(EPOCH FROM (s."endedAt" - s."startedAt")) * 1000 as "durationMs",
            s."assignedUserName" as "assignedUserName",
            s."assignedUserEmail" as "assignedUserEmail",
            t."contactId" as "contactId",
            c."name" as "contactName",
            c."number" as "contactNumber"
          FROM "sessions" s
          JOIN "tickets" t ON s."ticketId" = t."id"
          LEFT JOIN "contacts" c
            ON c."clientId" = t."clientId"
           AND c."id" = t."contactId"
          WHERE t."clientId" = ${clientId}
            AND s."endedAt" IS NOT NULL
            AND s."startedAt" >= ${startDate}
            AND s."startedAt" < ${endDate}
            AND t."contactId" IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM "contact_tags" ct2
              JOIN "tags" tag2
                ON tag2."clientId" = ct2."clientId"
               AND tag2."id" = ct2."tagId"
              WHERE ct2."clientId" = t."clientId"
                AND ct2."contactId" = t."contactId"
                AND LOWER(tag2."name") = LOWER(${normalizedTag})
            )
          ORDER BY "durationMs" DESC
          LIMIT ${limit}
        `
            : await client_1.prisma.$queryRaw `
          SELECT
            s."id" as "sessionId",
            s."ticketId" as "ticketId",
            t."externalUuid" as "ticketExternalUuid",
            s."startedAt" as "startedAt",
            s."endedAt" as "endedAt",
            EXTRACT(EPOCH FROM (s."endedAt" - s."startedAt")) * 1000 as "durationMs",
            s."assignedUserName" as "assignedUserName",
            s."assignedUserEmail" as "assignedUserEmail",
            t."contactId" as "contactId",
            c."name" as "contactName",
            c."number" as "contactNumber"
          FROM "sessions" s
          JOIN "tickets" t ON s."ticketId" = t."id"
          LEFT JOIN "contacts" c
            ON c."clientId" = t."clientId"
           AND c."id" = t."contactId"
          WHERE t."clientId" = ${clientId}
            AND s."endedAt" IS NOT NULL
            AND s."startedAt" >= ${startDate}
            AND s."startedAt" < ${endDate}
            AND t."contactId" IS NOT NULL
          ORDER BY "durationMs" DESC
          LIMIT ${limit}
        `;
        return rows.map((row) => ({
            sessionId: row.sessionId,
            ticketId: row.ticketId,
            ticketExternalUuid: row.ticketExternalUuid,
            startedAt: row.startedAt,
            endedAt: row.endedAt,
            durationMs: Math.round(Number(row.durationMs)),
            assignedUserName: row.assignedUserName,
            assignedUserEmail: row.assignedUserEmail,
            contactId: String(row.contactId),
            contactName: row.contactName,
            contactNumber: row.contactNumber,
        }));
    }
}
exports.TopSlowestSessionsByTagService = TopSlowestSessionsByTagService;
