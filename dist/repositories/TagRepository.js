"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TagRepository = void 0;
const client_1 = require("../prisma/client");
class TagRepository {
    async upsert(input) {
        return client_1.prisma.tag.upsert({
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
exports.TagRepository = TagRepository;
