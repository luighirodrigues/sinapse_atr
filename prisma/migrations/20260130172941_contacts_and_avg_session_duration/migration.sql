-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('HUMAN', 'SYSTEM', 'AI');

-- AlterTable
ALTER TABLE "import_states" ADD COLUMN     "lastPage" INTEGER;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "senderType" "MessageSenderType" NOT NULL DEFAULT 'HUMAN';

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "originImportedTrackingId" TEXT,
ADD COLUMN     "processingVersion" TEXT,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "contactId" BIGINT;

-- CreateTable
CREATE TABLE "contacts" (
    "id" BIGINT NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" BIGINT,
    "name" TEXT,
    "number" TEXT,
    "email" TEXT,
    "isGroup" BOOLEAN NOT NULL,
    "socialConnectionId" BIGINT,
    "profilePicUrl" TEXT,
    "createdAtRemote" TIMESTAMP(3),
    "updatedAtRemote" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("clientId","id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" BIGINT NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" BIGINT,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("clientId","id")
);

-- CreateTable
CREATE TABLE "contact_tags" (
    "clientId" TEXT NOT NULL,
    "contactId" BIGINT NOT NULL,
    "tagId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("clientId","contactId","tagId")
);

-- CreateTable
CREATE TABLE "imported_trackings" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "externalTrackingId" INTEGER,
    "createdAtExternal" TIMESTAMP(3) NOT NULL,
    "startedAtExternal" TIMESTAMP(3),
    "endedAtExternal" TIMESTAMP(3),
    "lastRebuildMessageCreatedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "processingVersion" TEXT,
    "processingNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imported_trackings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_metrics" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "firstInboundAt" TIMESTAMPTZ NOT NULL,
    "firstOutboundAt" TIMESTAMPTZ NOT NULL,
    "firstResponseTimeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_clientId_number_idx" ON "contacts"("clientId", "number");

-- CreateIndex
CREATE INDEX "tags_clientId_name_idx" ON "tags"("clientId", "name");

-- CreateIndex
CREATE INDEX "contact_tags_clientId_tagId_idx" ON "contact_tags"("clientId", "tagId");

-- CreateIndex
CREATE INDEX "imported_trackings_ticketId_idx" ON "imported_trackings"("ticketId");

-- CreateIndex
CREATE INDEX "conversation_metrics_clientId_firstInboundAt_idx" ON "conversation_metrics"("clientId", "firstInboundAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_metrics_clientId_sessionId_key" ON "conversation_metrics"("clientId", "sessionId");

-- CreateIndex
CREATE INDEX "messages_ticketId_sessionId_createdAt_idx" ON "messages"("ticketId", "sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_ticketId_sessionId_fromMe_createdAt_idx" ON "messages"("ticketId", "sessionId", "fromMe", "createdAt");

-- CreateIndex
CREATE INDEX "tickets_clientId_contactId_idx" ON "tickets"("clientId", "contactId");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_clientId_contactId_fkey" FOREIGN KEY ("clientId", "contactId") REFERENCES "contacts"("clientId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_clientId_contactId_fkey" FOREIGN KEY ("clientId", "contactId") REFERENCES "contacts"("clientId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_clientId_tagId_fkey" FOREIGN KEY ("clientId", "tagId") REFERENCES "tags"("clientId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_trackings" ADD CONSTRAINT "imported_trackings_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_originImportedTrackingId_fkey" FOREIGN KEY ("originImportedTrackingId") REFERENCES "imported_trackings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_metrics" ADD CONSTRAINT "conversation_metrics_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "sinapse_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
