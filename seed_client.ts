import { prisma } from './src/prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const apiUrl = process.env.SEED_API_URL || process.env.EXTERNAL_API_BASE_URL;
  const apiKey = process.env.SEED_API_KEY || process.env.EXTERNAL_API_TOKEN;

  if (!apiUrl || !apiKey) {
    console.error('Error: API URL and Key must be defined in .env (SEED_API_URL/KEY or EXTERNAL_API_BASE_URL/TOKEN)');
    process.exit(1);
  }

  console.log('Seeding initial client...');
  console.log(`API URL: ${apiUrl}`);

  const client = await prisma.sinapseClient.upsert({
    where: { slug: 'sinapse-default' },
    update: {
        apiBaseUrl: apiUrl,
        apiKey: apiKey,
    },
    create: {
      slug: 'sinapse-default',
      name: 'Sinapse Default Client',
      apiBaseUrl: apiUrl,
      apiKey: apiKey,
      isActive: true,
    },
  });

  console.log(`Client seeded successfully:`);
  console.log(`ID: ${client.id}`);
  console.log(`Slug: ${client.slug}`);
  console.log(`Name: ${client.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
