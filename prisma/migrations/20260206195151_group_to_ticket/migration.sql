-- AlterTable
ALTER TABLE "analysis_scripts" ALTER COLUMN "topics" SET DEFAULT '[]'::jsonb;

-- RenameIndex
ALTER INDEX "ix_tickets_client_is_group" RENAME TO "tickets_clientId_isGroup_idx";
