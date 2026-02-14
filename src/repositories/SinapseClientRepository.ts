import { prisma } from '../prisma/client';
import { SinapseClient } from '@prisma/client';

export class SinapseClientRepository {
  async listActive() {
    return prisma.sinapseClient.findMany({
      where: { isActive: true },
    });
  }

  async listAll() {
    return prisma.sinapseClient.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    return prisma.sinapseClient.findUnique({
      where: { slug },
    });
  }

  async findById(id: string) {
    return prisma.sinapseClient.findUnique({
      where: { id },
    });
  }

  async create(data: Omit<SinapseClient, 'id' | 'createdAt' | 'updatedAt'>) {
    return prisma.sinapseClient.create({
      data,
    });
  }

  async update(id: string, data: Partial<SinapseClient>) {
    return prisma.sinapseClient.update({
      where: { id },
      data,
    });
  }

  async upsertBySlug(
    slug: string,
    data: Pick<SinapseClient, 'name' | 'apiBaseUrl' | 'apiKey' | 'isActive'>
  ) {
    return prisma.sinapseClient.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    });
  }
}
