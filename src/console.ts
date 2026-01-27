import { TicketImportService } from './services/TicketImportService';
import { prisma } from './prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const slug = args[0];

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
