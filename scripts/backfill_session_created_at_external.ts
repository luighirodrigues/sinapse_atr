/**
 * Backfill Session.createdAtExternal from the linked ImportedTracking.
 * Run with: npm run backfill:session-created-at-external
 */
import 'dotenv/config';
import { prisma } from '../src/prisma/client';

async function main() {
  // Update sessions that have originImportedTrackingId but null createdAtExternal
  const result = await prisma.$executeRaw`
    UPDATE sessions s
    SET "createdAtExternal" = t."createdAtExternal"
    FROM imported_trackings t
    WHERE s."originImportedTrackingId" = t.id
      AND s."createdAtExternal" IS NULL
  `;

  console.log(`Updated ${result} session(s) with createdAtExternal from ImportedTracking.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
