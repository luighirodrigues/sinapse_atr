import { Request, Response } from 'express';
import { AvgFirstResponseTimeService } from '../services/kpis/AvgFirstResponseTimeService';
import { AvgSessionDurationByTagService } from '../services/kpis/AvgSessionDurationByTagService';
import { TopSlowestSessionsByTagService } from '../services/kpis/TopSlowestSessionsByTagService';
import { SinapseClientRepository } from '../repositories/SinapseClientRepository';

export class KpiController {
  private service: AvgFirstResponseTimeService;
  private sessionDurationByTag: AvgSessionDurationByTagService;
  private topSlowestSessionsByTag: TopSlowestSessionsByTagService;
  private clientRepo: SinapseClientRepository;

  constructor() {
    this.service = new AvgFirstResponseTimeService();
    this.sessionDurationByTag = new AvgSessionDurationByTagService();
    this.topSlowestSessionsByTag = new TopSlowestSessionsByTagService();
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

  async getAvgSessionDurationByTag(req: Request, res: Response) {
    try {
      const { from, to, granularity, clientSlug, clientId } = req.query;

      if (!from || !to || !granularity) {
        return res.status(400).json({ error: 'Missing parameters: from, to, granularity' });
      }

      const gran = String(granularity) as 'day' | 'month';
      if (gran !== 'day' && gran !== 'month') {
        return res.status(400).json({ error: 'Invalid granularity. Use day|month' });
      }

      let resolvedClientId: string | null = clientId ? String(clientId) : null;
      if (!resolvedClientId) {
        if (!clientSlug) {
          return res.status(400).json({ error: 'Missing client identifier: clientId or clientSlug' });
        }

        const client = await this.clientRepo.findBySlug(String(clientSlug));
        if (!client) return res.status(404).json({ error: 'Client not found' });
        resolvedClientId = client.id;
      }

      const startDate = new Date(String(from));
      const endDate = new Date(String(to));

      if (String(to).length === 10) {
        endDate.setHours(23, 59, 59, 999);
      }

      const result = await this.sessionDurationByTag.getAvgSessionDurationByTag({
        clientId: resolvedClientId,
        startDate,
        endDate,
        granularity: gran,
      });

      return res.json(result);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getTopSlowestSessionsByTag(req: Request, res: Response) {
    try {
      const { clientSlug, from, to, tag, limit, includeTags } = req.query;

      if (!clientSlug || !from || !to) {
        return res.status(400).json({ error: 'Missing parameters: clientSlug, from, to' });
      }

      const client = await this.clientRepo.findBySlug(String(clientSlug));
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const fromStr = String(from);
      const toStr = String(to);

      const startDate = new Date(fromStr);
      if (Number.isNaN(startDate.getTime())) {
        return res.status(400).json({ error: 'Invalid from date' });
      }

      let endDate: Date;
      if (toStr.length === 10) {
        const endExclusive = new Date(toStr);
        if (Number.isNaN(endExclusive.getTime())) {
          return res.status(400).json({ error: 'Invalid to date' });
        }
        endExclusive.setHours(0, 0, 0, 0);
        endExclusive.setDate(endExclusive.getDate() + 1);
        endDate = endExclusive;
      } else {
        const endInclusive = new Date(toStr);
        if (Number.isNaN(endInclusive.getTime())) {
          return res.status(400).json({ error: 'Invalid to date' });
        }
        endDate = new Date(endInclusive.getTime() + 1);
      }

      const parsedLimit = (() => {
        const fallback = 10;
        if (limit === undefined || limit === null) return fallback;
        const n = Number.parseInt(String(limit), 10);
        if (!Number.isFinite(n)) return fallback;
        if (n < 1) return 1;
        if (n > 50) return 50;
        return n;
      })();

      const parsedIncludeTags =
        includeTags === undefined || includeTags === null
          ? true
          : !['false', '0'].includes(String(includeTags).trim().toLowerCase());

      const normalizedTag = typeof tag === 'string' && tag.trim() ? tag.trim() : undefined;

      const items = await this.topSlowestSessionsByTag.getTopSlowestSessionsByTag({
        clientId: client.id,
        startDate,
        endDate,
        tag: normalizedTag,
        limit: parsedLimit,
        includeTags: parsedIncludeTags,
      });

      return res.json({
        clientSlug: String(clientSlug),
        from: fromStr,
        to: toStr,
        tag: normalizedTag ?? null,
        limit: parsedLimit,
        items,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
