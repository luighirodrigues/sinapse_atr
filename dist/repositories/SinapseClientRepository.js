"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SinapseClientRepository = void 0;
const client_1 = require("../prisma/client");
class SinapseClientRepository {
    async listActive() {
        return client_1.prisma.sinapseClient.findMany({
            where: { isActive: true },
        });
    }
    async listAll() {
        return client_1.prisma.sinapseClient.findMany({
            orderBy: { name: 'asc' },
        });
    }
    async findBySlug(slug) {
        return client_1.prisma.sinapseClient.findUnique({
            where: { slug },
        });
    }
    async create(data) {
        return client_1.prisma.sinapseClient.create({
            data,
        });
    }
    async update(id, data) {
        return client_1.prisma.sinapseClient.update({
            where: { id },
            data,
        });
    }
}
exports.SinapseClientRepository = SinapseClientRepository;
