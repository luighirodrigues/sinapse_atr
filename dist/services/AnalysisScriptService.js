"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisScriptService = void 0;
const AnalysisScriptRepository_1 = require("../repositories/AnalysisScriptRepository");
class AnalysisScriptService {
    constructor() {
        this.repo = new AnalysisScriptRepository_1.AnalysisScriptRepository();
    }
    async create(input) {
        const version = input.version != null
            ? input.version
            : await this.repo.getNextVersion(input.clientId, input.scriptKey);
        const isActive = input.isActive ?? true;
        const topics = Array.isArray(input.topics) ? input.topics : [];
        return this.repo.create({
            clientId: input.clientId,
            scriptKey: input.scriptKey,
            version,
            name: input.name,
            description: input.description ?? null,
            scriptText: input.scriptText,
            topics,
            isActive,
        });
    }
    async list(clientId, filter) {
        return this.repo.list(clientId, filter);
    }
    async resolve(clientId, scriptKey, version) {
        if (version != null) {
            return this.repo.findByKeyVersion(clientId, scriptKey, version);
        }
        return this.repo.findActiveHighestVersion(clientId, scriptKey);
    }
    async activate(clientId, scriptKey, version, deactivateOthers = true) {
        return this.repo.activate(clientId, scriptKey, version, deactivateOthers);
    }
}
exports.AnalysisScriptService = AnalysisScriptService;
