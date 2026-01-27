import { Prisma, Message } from '@prisma/client';
import { prisma } from '../prisma/client';

export class MessageRepository {
  async upsertMany(messages: Prisma.MessageUncheckedCreateInput[]) {
    return prisma.$transaction(
      messages.map((msg) =>
        prisma.message.upsert({
          where: {
            ticketId_externalMessageId: {
              ticketId: msg.ticketId, // We assume ticketId is present in UncheckedInput
              externalMessageId: msg.externalMessageId,
            },
          },
          update: msg,
          create: msg,
        })
      )
    );
  }

  async listByTicket(ticketId: string) {
    return prisma.message.findMany({
      where: { ticketId },
      orderBy: { createdAtExternal: 'asc' },
    });
  }

  async updateSessionId(messageId: string, sessionId: string | null) {
    return prisma.message.update({
      where: { id: messageId },
      data: { sessionId },
    });
  }
  
  async updateSessionIdsBatch(updates: { messageId: string; sessionId: string | null }[]) {
      // Prisma doesn't have updateMany with different values.
      // We use transaction of updates.
      return prisma.$transaction(
          updates.map(u => prisma.message.update({
              where: { id: u.messageId },
              data: { sessionId: u.sessionId }
          }))
      );
  }
}
