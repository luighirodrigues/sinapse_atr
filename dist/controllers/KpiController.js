"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KpiController = void 0;
const AvgFirstResponseTimeService_1 = require("../services/kpis/AvgFirstResponseTimeService");
const AvgSessionDurationByTagService_1 = require("../services/kpis/AvgSessionDurationByTagService");
const TopSlowestSessionsByTagService_1 = require("../services/kpis/TopSlowestSessionsByTagService");
const SinapseClientRepository_1 = require("../repositories/SinapseClientRepository");
class KpiController {
    constructor() {
        this.service = new AvgFirstResponseTimeService_1.AvgFirstResponseTimeService();
        this.sessionDurationByTag = new AvgSessionDurationByTagService_1.AvgSessionDurationByTagService();
        this.topSlowestSessionsByTag = new TopSlowestSessionsByTagService_1.TopSlowestSessionsByTagService();
        this.clientRepo = new SinapseClientRepository_1.SinapseClientRepository();
    }
    async getAvgFirstResponseTime(req, res) {
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
                groupBy: groupBy || 'day'
            });
            return res.json(result);
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    async recomputeAvgFirstResponseTime(req, res) {
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
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    async getAvgSessionDurationByTag(req, res) {
        try {
            const { from, to, granularity, clientSlug, clientId } = req.query;
            if (!from || !to || !granularity) {
                return res.status(400).json({ error: 'Missing parameters: from, to, granularity' });
            }
            const gran = String(granularity);
            if (gran !== 'day' && gran !== 'month') {
                return res.status(400).json({ error: 'Invalid granularity. Use day|month' });
            }
            let resolvedClientId = clientId ? String(clientId) : null;
            if (!resolvedClientId) {
                if (!clientSlug) {
                    return res.status(400).json({ error: 'Missing client identifier: clientId or clientSlug' });
                }
                const client = await this.clientRepo.findBySlug(String(clientSlug));
                if (!client)
                    return res.status(404).json({ error: 'Client not found' });
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
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    async getTopSlowestSessionsByTag(req, res) {
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
            let endDate;
            if (toStr.length === 10) {
                const endExclusive = new Date(toStr);
                if (Number.isNaN(endExclusive.getTime())) {
                    return res.status(400).json({ error: 'Invalid to date' });
                }
                endExclusive.setHours(0, 0, 0, 0);
                endExclusive.setDate(endExclusive.getDate() + 1);
                endDate = endExclusive;
            }
            else {
                const endInclusive = new Date(toStr);
                if (Number.isNaN(endInclusive.getTime())) {
                    return res.status(400).json({ error: 'Invalid to date' });
                }
                endDate = new Date(endInclusive.getTime() + 1);
            }
            const parsedLimit = (() => {
                const fallback = 10;
                if (limit === undefined || limit === null)
                    return fallback;
                const n = Number.parseInt(String(limit), 10);
                if (!Number.isFinite(n))
                    return fallback;
                if (n < 1)
                    return 1;
                if (n > 50)
                    return 50;
                return n;
            })();
            const parsedIncludeTags = includeTags === undefined || includeTags === null
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
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.KpiController = KpiController;
