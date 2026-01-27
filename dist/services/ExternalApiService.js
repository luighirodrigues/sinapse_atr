"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalApiService = void 0;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const env_1 = require("../config/env");
class ExternalApiService {
    constructor() {
        this.client = axios_1.default.create({
            baseURL: env_1.env.EXTERNAL_API_BASE_URL,
            headers: env_1.env.EXTERNAL_API_TOKEN
                ? { 'api-key': env_1.env.EXTERNAL_API_TOKEN }
                : {},
            httpsAgent: new https_1.default.Agent({
                rejectUnauthorized: false,
            }),
        });
    }
    async requestWithRetry(config, retries = 3) {
        try {
            const response = await this.client.request(config);
            return response.data;
        }
        catch (error) {
            if (retries > 0) {
                console.warn(`Request failed, retrying... (${retries} attempts left)`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
                return this.requestWithRetry(config, retries - 1);
            }
            throw error;
        }
    }
    async getTickets(params = {}) {
        // The requirement says: "Busca tickets que tiveram updatedAt >= lastImportAt"
        // Assuming the API supports some filtering or we filter manually.
        // The user description says "Retorna lista paginada... assuma paginação".
        // It doesn't explicitly say the API supports filtering by updatedAt.
        // "Endpoint: GET /ticket... Retorna lista paginada".
        // "Campos relevantes: ... updatedAt".
        // "Importação deve ser incremental assim: Buscar tickets que tiveram updatedAt >= lastImportAt (armazenado localmente...)"
        // If the API doesn't support filtering, we might have to fetch all and filter? Or assume they are ordered by updatedAt?
        // Usually list endpoints are ordered by ID or createdAt.
        // If we can't filter by updatedAt in API, we fetch pages until we find one that is too old?
        // But usually APIs allow `updated_after` or similar.
        // I will try to pass `updatedAt_gte` if the API supports it, or just fetch.
        // Given the prompt "Busca tickets que tiveram updatedAt >= lastImportAt", it implies we do the filtering.
        // If the API supports `sort=updatedAt:desc`, we can stop early.
        // I'll assume standard pagination params and manual filtering for now if filter param is unknown.
        // But I will pass generic query params.
        return this.requestWithRetry({
            method: 'GET',
            url: '/ticket',
            params,
        });
    }
    async getMessages(ticketUuid, params) {
        // Return explicit type handling as the API might return { messages: [], ... }
        return this.requestWithRetry({
            method: 'GET',
            url: `/ticket/${ticketUuid}/messages`,
            params,
        });
    }
}
exports.ExternalApiService = ExternalApiService;
