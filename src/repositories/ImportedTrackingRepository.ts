import { Prisma, ImportedTracking } from '@prisma/client';
import { prisma } from '../prisma/client';

export class ImportedTrackingRepository {
  async upsertMany(trackings: Prisma.ImportedTrackingUncheckedCreateInput[]) {
    return prisma.$transaction(async (tx) => {
      const results: ImportedTracking[] = [];
      for (const tracking of trackings) {
        if (tracking.externalTrackingId !== null && tracking.externalTrackingId !== undefined) {
             const existing = await tx.importedTracking.findFirst({
                where: {
                    ticketId: tracking.ticketId,
                    externalTrackingId: tracking.externalTrackingId
                }
            });
            
            if (existing) {
                results.push(await tx.importedTracking.update({
                    where: { id: existing.id },
                    data: tracking
                }));
            } else {
                results.push(await tx.importedTracking.create({ data: tracking }));
            }
        } else {
            results.push(await tx.importedTracking.create({ data: tracking }));
        }
      }
      return results;
    });
  }

  async findUnprocessedWeak(limit = 100) {
    return prisma.importedTracking.findMany({
      where: {
        processedAt: null,
        startedAtExternal: null,
        endedAtExternal: null
      },
      take: limit,
      orderBy: { createdAtExternal: 'asc' }
    });
  }

  async markProcessed(id: string, version: string) {
    return prisma.importedTracking.update({
        where: { id },
        data: {
            processedAt: new Date(),
            processingVersion: version
        }
    });
  }
  
  async findByTicketId(ticketId: string) {
      return prisma.importedTracking.findMany({
          where: { ticketId },
          orderBy: { createdAtExternal: 'asc' }
      });
  }
}
