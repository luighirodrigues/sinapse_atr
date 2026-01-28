"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalApiService = void 0;
exports.createExternalApiClient = createExternalApiClient;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
class ExternalApiService {
    constructor(apiBaseUrl, apiKey) {
        this.client = axios_1.default.create({
            baseURL: apiBaseUrl,
            headers: { 'api-key': apiKey },
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
        return this.requestWithRetry({
            method: 'GET',
            url: '/ticket',
            params,
        });
    }
    async getMessages(ticketUuid, params) {
        return this.requestWithRetry({
            method: 'GET',
            url: `/ticket/${ticketUuid}/messages`,
            params,
        });
    }
}
exports.ExternalApiService = ExternalApiService;
function createExternalApiClient(client) {
    return new ExternalApiService(client.apiBaseUrl, client.apiKey);
}
