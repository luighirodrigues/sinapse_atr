"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalApiService = void 0;
exports.createExternalApiClient = createExternalApiClient;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const env_1 = require("../config/env");
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
class ExternalApiService {
    constructor(apiBaseUrl, apiKey) {
        this.client = axios_1.default.create({
            baseURL: apiBaseUrl,
            headers: { 'api-key': apiKey },
            httpsAgent: new https_1.default.Agent({
                rejectUnauthorized: false,
            }),
        });
        this.limiterKey = `${apiBaseUrl}::${apiKey}`;
        this.minIntervalMs = Math.ceil(60000 / env_1.env.EXTERNAL_API_REQUESTS_PER_MINUTE);
    }
    async schedule(fn) {
        const limiter = ExternalApiService.limiters.get(this.limiterKey) ??
            (() => {
                const initial = { queue: Promise.resolve(), lastRequestAt: 0 };
                ExternalApiService.limiters.set(this.limiterKey, initial);
                return initial;
            })();
        const scheduled = limiter.queue.then(async () => {
            const now = Date.now();
            const waitMs = Math.max(0, limiter.lastRequestAt + this.minIntervalMs - now);
            if (waitMs > 0)
                await sleep(waitMs);
            limiter.lastRequestAt = Date.now();
            return fn();
        });
        limiter.queue = scheduled.then(() => undefined, () => undefined);
        return scheduled;
    }
    async requestWithRetry(config, retries = 3) {
        try {
            const response = await this.schedule(() => this.client.request(config));
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
    async getContacts(params) {
        return this.requestWithRetry({
            method: 'GET',
            url: '/contact',
            params,
        });
    }
}
exports.ExternalApiService = ExternalApiService;
ExternalApiService.limiters = new Map();
function createExternalApiClient(client) {
    return new ExternalApiService(client.apiBaseUrl, client.apiKey);
}
