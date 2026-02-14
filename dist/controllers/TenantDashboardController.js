"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantDashboardController = void 0;
const SinapseClientRepository_1 = require("../repositories/SinapseClientRepository");
const DashboardConfigService_1 = require("../services/dashboard/DashboardConfigService");
const resolveDashboardUserId_1 = require("../services/dashboard/resolveDashboardUserId");
class TenantDashboardController {
    constructor() {
        this.clientRepo = new SinapseClientRepository_1.SinapseClientRepository();
        this.dashboardService = new DashboardConfigService_1.DashboardConfigService();
    }
    async getDashboardConfig(req, res) {
        try {
            const clientSlug = String(req.params.clientSlug ?? '').trim();
            if (!clientSlug)
                return res.status(400).json({ error: 'Missing parameter: clientSlug' });
            const client = await this.clientRepo.findBySlug(clientSlug);
            if (!client)
                return res.status(404).json({ error: 'Client not found' });
            const userId = (0, resolveDashboardUserId_1.resolveDashboardUserId)(req);
            const config = await this.dashboardService.getDashboardConfig(client.id, userId);
            return res.json(config);
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    async putUserLayout(req, res) {
        try {
            const clientSlug = String(req.params.clientSlug ?? '').trim();
            if (!clientSlug)
                return res.status(400).json({ error: 'Missing parameter: clientSlug' });
            const client = await this.clientRepo.findBySlug(clientSlug);
            if (!client)
                return res.status(404).json({ error: 'Client not found' });
            const userId = (0, resolveDashboardUserId_1.resolveDashboardUserId)(req);
            if (!userId)
                return res.status(400).json({ error: 'userId required' });
            const layoutPayload = parseLayoutPayload(req.body);
            if (!layoutPayload.ok)
                return res.status(400).json({ error: layoutPayload.error });
            await this.dashboardService.saveUserLayout(client.id, userId, layoutPayload.layout);
            const config = await this.dashboardService.getDashboardConfig(client.id, userId);
            return res.json(config);
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    async resetUserLayout(req, res) {
        try {
            const clientSlug = String(req.params.clientSlug ?? '').trim();
            if (!clientSlug)
                return res.status(400).json({ error: 'Missing parameter: clientSlug' });
            const client = await this.clientRepo.findBySlug(clientSlug);
            if (!client)
                return res.status(404).json({ error: 'Client not found' });
            const userId = (0, resolveDashboardUserId_1.resolveDashboardUserId)(req);
            if (!userId)
                return res.status(400).json({ error: 'userId required' });
            const config = await this.dashboardService.resetUserLayout(client.id, userId);
            return res.json(config);
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.TenantDashboardController = TenantDashboardController;
function parseLayoutPayload(body) {
    if (!isPlainObject(body))
        return { ok: false, error: 'Invalid body: expected object' };
    if (!hasOnlyKeys(body, ['layout']))
        return { ok: false, error: 'Unexpected body fields' };
    if (!Object.prototype.hasOwnProperty.call(body, 'layout')) {
        return { ok: false, error: 'Missing body field: layout' };
    }
    return { ok: true, layout: body.layout };
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function hasOnlyKeys(value, allowedKeys) {
    return Object.keys(value).every((key) => allowedKeys.includes(key));
}
