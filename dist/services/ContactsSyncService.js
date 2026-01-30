"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactsSyncService = void 0;
const ExternalApiService_1 = require("./ExternalApiService");
const SinapseClientRepository_1 = require("../repositories/SinapseClientRepository");
const ImportStateRepository_1 = require("../repositories/ImportStateRepository");
const ContactRepository_1 = require("../repositories/ContactRepository");
const TagRepository_1 = require("../repositories/TagRepository");
const ContactTagRepository_1 = require("../repositories/ContactTagRepository");
function toBigInt(value) {
    return BigInt(String(value));
}
class ContactsSyncService {
    constructor() {
        this.clientRepo = new SinapseClientRepository_1.SinapseClientRepository();
        this.stateRepo = new ImportStateRepository_1.ImportStateRepository('contacts:page');
        this.contactRepo = new ContactRepository_1.ContactRepository();
        this.tagRepo = new TagRepository_1.TagRepository();
        this.contactTagRepo = new ContactTagRepository_1.ContactTagRepository();
    }
    async runImport(slug) {
        let clients = [];
        if (slug) {
            const client = await this.clientRepo.findBySlug(slug);
            if (client && client.isActive)
                clients = [client];
        }
        else {
            clients = await this.clientRepo.listActive();
        }
        for (const client of clients) {
            try {
                await this.processClient(client);
            }
            catch (e) {
                console.error(`Error syncing contacts for client ${client.slug}:`, e);
            }
        }
    }
    async processClient(client) {
        const api = (0, ExternalApiService_1.createExternalApiClient)(client);
        const state = await this.stateRepo.getOrCreate(client.id, { lastPage: 0 });
        const limit = 50;
        let page = (state.lastPage ?? 0) + 1;
        let hasMore = true;
        while (hasMore) {
            console.log(`[${client.slug}] Fetching contacts page ${page}...`);
            const response = await api.getContacts({ page, limit });
            const { contacts, totalPages } = this.extractContactsResponse(response);
            if (contacts.length === 0) {
                hasMore = false;
                break;
            }
            const uniqueTags = new Map();
            for (const contact of contacts) {
                const tags = contact.tags ?? [];
                for (const tag of tags) {
                    if (tag?.id == null || !tag?.name)
                        continue;
                    uniqueTags.set(`${tag.id}`, tag);
                }
            }
            for (const tag of uniqueTags.values()) {
                await this.tagRepo.upsert({
                    clientId: client.id,
                    id: toBigInt(tag.id),
                    companyId: tag.companyId != null ? toBigInt(tag.companyId) : null,
                    name: tag.name,
                    color: tag.color ?? null,
                });
            }
            for (const contact of contacts) {
                if (contact?.id == null)
                    continue;
                const contactId = toBigInt(contact.id);
                await this.contactRepo.upsertFull({
                    clientId: client.id,
                    id: contactId,
                    companyId: contact.companyId != null ? toBigInt(contact.companyId) : null,
                    name: contact.name ?? null,
                    number: contact.number ?? null,
                    email: contact.email ?? null,
                    isGroup: Boolean(contact.isGroup),
                    socialConnectionId: contact.socialConnectionId != null ? toBigInt(contact.socialConnectionId) : null,
                    profilePicUrl: contact.profilePicUrl ?? null,
                    createdAtRemote: contact.createdAt ? new Date(contact.createdAt) : null,
                    updatedAtRemote: contact.updatedAt ? new Date(contact.updatedAt) : null,
                });
                const tagIds = (contact.tags ?? [])
                    .filter((t) => t?.id != null)
                    .map((t) => toBigInt(t.id));
                await this.contactTagRepo.replaceTagsForContact({
                    clientId: client.id,
                    contactId,
                    tagIds,
                });
            }
            await this.stateRepo.updateLastPage(client.id, page);
            if (totalPages != null && page >= totalPages) {
                hasMore = false;
            }
            else if (contacts.length < limit) {
                hasMore = false;
            }
            else {
                page++;
            }
        }
        await this.stateRepo.updateLastPage(client.id, 0);
    }
    extractContactsResponse(response) {
        const contacts = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
                ? response.data
                : Array.isArray(response?.contacts)
                    ? response.contacts
                    : [];
        const meta = response?.meta ?? response?.pagination ?? null;
        const totalPages = meta?.totalPages != null
            ? Number(meta.totalPages)
            : meta?.last_page != null
                ? Number(meta.last_page)
                : meta?.total_pages != null
                    ? Number(meta.total_pages)
                    : null;
        return { contacts, totalPages };
    }
}
exports.ContactsSyncService = ContactsSyncService;
