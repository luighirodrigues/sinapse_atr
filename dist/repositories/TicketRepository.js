"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketRepository = void 0;
const client_1 = require("../prisma/client");
class TicketRepository {
    async upsert(data) {
        return client_1.prisma.ticket.upsert({
            where: { externalUuid: data.externalUuid },
            update: {
                ...data,
                updatedAt: undefined, // Let Prisma handle @updatedAt or explicitly set it if needed, but data usually comes with updatedAtExternal
                // We only update fields that might change. 
                // Important: preserve lastImportedMessageCreatedAt if it's not in data (which it usually isn't during ticket sync)
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
    async findByUuid(uuid) {
        return client_1.prisma.ticket.findUnique({
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
