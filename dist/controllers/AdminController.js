"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const ContactsSyncService_1 = require("../services/ContactsSyncService");
class AdminController {
    constructor() {
        this.contactsSync = new ContactsSyncService_1.ContactsSyncService();
    }
    async syncContacts(req, res) {
        const clientSlug = req.query.clientSlug ??
            req.body?.clientSlug ??
            req.query.slug ??
            req.body?.slug;
        this.contactsSync.runImport(clientSlug).catch((err) => {
            console.error('Error in manual contacts sync job:', err);
        });
        res.status(202).json({ message: 'Contacts sync job started', slug: clientSlug || 'all' });
    }
}
exports.AdminController = AdminController;
