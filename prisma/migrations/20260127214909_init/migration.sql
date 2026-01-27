-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('CLOSED', 'OPEN_REAL', 'OPEN_WEAK', 'UNTRACKED');

-- CreateTable
CREATE TABLE "sinapse_clients" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiBaseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sinapse_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_states" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastImportAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "import_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "externalUuid" TEXT NOT NULL,
    "externalTicketId" INTEGER,
    "status" TEXT,
    "contactName" TEXT,
    "contactNumber" TEXT,
    "contactExternalId" INTEGER,
    "socialConnectionId" INTEGER,
    "companyId" INTEGER,
    "createdAtExternal" TIMESTAMP(3),
    "updatedAtExternal" TIMESTAMP(3),
    "lastImportedMessageCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "externalTrackingId" INTEGER,
    "type" "SessionType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "assignedUserName" TEXT,
    "assignedUserEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "sessionId" TEXT,
    "externalMessageId" TEXT NOT NULL,
    "key" TEXT,
    "body" TEXT NOT NULL,
    "fromMe" BOOLEAN NOT NULL,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "createdAtExternal" TIMESTAMP(3) NOT NULL,
    "updatedAtExternal" TIMESTAMP(3) NOT NULL,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sinapse_clients_slug_key" ON "sinapse_clients"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "import_states_clientId_key_key" ON "import_states"("clientId", "key");

-- CreateIndex
CREATE INDEX "tickets_clientId_updatedAtExternal_idx" ON "tickets"("clientId", "updatedAtExternal");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_clientId_externalUuid_key" ON "tickets"("clientId", "externalUuid");

-- CreateIndex
CREATE INDEX "sessions_ticketId_startedAt_idx" ON "sessions"("ticketId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_ticketId_externalTrackingId_key" ON "sessions"("ticketId", "externalTrackingId");

-- CreateIndex
CREATE INDEX "messages_ticketId_createdAtExternal_idx" ON "messages"("ticketId", "createdAtExternal");

-- CreateIndex
CREATE UNIQUE INDEX "messages_ticketId_externalMessageId_key" ON "messages"("ticketId", "externalMessageId");

-- AddForeignKey
ALTER TABLE "import_states" ADD CONSTRAINT "import_states_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "sinapse_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "sinapse_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
