"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobController = void 0;
const TicketImportService_1 = require("../services/TicketImportService");
class JobController {
    constructor() {
        this.service = new TicketImportService_1.TicketImportService();
    }
    async import(req, res) {
        // Run in background or wait?
        // "POST /jobs/import (dispara importTickets manualmente)"
        // Typically for a job endpoint we might return 202 Accepted.
        // But for debugging simplicity, I'll await it or just fire and forget.
        // I'll fire and forget but catch errors.
        this.service.runImport().catch(err => {
            console.error('Error in manual import job:', err);
        });
        res.status(202).json({ message: 'Import job started' });
    }
}
exports.JobController = JobController;
