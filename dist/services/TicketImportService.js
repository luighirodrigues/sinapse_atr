"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketImportService = void 0;
const ExternalApiService_1 = require("./ExternalApiService");
const ImportStateRepository_1 = require("../repositories/ImportStateRepository");
const TicketRepository_1 = require("../repositories/TicketRepository");
const SessionRepository_1 = require("../repositories/SessionRepository");
const MessageRepository_1 = require("../repositories/MessageRepository");
const NormalizationService_1 = require("./NormalizationService");
const client_1 = require("@prisma/client");
class TicketImportService {
    constructor() {
        this.api = new ExternalApiService_1.ExternalApiService();
        this.importStateRepo = new ImportStateRepository_1.ImportStateRepository();
        this.ticketRepo = new TicketRepository_1.TicketRepository();
        this.sessionRepo = new SessionRepository_1.SessionRepository();
        this.messageRepo = new MessageRepository_1.MessageRepository();
        this.normalization = new NormalizationService_1.NormalizationService();
    }
    async runImport() {
        console.log('Starting import job...');
        const importState = await this.importStateRepo.getOrCreate();
        const lastImportAt = importState.lastImportAt;
        let maxUpdatedAt = lastImportAt;
        let page = 1;
        let hasMore = true;
        let processedCount = 0;
        // 1. Fetch Tickets
        while (hasMore) {
            console.log(`Fetching tickets page ${page}...`);
            const response = await this.api.getTickets({ page, limit: 50 }); // Assume limit 50
            const tickets = Array.isArray(response) ? response : response.data;
            if (tickets.length === 0) {
                hasMore = false;
                break;
            }
            // Filter by updatedAt >= lastImportAt
            // We assume API returns mixed order or desc? We filter manually.
            const newTickets = tickets.filter(t => new Date(t.updatedAt) >= lastImportAt);
            if (newTickets.length === 0 && tickets.length > 0) {
                // If we found tickets but none are new, and if api is ordered by updatedAt desc, we could stop.
                // But let's assume unsorted and process all pages just to be safe or until we see very old ones?
                // To be safe: process all pages. But for efficiency, if API supports sort, we'd use it.
                // We'll just continue.
            }
            for (const ticket of newTickets) {
                await this.processTicket(ticket);
                const ticketUpdatedAt = new Date(ticket.updatedAt);
                if (ticketUpdatedAt > maxUpdatedAt) {
                    maxUpdatedAt = ticketUpdatedAt;
                }
            }
            processedCount += newTickets.length;
            // Pagination check
            // If response has meta, use it. Else check if array length < limit
            if ('meta' in response && response.meta) {
                if (page >= response.meta.totalPages || page >= (response.meta.last_page || 9999))
                    hasMore = false;
            }
            else if (tickets.length < 50) {
                hasMore = false;
            }
            page++;
        }
        // Update global import state (margin 2 mins)
        // newLastImportAt = maxTicketUpdatedAt - interval '2 minutes'
        const margin = 2 * 60 * 1000;
        const newLastImportAt = new Date(maxUpdatedAt.getTime() - margin);
        await this.importStateRepo.updateLastImportAt(newLastImportAt);
        console.log(`Import finished. Processed ${processedCount} tickets.`);
    }
    async processTicket(externalTicket) {
        console.log(`Processing ticket ${externalTicket.uuid}`);
        // 1. Upsert Ticket
        const ticket = await this.ticketRepo.upsert({
            externalUuid: externalTicket.uuid,
            // externalTicketId: externalTicket.id, // Not present in provided fields? User listed 'uuid' as main.
            // But in getMessages, ticketId is number.
            // Wait, endpoint 1 description: "uuid: string ... id: number" ?
            // Description says: "uuid: string (identificador principal...)" and "contact: {id...}".
            // It doesn't explicitly list `id` (number) for the ticket itself in endpoint 1 fields list.
            // But in endpoint 2 messages: "ticketId: number".
            // We assume we might not get the number ID in the list, or we do.
            // Let's assume we don't have it from list, but maybe we can infer or leave it null?
            // Or maybe `externalTicket.id` exists?
            // User listed: "uuid", "updatedAt", "createdAt", "status", "contact", "ticketTrakings".
            // I'll leave externalTicketId optional/null if not found.
            status: externalTicket.status,
            contactName: externalTicket.contact?.name,
            contactNumber: externalTicket.contact?.number,
            contactExternalId: externalTicket.contact?.id,
            companyId: externalTicket.companyId,
            createdAtExternal: new Date(externalTicket.createdAt),
            updatedAtExternal: new Date(externalTicket.updatedAt),
            // Preserve existing cursor if exists
        });
        // 2. Normalize and Upsert Sessions
        const normalized = this.normalization.normalizeTrackings(externalTicket.ticketTrakings);
        // Upsert CLOSED sessions
        await this.sessionRepo.upsertMany(normalized.closed.map(s => ({
            ticketId: ticket.id,
            externalTrackingId: s.externalTrackingId,
            type: s.type,
            startedAt: s.startedAt,
            endedAt: s.endedAt,
            assignedUserName: s.assignedUser?.name,
            assignedUserEmail: s.assignedUser?.email,
        })));
        // Handle OPEN session
        // We sync the open session (delete old open, insert new one)
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
        await this.importMessagesForTicket(externalTicket.uuid, ticket.id, ticket.lastImportedMessageCreatedAt);
    }
    async importMessagesForTicket(uuid, ticketDbId, cursor) {
        let page = 1;
        let hasMore = true;
        let maxCreatedAt = cursor;
        const limit = 20;
        // We collect all new messages to upsert
        // But we need to upsert them in batches?
        // Actually, we can just upsert as we go.
        while (hasMore) {
            const response = await this.api.getMessages(uuid, { page, limit });
            // response might be the array itself or { data: [...] } depending on the API structure.
            // Based on previous errors and common patterns, we need to handle potential null/undefined data safely.
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
                // If response.data is undefined/null, treat as empty array
                messages = [];
            }
            if (messages.length === 0) {
                hasMore = false;
                break;
            }
            // Filter/Stop logic
            // "Parar paginação cedo quando detectar que a mensagem mais antiga daquela página tem createdAt <= cursor"
            // Assumes desc order.
            // Note: User says "assumir desc; se não for, ordenar local".
            // If we order local, we still need to fetch pages.
            // If API returns asc, we would need to fetch ALL pages to find the newest.
            // Assuming typical chat API: desc (newest first).
            const sortedMessages = messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const newMessages = [];
            for (const msg of sortedMessages) {
                const msgCreatedAt = new Date(msg.createdAt);
                if (cursor && msgCreatedAt <= cursor) {
                    // Reached old messages
                    hasMore = false;
                    // We can stop processing this batch if strictly ordered, but since we sorted locally, 
                    // we just skip this message.
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
            // Check for hasMore in response meta/root
            if (response && typeof response === 'object' && !Array.isArray(response)) {
                if ('hasMore' in response) {
                    // If API explicitly tells us if there are more
                    hasMore = !!response.hasMore;
                }
                if ('totalPages' in response && 'currentPage' in response) {
                    if (Number(response.currentPage) >= Number(response.totalPages)) {
                        hasMore = false;
                    }
                }
            }
            page++;
        }
        // 4. Reassign Sessions (ALL messages)
        // "Quando o ticket for reprocessado... recalcular... para todas mensagens"
        await this.reassignSessions(ticketDbId);
        // 5. Update Cursor
        if (maxCreatedAt && (!cursor || maxCreatedAt > cursor)) {
            await this.ticketRepo.updateLastImportedMessageCreatedAt(ticketDbId, maxCreatedAt);
        }
    }
    async reassignSessions(ticketId) {
        // Fetch all sessions for ticket
        const sessions = await this.sessionRepo.listByTicket(ticketId);
        // Split into closed and open
        const closed = sessions.filter(s => s.type === client_1.SessionType.CLOSED);
        const open = sessions.find(s => s.type !== client_1.SessionType.CLOSED); // Should be only one or none
        // Fetch all messages for ticket (lightweight: id, createdAt)
        // Use raw query or findMany with select if list is huge?
        // findMany is fine for typical ticket sizes (thousands).
        const messages = await this.messageRepo.listByTicket(ticketId);
        const updates = [];
        // "Se startedAt for null (OPEN_WEAK), para não cortar mensagens... ancorar o start"
        // Logic: min(session.start, createdAt da primeira mensagem do ticket) ...
        // Note: The logic described in requirements is:
        // "Ao atribuir mensagens, se a sessão aberta for OPEN_WEAK, definir start efetivo como: min(session.start, createdAt da primeira mensagem do ticket)"
        // This seems to imply we adjust the start time used for matching.
        let openStartEffective = open?.startedAt;
        if (open && open.type === client_1.SessionType.OPEN_WEAK && messages.length > 0) {
            // Find first message
            const firstMsgDate = messages[0].createdAtExternal; // listByTicket is sorted asc
            if (firstMsgDate < open.startedAt) {
                openStartEffective = firstMsgDate;
            }
        }
        for (const msg of messages) {
            let assignedSessionId = null;
            const msgDate = msg.createdAtExternal;
            // 1. Try CLOSED
            // start <= msg <= end
            const matchedClosed = closed.find(s => s.startedAt <= msgDate && s.endedAt && msgDate <= s.endedAt);
            if (matchedClosed) {
                assignedSessionId = matchedClosed.id;
            }
            else if (open && openStartEffective && msgDate >= openStartEffective) {
                // 2. Try OPEN
                assignedSessionId = open.id;
            }
            // 3. Else UNTRACKED (null)
            // Optimization: only update if changed
            if (msg.sessionId !== assignedSessionId) {
                updates.push({ messageId: msg.id, sessionId: assignedSessionId });
            }
        }
        if (updates.length > 0) {
            // Batch update
            await this.messageRepo.updateSessionIdsBatch(updates);
        }
    }
}
exports.TicketImportService = TicketImportService;
