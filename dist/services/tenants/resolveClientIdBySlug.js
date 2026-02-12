"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantNotFoundError = void 0;
exports.resolveClientIdBySlug = resolveClientIdBySlug;
const SinapseClientRepository_1 = require("../../repositories/SinapseClientRepository");
class TenantNotFoundError extends Error {
    constructor(message = 'Client not found') {
        super(message);
        this.name = 'TenantNotFoundError';
        this.statusCode = 404;
    }
}
exports.TenantNotFoundError = TenantNotFoundError;
const clientRepo = new SinapseClientRepository_1.SinapseClientRepository();
async function resolveClientIdBySlug(tenantSlug) {
    const normalizedSlug = String(tenantSlug ?? '').trim();
    const client = await clientRepo.findBySlug(normalizedSlug);
    if (!client) {
        throw new TenantNotFoundError();
    }
    return client.id;
}
