import { prisma } from '../prisma/client';

export class ImportStateRepository {
  private readonly key: string;

  constructor(key: string = 'tickets_import') {
    this.key = key;
  }

  async getOrCreate(clientId: string, options?: { lastImportAt?: Date; lastPage?: number }) {
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
        lastImportAt:
          options?.lastImportAt ??
          new Date(process.env.IMPORT_START_AT || '2026-01-01T00:00:00.000Z'),
        lastPage: options?.lastPage ?? undefined,
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

  async updateLastPage(clientId: string, lastPage: number | null) {
    return prisma.importState.update({
      where: {
        clientId_key: {
          clientId,
          key: this.key,
        },
      },
      data: { lastPage },
    });
  }
}
