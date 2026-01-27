import { Request, Response } from 'express';
import { SinapseClientRepository } from '../repositories/SinapseClientRepository';

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
      res.status(201).json(client);
    } catch (error) {
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
}
