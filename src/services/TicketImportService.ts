import { createExternalApiClient, ExternalApiService, ExternalTicket, ExternalMessage } from './ExternalApiService';
import { ImportStateRepository } from '../repositories/ImportStateRepository';
import { TicketRepository } from '../repositories/TicketRepository';
import { SessionRepository } from '../repositories/SessionRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { SinapseClientRepository } from '../repositories/SinapseClientRepository';
import { ImportedTrackingRepository } from '../repositories/ImportedTrackingRepository';
import { NormalizationService } from './NormalizationService';
import { SessionType, SinapseClient, ImportedTracking } from '@prisma/client';

export class TicketImportService {
  private importStateRepo: ImportStateRepository;
  private ticketRepo: TicketRepository;
  private sessionRepo: SessionRepository;
  private messageRepo: MessageRepository;
  private clientRepo: SinapseClientRepository;
  private importedTrackingRepo: ImportedTrackingRepository;
  private normalization: NormalizationService;

  constructor() {
    this.importStateRepo = new ImportStateRepository();
    this.ticketRepo = new TicketRepository();
    this.sessionRepo = new SessionRepository();
    this.messageRepo = new MessageRepository();
    this.clientRepo = new SinapseClientRepository();
    this.importedTrackingRepo = new ImportedTrackingRepository();
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

    // 3. Filter Complete Trackings & Normalize
    // Complete = has startedAtExternal (even if no endedAtExternal)
    const completeTrackings = rawTrackings.filter(t => t.startedAt);
    const normalized = this.normalization.normalizeTrackings(completeTrackings);
    
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
    } else {
      await this.sessionRepo.syncOpenSession(ticket.id, null);
    }

    // 6. Import Messages
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
