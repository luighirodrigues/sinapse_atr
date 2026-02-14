import { Request, Response } from 'express';
import { SinapseClientRepository } from '../repositories/SinapseClientRepository';

type ClientSummary = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
};

export class ClientController {
  private repo: SinapseClientRepository;

  constructor() {
    this.repo = new SinapseClientRepository();
  }

  async list(req: Request, res: Response) {
    const clients = await this.repo.listAll();
    res.json(clients);
  }

  async create(req: Request, res: Response) {
    const { slug, name, apiBaseUrl, apiKey, isActive } = req.body;
    try {
      const client = await this.repo.create({ slug, name, apiBaseUrl, apiKey, isActive });
      res.status(201).json({ client: toClientSummary(client) });
    } catch (error) {
      if (isSlugConflictError(error)) {
        return res.status(409).json({ error: 'slug_conflict', message: 'Slug already in use' });
      }
      res.status(400).json({ error: 'Failed to create client', details: error });
    }
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const data = req.body;
    try {
      const client = await this.repo.update(id as string, data);
      res.json(client);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update client', details: error });
    }
  }

  async getById(req: Request, res: Response) {
    const clientId = String(req.params.clientId ?? '').trim();
    if (!clientId) return res.status(404).json({ error: 'client_not_found' });

    const client = await this.repo.findById(clientId);
    if (!client) return res.status(404).json({ error: 'client_not_found' });

    return res.json({ client: toClientSummary(client) });
  }

  async updateById(req: Request, res: Response) {
    const clientId = String(req.params.clientId ?? '').trim();
    if (!clientId) return res.status(404).json({ error: 'client_not_found' });

    try {
      const client = await this.repo.update(clientId, req.body);
      return res.json({ client: toClientSummary(client) });
    } catch (error) {
      if (isSlugConflictError(error)) {
        return res.status(409).json({ error: 'slug_conflict', message: 'Slug already in use' });
      }
      return res.status(400).json({ error: 'Failed to update client', details: error });
    }
  }

  async ensure(req: Request, res: Response) {
    const { slug, name, apiBaseUrl, apiKey } = req.body;
    const isActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : true;
    const normalizedSlug = String(slug ?? '').trim();

    if (!normalizedSlug) {
      return res.status(400).json({ error: 'Invalid body: slug is required' });
    }

    try {
      const client = await this.repo.upsertBySlug(normalizedSlug, {
        name,
        apiBaseUrl,
        apiKey,
        isActive,
      });
      return res.json({ client: toClientSummary(client) });
    } catch (error) {
      if (isSlugConflictError(error)) {
        return res.status(409).json({ error: 'slug_conflict', message: 'Slug already in use' });
      }
      return res.status(400).json({ error: 'Failed to ensure client', details: error });
    }
  }
}

function toClientSummary(client: {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
}): ClientSummary {
  return {
    id: client.id,
    slug: client.slug,
    name: client.name,
    isActive: client.isActive,
  };
}

function isSlugConflictError(error: unknown): boolean {
  const knownError = error as { code?: string; meta?: { target?: unknown } } | null;
  if (!knownError || typeof knownError !== 'object') return false;
  if (knownError.code !== 'P2002') return false;
  return Array.isArray(knownError.meta?.target) && knownError.meta?.target.includes('slug');
}
