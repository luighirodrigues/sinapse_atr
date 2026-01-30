"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactRepository = void 0;
const client_1 = require("../prisma/client");
class ContactRepository {
    async upsertMinimal(input) {
        return client_1.prisma.contact.upsert({
            where: {
                clientId_id: {
                    clientId: input.clientId,
                    id: input.id,
                },
            },
            update: {
                name: input.name ?? undefined,
                number: input.number ?? undefined,
                email: input.email ?? undefined,
                profilePicUrl: input.profilePicUrl ?? undefined,
            },
            create: {
                clientId: input.clientId,
                id: input.id,
                name: input.name ?? null,
                number: input.number ?? null,
                email: input.email ?? null,
                profilePicUrl: input.profilePicUrl ?? null,
                isGroup: false,
            },
        });
    }
    async upsertFull(input) {
        return client_1.prisma.contact.upsert({
            where: {
                clientId_id: {
                    clientId: input.clientId,
                    id: input.id,
                },
            },
            update: {
                companyId: input.companyId,
                name: input.name,
                number: input.number,
                email: input.email,
                isGroup: input.isGroup,
                socialConnectionId: input.socialConnectionId,
                profilePicUrl: input.profilePicUrl,
                createdAtRemote: input.createdAtRemote,
                updatedAtRemote: input.updatedAtRemote,
            },
            create: {
                clientId: input.clientId,
                id: input.id,
                companyId: input.companyId,
                name: input.name,
                number: input.number,
                email: input.email,
                isGroup: input.isGroup,
                socialConnectionId: input.socialConnectionId,
                profilePicUrl: input.profilePicUrl,
                createdAtRemote: input.createdAtRemote,
                updatedAtRemote: input.updatedAtRemote,
            },
        });
    }
}
exports.ContactRepository = ContactRepository;
