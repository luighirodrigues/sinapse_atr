import { Request, Response } from 'express';
import { TicketImportService } from '../services/TicketImportService';

export class JobController {
  private service: TicketImportService;

  constructor() {
    this.service = new TicketImportService();
  }

  async import(req: Request, res: Response) {
    const { slug } = req.params;

    this.service.runImport(slug as string | undefined).catch(err => {
      console.error('Error in manual import job:', err);
    });

    res.status(202).json({ message: 'Import job started', slug: slug || 'all' });
  }
}
