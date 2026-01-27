import { createExternalApiClient, ExternalApiService, ExternalTicket, ExternalMessage } from './ExternalApiService';
import { ImportStateRepository } from '../repositories/ImportStateRepository';
import { TicketRepository } from '../repositories/TicketRepository';
import { SessionRepository } from '../repositories/SessionRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { SinapseClientRepository } from '../repositories/SinapseClientRepository';
import { NormalizationService } from './NormalizationService';
import { SessionType, SinapseClient } from '@prisma/client';

export class TicketImportService {
  private importStateRepo: ImportStateRepository;
  private ticketRepo: TicketRepository;
  private sessionRepo: SessionRepository;
  private messageRepo: MessageRepository;
  private clientRepo: SinapseClientRepository;
  private normalization: NormalizationService;

  constructor() {
    this.importStateRepo = new ImportStateRepository();
    this.ticketRepo = new TicketRepository();
    this.sessionRepo = new SessionRepository();
    this.messageRepo = new MessageRepository();
    this.clientRepo = new SinapseClientRepository();
    this.normalization = new NormalizationService();
  }

  async runImport(slug?: string) {
    console.log('Starting import job...');
    
    let clients: SinapseClient[] = [];
    if (slug) {
        const client = await this.clientRepo.findBySlug(slug);
        if (client && client.isActive) clients = [client];
        else console.log(`Client ${slug} not found or inactive.`);
    } else {
        clients = await this.clientRepo.listActive();
    }
    
    console.log(`Found ${clients.length} clients to process.`);

    for (const client of clients) {
        console.log(`Processing client: ${client.slug}`);
        try {
            await this.processClient(client);
        } catch (e) {
            console.error(`Error processing client ${client.slug}:`, e);
        }
    }
    console.log('Import job finished.');
  }

  private async processClient(client: SinapseClient) {
    const api = createExternalApiClient(client);
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
         if (page >= response.meta.totalPages || page >= (response.meta.last_page || 9999)) hasMore = false;
      } else if (tickets.length < 50) {
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

  private async processTicket(clientId: string, api: ExternalApiService, externalTicket: ExternalTicket) {
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
    } else {
      await this.sessionRepo.syncOpenSession(ticket.id, null);
    }

    // 3. Import Messages
    await this.importMessagesForTicket(api, externalTicket.uuid, ticket.id, ticket.lastImportedMessageCreatedAt);
  }

  private async importMessagesForTicket(api: ExternalApiService, uuid: string, ticketDbId: string, cursor: Date | null) {
    let page = 1;
    let hasMore = true;
    let maxCreatedAt = cursor;
    const limit = 20;

    while (hasMore) {
      const response = await api.getMessages(uuid, { page, limit });
      let messages: ExternalMessage[] = [];
      
      if (Array.isArray(response)) {
           messages = response;
       } else if (response && Array.isArray(response.messages)) {
           messages = response.messages;
       } else if (response && Array.isArray(response.data)) {
           messages = response.data;
       } else {
           messages = [];
       }
      
      if (messages.length === 0) {
        hasMore = false;
        break;
      }

      const sortedMessages = messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const newMessages: ExternalMessage[] = [];
      
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
          if ('hasMore' in response) hasMore = !!response.hasMore;
          if ('totalPages' in response && 'currentPage' in response) {
               if (Number(response.currentPage) >= Number(response.totalPages)) hasMore = false;
          }
      }
      
      page++;
    }

    await this.reassignSessions(ticketDbId);

    if (maxCreatedAt && (!cursor || maxCreatedAt > cursor)) {
      await this.ticketRepo.updateLastImportedMessageCreatedAt(ticketDbId, maxCreatedAt);
    }
  }

  private async reassignSessions(ticketId: string) {
    const sessions = await this.sessionRepo.listByTicket(ticketId);
    
    const closed = sessions.filter(s => s.type === SessionType.CLOSED);
    const open = sessions.find(s => s.type !== SessionType.CLOSED);
    
    const messages = await this.messageRepo.listByTicket(ticketId);
    
    const updates: { messageId: string; sessionId: string | null }[] = [];

    let openStartEffective = open?.startedAt;
    if (open && open.type === SessionType.OPEN_WEAK && messages.length > 0) {
        const firstMsgDate = messages[0].createdAtExternal;
        if (firstMsgDate < open.startedAt) {
            openStartEffective = firstMsgDate;
        }
    }

    for (const msg of messages) {
      let assignedSessionId: string | null = null;
      const msgDate = msg.createdAtExternal;

      const matchedClosed = closed.find(s => s.startedAt <= msgDate && s.endedAt && msgDate <= s.endedAt);
      if (matchedClosed) {
        assignedSessionId = matchedClosed.id;
      } else if (open && openStartEffective && msgDate >= openStartEffective) {
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
