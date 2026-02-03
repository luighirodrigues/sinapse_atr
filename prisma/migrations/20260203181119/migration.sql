-- DropForeignKey
ALTER TABLE "session_analyses" DROP CONSTRAINT "session_analyses_sessionId_fkey";

-- DropIndex
DROP INDEX "ix_messages_sessionid";

-- DropIndex
DROP INDEX "ix_messages_sessionid_updatedatexternal";

-- AlterTable
ALTER TABLE "analysis_scripts" ALTER COLUMN "topics" SET DEFAULT '[]'::jsonb;

-- AddForeignKey
ALTER TABLE "session_analyses" ADD CONSTRAINT "session_analyses_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
