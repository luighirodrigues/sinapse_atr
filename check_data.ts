
import { PrismaClient } from '@prisma/client';
import { env } from './src/config/env';

const prisma = new PrismaClient();

async function main() {
    const clientSlug = 'tterrasul';
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-01-28');
    endDate.setHours(23, 59, 59, 999);

    console.log(`Checking data for client: ${clientSlug}`);
    console.log(`Period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const client = await prisma.sinapseClient.findUnique({
        where: { slug: clientSlug }
    });

    if (!client) {
        console.error('Client not found');
        return;
    }

    console.log(`Client ID: ${client.id}`);

    // Check Messages count in period
    const totalMessages = await prisma.message.count({
        where: {
            ticket: { clientId: client.id },
            createdAt: {
                gte: startDate,
                lte: endDate
            }
        }
    });
    console.log(`Total messages in period (createdAt): ${totalMessages}`);
    
    // Check Messages count by createdAtExternal
    const totalMessagesExt = await prisma.message.count({
        where: {
            ticket: { clientId: client.id },
            createdAtExternal: {
                gte: startDate,
                lte: endDate
            }
        }
    });
    console.log(`Total messages in period (createdAtExternal): ${totalMessagesExt}`);

    // Sample Inbound Messages
    const sampleInbounds = await prisma.message.findMany({
        where: {
            ticket: { clientId: client.id },
            fromMe: false,
            createdAtExternal: {
                gte: startDate,
                lte: endDate
            }
        },
        take: 5,
        select: {
            id: true,
            body: true,
            mediaType: true,
            senderType: true,
            createdAt: true,
            createdAtExternal: true,
            sessionId: true
        }
    });

    console.log('Sample Inbound Messages:', JSON.stringify(sampleInbounds, null, 2));

    // Sample Outbound Messages
    const sampleOutbounds = await prisma.message.findMany({
        where: {
            ticket: { clientId: client.id },
            fromMe: true,
            createdAtExternal: {
                gte: startDate,
                lte: endDate
            }
        },
        take: 5,
        select: {
            id: true,
            body: true,
            mediaType: true,
            senderType: true,
            createdAt: true,
            createdAtExternal: true,
            sessionId: true
        }
    });

    console.log('Sample Outbound Messages:', JSON.stringify(sampleOutbounds, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
