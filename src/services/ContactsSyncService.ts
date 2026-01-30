import { SinapseClient } from '@prisma/client';
import { createExternalApiClient, ExternalContact, ExternalContactTag } from './ExternalApiService';
import { SinapseClientRepository } from '../repositories/SinapseClientRepository';
import { ImportStateRepository } from '../repositories/ImportStateRepository';
import { ContactRepository } from '../repositories/ContactRepository';
import { TagRepository } from '../repositories/TagRepository';
import { ContactTagRepository } from '../repositories/ContactTagRepository';

function toBigInt(value: number | string): bigint {
  return BigInt(String(value));
}

export class ContactsSyncService {
  private clientRepo: SinapseClientRepository;
  private stateRepo: ImportStateRepository;
  private contactRepo: ContactRepository;
  private tagRepo: TagRepository;
  private contactTagRepo: ContactTagRepository;

  constructor() {
    this.clientRepo = new SinapseClientRepository();
    this.stateRepo = new ImportStateRepository('contacts:page');
    this.contactRepo = new ContactRepository();
    this.tagRepo = new TagRepository();
    this.contactTagRepo = new ContactTagRepository();
  }

  async runImport(slug?: string) {
    let clients: SinapseClient[] = [];

    if (slug) {
      const client = await this.clientRepo.findBySlug(slug);
      if (client && client.isActive) clients = [client];
    } else {
      clients = await this.clientRepo.listActive();
    }

    for (const client of clients) {
      try {
        await this.processClient(client);
      } catch (e) {
        console.error(`Error syncing contacts for client ${client.slug}:`, e);
      }
    }
  }

  private async processClient(client: SinapseClient) {
    const api = createExternalApiClient(client);
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

      const uniqueTags = new Map<string, ExternalContactTag>();
      for (const contact of contacts) {
        const tags = contact.tags ?? [];
        for (const tag of tags) {
          if (tag?.id == null || !tag?.name) continue;
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
        if (contact?.id == null) continue;

        const contactId = toBigInt(contact.id);
        await this.contactRepo.upsertFull({
          clientId: client.id,
          id: contactId,
          companyId: contact.companyId != null ? toBigInt(contact.companyId) : null,
          name: contact.name ?? null,
          number: contact.number ?? null,
          email: contact.email ?? null,
          isGroup: Boolean(contact.isGroup),
          socialConnectionId:
            contact.socialConnectionId != null ? toBigInt(contact.socialConnectionId) : null,
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
      } else if (contacts.length < limit) {
        hasMore = false;
      } else {
        page++;
      }
    }

    await this.stateRepo.updateLastPage(client.id, 0);
  }

  private extractContactsResponse(
    response: any
  ): { contacts: ExternalContact[]; totalPages: number | null } {
    const contacts: ExternalContact[] = Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.contacts)
          ? response.contacts
          : [];

    const meta = response?.meta ?? response?.pagination ?? null;
    const totalPages =
      meta?.totalPages != null
        ? Number(meta.totalPages)
        : meta?.last_page != null
          ? Number(meta.last_page)
          : meta?.total_pages != null
            ? Number(meta.total_pages)
            : null;

    return { contacts, totalPages };
  }
}
