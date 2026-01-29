import { Request, Response } from 'express';
import { AvgFirstResponseTimeService } from '../services/kpis/AvgFirstResponseTimeService';
import { SinapseClientRepository } from '../repositories/SinapseClientRepository';

export class KpiController {
  private service: AvgFirstResponseTimeService;
  private clientRepo: SinapseClientRepository;

  constructor() {
    this.service = new AvgFirstResponseTimeService();
    this.clientRepo = new SinapseClientRepository();
  }

  async getAvgFirstResponseTime(req: Request, res: Response) {
    try {
      const { start, end, groupBy, clientSlug } = req.query;
      
      if (!start || !end || !clientSlug) {
        return res.status(400).json({ error: 'Missing parameters: start, end, clientSlug' });
      }

      const client = await this.clientRepo.findBySlug(String(clientSlug));
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const startDate = new Date(String(start));
      const endDate = new Date(String(end));
      
      // Adjust endDate to end of day if it looks like just a date
      if (String(end).length === 10) {
        endDate.setHours(23, 59, 59, 999);
      }

      const result = await this.service.getAvgFirstResponseTime({
        clientId: client.id,
        startDate,
        endDate,
        groupBy: (groupBy as 'day' | 'month' | 'total') || 'day'
      });

      return res.json(result);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async recomputeAvgFirstResponseTime(req: Request, res: Response) {
    try {
        const { start, end, clientSlug } = req.query;
        
        if (!start || !end || !clientSlug) {
            return res.status(400).json({ error: 'Missing parameters: start, end, clientSlug' });
        }
        
        const client = await this.clientRepo.findBySlug(String(clientSlug));
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const startDate = new Date(String(start));
        const endDate = new Date(String(end));
        if (String(end).length === 10) {
            endDate.setHours(23, 59, 59, 999);
        }

        const stats = await this.service.calculateAndStoreFirstResponseTimes({
            clientId: client.id,
            startDate,
            endDate
        });

        return res.json(stats);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
