import { Prisma, Ticket } from '@prisma/client';
import { prisma } from '../prisma/client';

export class TicketRepository {
  async upsert(data: Prisma.TicketUncheckedCreateInput) {
    return prisma.ticket.upsert({
      where: {
        clientId_externalUuid: {
          clientId: data.clientId,
          externalUuid: data.externalUuid,
        },
      },
      update: {
        ...data,
        updatedAt: undefined,
      },
      create: data,
    });
  }

  async updateLastImportedMessageCreatedAt(id: string, date: Date) {
    return prisma.ticket.update({
      where: { id },
      data: { lastImportedMessageCreatedAt: date },
    });
  }

  async findByUuid(clientId: string, uuid: string) {
    return prisma.ticket.findUnique({
      where: {
        clientId_externalUuid: {
          clientId,
          externalUuid: uuid,
        },
      },
      include: {
        sessions: true,
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  async findFirstByExternalUuid(uuid: string) {
    return prisma.ticket.findFirst({
      where: { externalUuid: uuid },
      include: {
        sessions: true,
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  async findById(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
    });
  }
}
