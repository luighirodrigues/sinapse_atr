import { Request, Response } from 'express';
import { TicketRepository } from '../repositories/TicketRepository';

export class TicketController {
  private repo: TicketRepository;

  constructor() {
    this.repo = new TicketRepository();
  }

  async get(req: Request, res: Response) {
    const { uuid } = req.params;
    if (typeof uuid !== 'string') {
        res.status(400).json({ message: 'Invalid UUID' });
        return;
    }
    const ticket = await this.repo.findFirstByExternalUuid(uuid);

    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    res.json(ticket);
  }
}
