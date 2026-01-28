import { TicketImportService } from './services/TicketImportService';
import { RecreateSessionsService } from './services/RecreateSessionsService';
import { prisma } from './prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  
  // Debug arguments
  console.log('Received arguments:', args);

  // Find arguments regardless of position
  const isRecreate = args.includes('--recreate');
  const slug = args.find(arg => arg !== '--recreate' && !arg.startsWith('-'));

  if (isRecreate) {
    const service = new RecreateSessionsService();
    try {
      console.log('Starting idempotent rebuild service (checking for new messages)...');
      await service.runRecreation();
      console.log('Rebuild completed.');
      process.exit(0);
    } catch (e) {
      console.error('Recreation failed:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }

  const service = new TicketImportService();
  try {
    if (slug) {
      console.log(`Starting import for client: ${slug}`);
      await service.runImport(slug);
    } else {
      console.log('Starting import for ALL active clients');
      await service.runImport();
    }
    console.log('Job completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Job failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
