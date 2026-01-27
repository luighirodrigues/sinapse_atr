"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketController = void 0;
const TicketRepository_1 = require("../repositories/TicketRepository");
class TicketController {
    constructor() {
        this.repo = new TicketRepository_1.TicketRepository();
    }
    async get(req, res) {
        const { uuid } = req.params;
        if (typeof uuid !== 'string') {
            res.status(400).json({ message: 'Invalid UUID' });
            return;
        }
        const ticket = await this.repo.findByUuid(uuid);
        if (!ticket) {
            res.status(404).json({ message: 'Ticket not found' });
            return;
        }
        res.json(ticket);
    }
}
exports.TicketController = TicketController;
