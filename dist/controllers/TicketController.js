"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketController = void 0;
const TicketRepository_1 = require("../repositories/TicketRepository");
const SinapseClientRepository_1 = require("../repositories/SinapseClientRepository");
class TicketController {
    constructor() {
        this.repo = new TicketRepository_1.TicketRepository();
        this.clientRepo = new SinapseClientRepository_1.SinapseClientRepository();
    }
    async get(req, res) {
        res.status(400).json({ error: 'clientSlug_required' });
    }
    async getByClientSlugAndUuid(req, res) {
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
exports.TicketController = TicketController;
