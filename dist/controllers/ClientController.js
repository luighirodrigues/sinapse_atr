"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientController = void 0;
const SinapseClientRepository_1 = require("../repositories/SinapseClientRepository");
class ClientController {
    constructor() {
        this.repo = new SinapseClientRepository_1.SinapseClientRepository();
    }
    async list(req, res) {
        const clients = await this.repo.listAll();
        res.json(clients);
    }
    async create(req, res) {
        const { slug, name, apiBaseUrl, apiKey, isActive } = req.body;
        try {
            const client = await this.repo.create({ slug, name, apiBaseUrl, apiKey, isActive });
            res.status(201).json(client);
        }
        catch (error) {
            res.status(400).json({ error: 'Failed to create client', details: error });
        }
    }
    async update(req, res) {
        const { id } = req.params;
        const data = req.body;
        try {
            const client = await this.repo.update(id, data);
            res.json(client);
        }
        catch (error) {
            res.status(400).json({ error: 'Failed to update client', details: error });
        }
    }
}
exports.ClientController = ClientController;
