"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketRepository = void 0;
const client_1 = require("../prisma/client");
class TicketRepository {
    async upsert(data) {
        return client_1.prisma.ticket.upsert({
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
    async updateLastImportedMessageCreatedAt(id, date) {
        return client_1.prisma.ticket.update({
            where: { id },
            data: { lastImportedMessageCreatedAt: date },
        });
    }
    async findByUuid(clientId, uuid) {
        return client_1.prisma.ticket.findUnique({
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
    async findFirstByExternalUuid(uuid) {
        return client_1.prisma.ticket.findFirst({
            where: { externalUuid: uuid },
            include: {
                sessions: true,
                _count: {
                    select: { messages: true },
                },
            },
        });
    }
    async findById(id) {
        return client_1.prisma.ticket.findUnique({
            where: { id },
        });
    }
}
exports.TicketRepository = TicketRepository;
