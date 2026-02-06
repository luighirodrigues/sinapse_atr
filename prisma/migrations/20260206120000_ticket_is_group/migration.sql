ALTER TABLE "tickets" ADD COLUMN "isGroup" BOOLEAN NOT NULL DEFAULT false;

UPDATE "tickets" t
SET "isGroup" = COALESCE(c."isGroup", false)
FROM "contacts" c
WHERE c."clientId" = t."clientId"
  AND c."id" = t."contactId";

CREATE INDEX "ix_tickets_client_is_group" ON "tickets" ("clientId", "isGroup");
