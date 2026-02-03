import { prisma } from '../prisma/client';
import { AnalysisScript, Prisma } from '@prisma/client';

export type CreateAnalysisScriptInput = {
  clientId: string;
  scriptKey: string;
  version: number;
  name: string;
  description?: string | null;
  scriptText: string;
  topics: unknown;
  isActive: boolean;
};

export class AnalysisScriptRepository {
  async create(input: CreateAnalysisScriptInput): Promise<AnalysisScript> {
    return prisma.analysisScript.create({
      data: {
        clientId: input.clientId,
        scriptKey: input.scriptKey,
        version: input.version,
        name: input.name,
        description: input.description ?? null,
        scriptText: input.scriptText,
        topics: input.topics as Prisma.InputJsonValue,
        isActive: input.isActive,
      },
    });
  }

  async list(clientId: string, filter?: { scriptKey?: string; activeOnly?: boolean }) {
    const where: Prisma.AnalysisScriptWhereInput = { clientId };
    if (filter?.scriptKey) where.scriptKey = filter.scriptKey;
    if (filter?.activeOnly) where.isActive = true;

    return prisma.analysisScript.findMany({
      where,
      orderBy: [{ scriptKey: 'asc' }, { version: 'desc' }],
    });
  }

  async findByKeyVersion(clientId: string, scriptKey: string, version: number) {
    return prisma.analysisScript.findUnique({
      where: {
        clientId_scriptKey_version: {
          clientId,
          scriptKey,
          version,
        },
      },
    });
  }

  async findActiveHighestVersion(clientId: string, scriptKey: string) {
    return prisma.analysisScript.findFirst({
      where: { clientId, scriptKey, isActive: true },
      orderBy: { version: 'desc' },
    });
  }

  async getNextVersion(clientId: string, scriptKey: string): Promise<number> {
    const row = await prisma.analysisScript.findFirst({
      where: { clientId, scriptKey },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return (row?.version ?? 0) + 1;
  }

  async activate(clientId: string, scriptKey: string, version: number, deactivateOthers: boolean) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.analysisScript.updateMany({
        where: { clientId, scriptKey, version },
        data: { isActive: true, updatedAt: new Date() },
      });

      if (updated.count === 0) return { updated: 0 };

      if (deactivateOthers) {
        await tx.analysisScript.updateMany({
          where: { clientId, scriptKey, version: { not: version } },
          data: { isActive: false, updatedAt: new Date() },
        });
      }

      return { updated: updated.count };
    });
  }
}
