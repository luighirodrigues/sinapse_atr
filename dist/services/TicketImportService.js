"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketImportService = void 0;
const ExternalApiService_1 = require("./ExternalApiService");
const ImportStateRepository_1 = require("../repositories/ImportStateRepository");
const TicketRepository_1 = require("../repositories/TicketRepository");
const SessionRepository_1 = require("../repositories/SessionRepository");
const MessageRepository_1 = require("../repositories/MessageRepository");
const SinapseClientRepository_1 = require("../repositories/SinapseClientRepository");
const NormalizationService_1 = require("./NormalizationService");
const client_1 = require("@prisma/client");
class TicketImportService {
    constructor() {
        this.importStateRepo = new ImportStateRepository_1.ImportStateRepository();
        this.ticketRepo = new TicketRepository_1.TicketRepository();
        this.sessionRepo = new SessionRepository_1.SessionRepository();
        this.messageRepo = new MessageRepository_1.MessageRepository();
        this.clientRepo = new SinapseClientRepository_1.SinapseClientRepository();
        this.normalization = new NormalizationService_1.NormalizationService();
    }
    async runImport(slug) {
        console.log('Starting import job...');
        let clients = [];
        if (slug) {
            const client = await this.clientRepo.findBySlug(slug);
            if (client && client.isActive)
                clients = [client];
            else
                console.log(`Client ${slug} not found or inactive.`);
        }
        else {
            clients = await this.clientRepo.listActive();
        }
        console.log(`Found ${clients.length} clients to process.`);
        for (const client of clients) {
            console.log(`Processing client: ${client.slug}`);
            try {
                await this.processClient(client);
            }
            catch (e) {
                console.error(`Error processing client ${client.slug}:`, e);
            }
        }
        console.log('Import job finished.');
    }
    async processClient(client) {
        const api = (0, ExternalApiService_1.createExternalApiClient)(client);
        const importState = await this.importStateRepo.getOrCreate(client.id);
        const lastImportAt = importState.lastImportAt;
        let maxUpdatedAt = lastImportAt;
        let page = 1;
        let hasMore = true;
        let processedCount = 0;
        // 1. Fetch Tickets
        while (hasMore) {
            console.log(`[${client.slug}] Fetching tickets page ${page}...`);
            const response = await api.getTickets({ page, limit: 50 });
            const tickets = Array.isArray(response) ? response : response.data;
            if (tickets.length === 0) {
                hasMore = false;
                break;
            }
            // Filter by updatedAt >= lastImportAt
            const newTickets = tickets.filter(t => new Date(t.updatedAt) >= lastImportAt);
            if (newTickets.length === 0 && tickets.length > 0) {
                // Continue
            }
            for (const ticket of newTickets) {
                await this.processTicket(client.id, api, ticket);
                const ticketUpdatedAt = new Date(ticket.updatedAt);
                if (ticketUpdatedAt > maxUpdatedAt) {
                    maxUpdatedAt = ticketUpdatedAt;
                }
            }
            processedCount += newTickets.length;
            if ('meta' in response && response.meta) {
                if (page >= response.meta.totalPages || page >= (response.meta.last_page || 9999))
                    hasMore = false;
            }
            else if (tickets.length < 50) {
                hasMore = false;
            }
            page++;
        }
        // Update import state
        const margin = 2 * 60 * 1000;
        const newLastImportAt = new Date(maxUpdatedAt.getTime() - margin);
        await this.importStateRepo.updateLastImportAt(client.id, newLastImportAt);
        console.log(`[${client.slug}] Import finished. Processed ${processedCount} tickets.`);
    }
    async processTicket(clientId, api, externalTicket) {
        // 1. Upsert Ticket
        const ticket = await this.ticketRepo.upsert({
            externalUuid: externalTicket.uuid,
            clientId: clientId,
            status: externalTicket.status,
            contactName: externalTicket.contact?.name,
            contactNumber: externalTicket.contact?.number,
            contactExternalId: externalTicket.contact?.id,
            companyId: externalTicket.companyId,
            createdAtExternal: new Date(externalTicket.createdAt),
            updatedAtExternal: new Date(externalTicket.updatedAt),
        });
        // 2. Normalize and Upsert Sessions
        const normalized = this.normalization.normalizeTrackings(externalTicket.ticketTrakings);
        await this.sessionRepo.upsertMany(normalized.closed.map(s => ({
            ticketId: ticket.id,
            externalTrackingId: s.externalTrackingId,
            type: s.type,
            startedAt: s.startedAt,
            endedAt: s.endedAt,
            assignedUserName: s.assignedUser?.name,
            assignedUserEmail: s.assignedUser?.email,
        })));
        if (normalized.open) {
            await this.sessionRepo.syncOpenSession(ticket.id, {
                ticketId: ticket.id,
                externalTrackingId: normalized.open.externalTrackingId,
                type: normalized.open.type,
                startedAt: normalized.open.startedAt,
                endedAt: normalized.open.endedAt,
                assignedUserName: normalized.open.assignedUser?.name,
                assignedUserEmail: normalized.open.assignedUser?.email,
            });
        }
        else {
            await this.sessionRepo.syncOpenSession(ticket.id, null);
        }
        // 3. Import Messages
        await this.importMessagesForTicket(api, externalTicket.uuid, ticket.id, ticket.lastImportedMessageCreatedAt);
    }
    async importMessagesForTicket(api, uuid, ticketDbId, cursor) {
        let page = 1;
        let hasMore = true;
        let maxCreatedAt = cursor;
        const limit = 20;
        while (hasMore) {
            const response = await api.getMessages(uuid, { page, limit });
            let messages = [];
            if (Array.isArray(response)) {
                messages = response;
            }
            else if (response && Array.isArray(response.messages)) {
                messages = response.messages;
            }
            else if (response && Array.isArray(response.data)) {
                messages = response.data;
            }
            else {
                messages = [];
            }
            if (messages.length === 0) {
                hasMore = false;
                break;
            }
            const sortedMessages = messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const newMessages = [];
            for (const msg of sortedMessages) {
                const msgCreatedAt = new Date(msg.createdAt);
                if (cursor && msgCreatedAt <= cursor) {
                    hasMore = false;
                    continue;
                }
                newMessages.push(msg);
                if (!maxCreatedAt || msgCreatedAt > maxCreatedAt) {
                    maxCreatedAt = msgCreatedAt;
                }
            }
            if (newMessages.length > 0) {
                await this.messageRepo.upsertMany(newMessages.map(m => ({
                    ticketId: ticketDbId,
                    externalMessageId: String(m.id),
                    key: m.key,
                    body: m.body,
                    fromMe: m.fromMe,
                    mediaUrl: m.mediaUrl,
                    mediaType: m.mediaType,
                    createdAtExternal: new Date(m.createdAt),
                    updatedAtExternal: new Date(m.updatedAt),
                })));
            }
            if (messages.length < limit) {
                hasMore = false;
            }
            if (response && typeof response === 'object' && !Array.isArray(response)) {
                if ('hasMore' in response)
                    hasMore = !!response.hasMore;
                if ('totalPages' in response && 'currentPage' in response) {
                    if (Number(response.currentPage) >= Number(response.totalPages))
                        hasMore = false;
                }
            }
            page++;
        }
        await this.reassignSessions(ticketDbId);
        if (maxCreatedAt && (!cursor || maxCreatedAt > cursor)) {
            await this.ticketRepo.updateLastImportedMessageCreatedAt(ticketDbId, maxCreatedAt);
        }
    }
    async reassignSessions(ticketId) {
        const sessions = await this.sessionRepo.listByTicket(ticketId);
        const closed = sessions.filter(s => s.type === client_1.SessionType.CLOSED);
        const open = sessions.find(s => s.type !== client_1.SessionType.CLOSED);
        const messages = await this.messageRepo.listByTicket(ticketId);
        const updates = [];
        let openStartEffective = open?.startedAt;
        if (open && open.type === client_1.SessionType.OPEN_WEAK && messages.length > 0) {
            const firstMsgDate = messages[0].createdAtExternal;
            if (firstMsgDate < open.startedAt) {
                openStartEffective = firstMsgDate;
            }
        }
        for (const msg of messages) {
            let assignedSessionId = null;
            const msgDate = msg.createdAtExternal;
            const matchedClosed = closed.find(s => s.startedAt <= msgDate && s.endedAt && msgDate <= s.endedAt);
            if (matchedClosed) {
                assignedSessionId = matchedClosed.id;
            }
            else if (open && openStartEffective && msgDate >= openStartEffective) {
                assignedSessionId = open.id;
            }
            if (msg.sessionId !== assignedSessionId) {
                updates.push({ messageId: msg.id, sessionId: assignedSessionId });
            }
        }
        if (updates.length > 0) {
            await this.messageRepo.updateSessionIdsBatch(updates);
        }
    }
}
exports.TicketImportService = TicketImportService;
