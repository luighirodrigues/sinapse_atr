"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobController = void 0;
const TicketImportService_1 = require("../services/TicketImportService");
class JobController {
    constructor() {
        this.service = new TicketImportService_1.TicketImportService();
    }
    async import(req, res) {
        const { slug } = req.params;
        this.service.runImport(slug).catch(err => {
            console.error('Error in manual import job:', err);
        });
        res.status(202).json({ message: 'Import job started', slug: slug || 'all' });
    }
}
exports.JobController = JobController;
