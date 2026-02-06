"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketImportService = void 0;
const ExternalApiService_1 = require("./ExternalApiService");
const ImportStateRepository_1 = require("../repositories/ImportStateRepository");
const TicketRepository_1 = require("../repositories/TicketRepository");
const SessionRepository_1 = require("../repositories/SessionRepository");
const MessageRepository_1 = require("../repositories/MessageRepository");
const SinapseClientRepository_1 = require("../repositories/SinapseClientRepository");
const ImportedTrackingRepository_1 = require("../repositories/ImportedTrackingRepository");
const ContactRepository_1 = require("../repositories/ContactRepository");
const NormalizationService_1 = require("./NormalizationService");
const client_1 = require("@prisma/client");
class TicketImportService {
    constructor() {
        this.importStateRepo = new ImportStateRepository_1.ImportStateRepository();
        this.ticketRepo = new TicketRepository_1.TicketRepository();
        this.sessionRepo = new SessionRepository_1.SessionRepository();
        this.messageRepo = new MessageRepository_1.MessageRepository();
        this.clientRepo = new SinapseClientRepository_1.SinapseClientRepository();
        this.importedTrackingRepo = new ImportedTrackingRepository_1.ImportedTrackingRepository();
        this.contactRepo = new ContactRepository_1.ContactRepository();
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
        const contactRemoteId = externalTicket.contact?.id;
        const contactId = contactRemoteId != null ? BigInt(String(contactRemoteId)) : undefined;
        if (contactId !== undefined) {
            await this.contactRepo.upsertMinimal({
                clientId,
                id: contactId,
                name: externalTicket.contact?.name,
                number: externalTicket.contact?.number,
                email: externalTicket.contact?.email,
                profilePicUrl: externalTicket.contact?.profilePicUrl,
            });
        }
        // 1. Upsert Ticket
        const ticket = await this.ticketRepo.upsert({
            externalUuid: externalTicket.uuid,
            clientId: clientId,
            status: externalTicket.status,
            isGroup: Boolean(externalTicket.isGroup),
            contactName: externalTicket.contact?.name,
            contactNumber: externalTicket.contact?.number,
            contactExternalId: externalTicket.contact?.id,
            contactId,
            companyId: externalTicket.companyId,
            createdAtExternal: new Date(externalTicket.createdAt),
            updatedAtExternal: new Date(externalTicket.updatedAt),
        });
        // 2. Import Raw Trackings (Policy A)
        const rawTrackings = externalTicket.ticketTrakings || [];
        await this.importedTrackingRepo.upsertMany(rawTrackings.map(t => ({
            ticketId: ticket.id,
            externalTrackingId: t.id,
            createdAtExternal: new Date(t.createdAt),
            startedAtExternal: t.startedAt ? new Date(t.startedAt) : null,
            endedAtExternal: t.finishedAt ? new Date(t.finishedAt) : null,
            processingVersion: 'v1-policy-a',
        })));
        // Fetch imported trackings to map IDs later
        const importedTrackings = await this.importedTrackingRepo.findByTicketId(ticket.id);
        const trackingMap = new Map(importedTrackings.map(it => [it.externalTrackingId, it]));
        // 3. Normalize Trackings
        // We must include OPEN_WEAK trackings (without startedAt) so the open session can be derived from createdAt.
        const normalized = this.normalization.normalizeTrackings(rawTrackings);
        // 4. Upsert Sessions (Closed)
        const closedSessionsPayload = normalized.closed.map(s => {
            const imported = s.externalTrackingId ? trackingMap.get(s.externalTrackingId) : null;
            return {
                ticketId: ticket.id,
                externalTrackingId: s.externalTrackingId,
                type: s.type,
                startedAt: s.startedAt,
                endedAt: s.endedAt,
                assignedUserName: s.assignedUser?.name,
                assignedUserEmail: s.assignedUser?.email,
                source: 'imported_complete',
                originImportedTrackingId: imported ? imported.id : null,
                processingVersion: 'v1-policy-a'
            };
        });
        await this.sessionRepo.upsertMany(closedSessionsPayload);
        // Mark processed for closed sessions
        for (const s of closedSessionsPayload) {
            if (s.originImportedTrackingId) {
                await this.importedTrackingRepo.markProcessed(s.originImportedTrackingId, 'v1-policy-a');
            }
        }
        // 5. Upsert Open Session
        if (normalized.open) {
            const s = normalized.open;
            const imported = s.externalTrackingId ? trackingMap.get(s.externalTrackingId) : null;
            await this.sessionRepo.syncOpenSession(ticket.id, {
                ticketId: ticket.id,
                externalTrackingId: s.externalTrackingId,
                type: s.type,
                startedAt: s.startedAt,
                endedAt: s.endedAt,
                assignedUserName: s.assignedUser?.name,
                assignedUserEmail: s.assignedUser?.email,
                source: 'imported_complete',
                originImportedTrackingId: imported ? imported.id : null,
                processingVersion: 'v1-policy-a'
            });
            if (imported) {
                await this.importedTrackingRepo.markProcessed(imported.id, 'v1-policy-a');
            }
        }
        else {
            await this.sessionRepo.syncOpenSession(ticket.id, null);
        }
        // 6. Import Messages
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
                await this.messageRepo.upsertMany(newMessages.map(m => {
                    let senderType = client_1.MessageSenderType.HUMAN;
                    if (m.generatedByAi)
                        senderType = client_1.MessageSenderType.AI;
                    else if (m.sendBySystem)
                        senderType = client_1.MessageSenderType.SYSTEM;
                    return {
                        ticketId: ticketDbId,
                        externalMessageId: String(m.id),
                        key: m.key,
                        body: m.body,
                        fromMe: m.fromMe,
                        senderType,
                        mediaUrl: m.mediaUrl,
                        mediaType: m.mediaType,
                        createdAtExternal: new Date(m.createdAt),
                        updatedAtExternal: new Date(m.updatedAt),
                    };
                }));
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
