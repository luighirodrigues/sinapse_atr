import { Request, Response } from 'express';
import { TicketRepository } from '../repositories/TicketRepository';
import { SinapseClientRepository } from '../repositories/SinapseClientRepository';

export class TicketController {
  private repo: TicketRepository;
  private clientRepo: SinapseClientRepository;

  constructor() {
    this.repo = new TicketRepository();
    this.clientRepo = new SinapseClientRepository();
  }

  async get(req: Request, res: Response) {
    res.status(400).json({ error: 'clientSlug_required' });
  }

  async getByClientSlugAndUuid(req: Request, res: Response) {
    const { clientSlug, uuid } = req.params;

    if (typeof clientSlug !== 'string' || typeof uuid !== 'string') {
      res.status(400).json({ error: 'invalid_params' });
      return;
    }

    const client = await this.clientRepo.findBySlug(clientSlug);
    if (!client) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const ticket = await this.repo.findByUuid(client.id, uuid);

    if (!ticket) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    res.json(ticket);
  }
}
