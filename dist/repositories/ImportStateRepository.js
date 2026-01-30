"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportStateRepository = void 0;
const client_1 = require("../prisma/client");
class ImportStateRepository {
    constructor(key = 'tickets_import') {
        this.key = key;
    }
    async getOrCreate(clientId, options) {
        return client_1.prisma.importState.upsert({
            where: {
                clientId_key: {
                    clientId,
                    key: this.key,
                },
            },
            update: {},
            create: {
                clientId,
                key: this.key,
                lastImportAt: options?.lastImportAt ??
                    new Date(process.env.IMPORT_START_AT || '2026-01-01T00:00:00.000Z'),
                lastPage: options?.lastPage ?? undefined,
            },
        });
    }
    async updateLastImportAt(clientId, date) {
        return client_1.prisma.importState.update({
            where: {
                clientId_key: {
                    clientId,
                    key: this.key,
                },
            },
            data: { lastImportAt: date },
        });
    }
    async updateLastPage(clientId, lastPage) {
        return client_1.prisma.importState.update({
            where: {
                clientId_key: {
                    clientId,
                    key: this.key,
                },
            },
            data: { lastPage },
        });
    }
}
exports.ImportStateRepository = ImportStateRepository;
