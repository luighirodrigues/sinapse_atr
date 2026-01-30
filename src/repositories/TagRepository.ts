import { prisma } from '../prisma/client';

type UpsertTagInput = {
  clientId: string;
  id: bigint;
  companyId: bigint | null;
  name: string;
  color: string | null;
};

export class TagRepository {
  async upsert(input: UpsertTagInput) {
    return prisma.tag.upsert({
      where: {
        clientId_id: {
          clientId: input.clientId,
          id: input.id,
        },
      },
      update: {
        companyId: input.companyId,
        name: input.name,
        color: input.color,
      },
      create: {
        clientId: input.clientId,
        id: input.id,
        companyId: input.companyId,
        name: input.name,
        color: input.color,
      },
    });
  }
}
