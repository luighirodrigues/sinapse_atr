"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactTagRepository = void 0;
const client_1 = require("../prisma/client");
class ContactTagRepository {
    async replaceTagsForContact(input) {
        await client_1.prisma.contactTag.deleteMany({
            where: {
                clientId: input.clientId,
                contactId: input.contactId,
            },
        });
        const uniqueTagIds = Array.from(new Set(input.tagIds.map((id) => id.toString()))).map((id) => BigInt(id));
        if (uniqueTagIds.length === 0)
            return;
        await client_1.prisma.contactTag.createMany({
            data: uniqueTagIds.map((tagId) => ({
                clientId: input.clientId,
                contactId: input.contactId,
                tagId,
            })),
        });
    }
}
exports.ContactTagRepository = ContactTagRepository;
