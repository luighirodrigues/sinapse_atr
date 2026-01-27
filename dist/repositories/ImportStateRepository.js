"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportStateRepository = void 0;
const client_1 = require("../prisma/client");
class ImportStateRepository {
    constructor() {
        this.key = 'tickets_import';
    }
    async getOrCreate() {
        return client_1.prisma.importState.upsert({
            where: { key: this.key },
            update: {},
            create: {
                key: this.key,
                lastImportAt: new Date(process.env.IMPORT_START_AT || '2026-01-01T00:00:00.000Z'),
            },
        });
    }
    async updateLastImportAt(date) {
        return client_1.prisma.importState.update({
            where: { key: this.key },
            data: { lastImportAt: date },
        });
    }
}
exports.ImportStateRepository = ImportStateRepository;
