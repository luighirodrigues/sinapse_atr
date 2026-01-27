import { prisma } from '../prisma/client';

export class ImportStateRepository {
  private readonly key = 'tickets_import';

  async getOrCreate(clientId: string) {
    return prisma.importState.upsert({
      where: {
        clientId_key: {
          clientId,
          key: this.key,
        },
      },
      update: {},
      create: {
        clientId,
        key: this.key,
        lastImportAt: new Date(process.env.IMPORT_START_AT || '2026-01-01T00:00:00.000Z'),
      },
    });
  }

  async updateLastImportAt(clientId: string, date: Date) {
    return prisma.importState.update({
      where: {
        clientId_key: {
          clientId,
          key: this.key,
        },
      },
      data: { lastImportAt: date },
    });
  }
}
