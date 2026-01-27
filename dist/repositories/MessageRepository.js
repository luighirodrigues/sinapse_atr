"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageRepository = void 0;
const client_1 = require("../prisma/client");
class MessageRepository {
    async upsertMany(messages) {
        return client_1.prisma.$transaction(messages.map((msg) => client_1.prisma.message.upsert({
            where: {
                ticketId_externalMessageId: {
                    ticketId: msg.ticketId, // We assume ticketId is present in UncheckedInput
                    externalMessageId: msg.externalMessageId,
                },
            },
            update: msg,
            create: msg,
        })));
    }
    async listByTicket(ticketId) {
        return client_1.prisma.message.findMany({
            where: { ticketId },
            orderBy: { createdAtExternal: 'asc' },
        });
    }
    async updateSessionId(messageId, sessionId) {
        return client_1.prisma.message.update({
            where: { id: messageId },
            data: { sessionId },
        });
    }
    async updateSessionIdsBatch(updates) {
        // Prisma doesn't have updateMany with different values.
        // We use transaction of updates.
        return client_1.prisma.$transaction(updates.map(u => client_1.prisma.message.update({
            where: { id: u.messageId },
            data: { sessionId: u.sessionId }
        })));
    }
}
exports.MessageRepository = MessageRepository;
