"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminDashboardController = void 0;
const kpiRegistry_1 = require("../config/kpiRegistry");
const SinapseClientRepository_1 = require("../repositories/SinapseClientRepository");
const DashboardConfigService_1 = require("../services/dashboard/DashboardConfigService");
class AdminDashboardController {
    constructor() {
        this.clientRepo = new SinapseClientRepository_1.SinapseClientRepository();
        this.dashboardService = new DashboardConfigService_1.DashboardConfigService();
    }
    async getClientKpis(req, res) {
        try {
            const clientSlug = String(req.params.clientSlug ?? '').trim();
            if (!clientSlug)
                return res.status(400).json({ error: 'Missing parameter: clientSlug' });
            const client = await this.clientRepo.findBySlug(clientSlug);
            if (!client)
                return res.status(404).json({ error: 'Client not found' });
            const response = await this.dashboardService.getAdminKpis(client.id);
            return res.json(response);
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    async putClientKpis(req, res) {
        try {
            const clientSlug = String(req.params.clientSlug ?? '').trim();
            if (!clientSlug)
                return res.status(400).json({ error: 'Missing parameter: clientSlug' });
            const client = await this.clientRepo.findBySlug(clientSlug);
            if (!client)
                return res.status(404).json({ error: 'Client not found' });
            const parsed = parseBulkKpiPayload(req.body);
            if (!parsed.ok)
                return res.status(400).json({ error: parsed.error });
            await this.dashboardService.bulkUpsertAdminKpis(client.id, parsed.kpis);
            const response = await this.dashboardService.getAdminKpis(client.id);
            return res.json(response);
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    async putTenantDefaultLayout(req, res) {
        try {
            const clientSlug = String(req.params.clientSlug ?? '').trim();
            if (!clientSlug)
                return res.status(400).json({ error: 'Missing parameter: clientSlug' });
            const client = await this.clientRepo.findBySlug(clientSlug);
            if (!client)
                return res.status(404).json({ error: 'Client not found' });
            const layoutPayload = parseLayoutPayload(req.body);
            if (!layoutPayload.ok)
                return res.status(400).json({ error: layoutPayload.error });
            const layout = await this.dashboardService.saveTenantDefaultLayout(client.id, layoutPayload.layout);
            return res.json({ clientId: client.id, layout });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.AdminDashboardController = AdminDashboardController;
function parseBulkKpiPayload(body) {
    if (!isPlainObject(body))
        return { ok: false, error: 'Invalid body: expected object' };
    if (!hasOnlyKeys(body, ['kpis']))
        return { ok: false, error: 'Unexpected body fields' };
    if (!Array.isArray(body.kpis))
        return { ok: false, error: 'Invalid body: kpis must be array' };
    const kpis = [];
    for (const raw of body.kpis) {
        if (!isPlainObject(raw))
            return { ok: false, error: 'Invalid kpi item: expected object' };
        if (!hasOnlyKeys(raw, ['kpiKey', 'isAllowed', 'defaultVisible', 'defaultConfig', 'locked'])) {
            return { ok: false, error: 'Invalid kpi item: unexpected fields' };
        }
        const kpiKey = typeof raw.kpiKey === 'string' ? raw.kpiKey.trim() : '';
        if (!(0, kpiRegistry_1.isAllowedKpiKey)(kpiKey)) {
            return { ok: false, error: `Invalid kpiKey: ${String(raw.kpiKey ?? '')}` };
        }
        if (typeof raw.isAllowed !== 'boolean')
            return { ok: false, error: `Invalid isAllowed for ${kpiKey}` };
        if (typeof raw.defaultVisible !== 'boolean')
            return { ok: false, error: `Invalid defaultVisible for ${kpiKey}` };
        if (typeof raw.locked !== 'boolean')
            return { ok: false, error: `Invalid locked for ${kpiKey}` };
        kpis.push({
            kpiKey,
            isAllowed: raw.isAllowed,
            defaultVisible: raw.defaultVisible,
            defaultConfig: Object.prototype.hasOwnProperty.call(raw, 'defaultConfig') ? raw.defaultConfig : null,
            locked: raw.locked,
        });
    }
    return { ok: true, kpis };
}
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
