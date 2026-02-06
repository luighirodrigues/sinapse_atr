import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import https from 'https';
import { SinapseClient } from '@prisma/client';
import { env } from '../config/env';

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export interface ExternalTicket {
  uuid: string;
  updatedAt: string;
  createdAt: string;
  status: string;
  isGroup?: boolean | null;
  contact: {
    id: number;
    name: string;
    number: string;
    email?: string;
    profilePicUrl?: string;
  };
  ticketTrakings: ExternalTracking[];
  companyId?: number;
}

export interface ExternalTracking {
  id: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  user: {
    id: number;
    name: string;
    email: string;
  } | null;
}

export interface ExternalMessage {
  id: number;
  key?: string;
  body: string;
  fromMe: boolean;
  mediaUrl: string | null;
  mediaType: string;
  ticketId: number;
  createdAt: string;
  updatedAt: string;
  generatedByAi?: boolean;
  sendBySystem?: boolean;
}

export interface ExternalContactTag {
  id: number | string;
  name: string;
  color?: string | null;
  companyId?: number | string | null;
}

export interface ExternalContact {
  id: number | string;
  companyId?: number | string | null;
  name?: string | null;
  number?: string | null;
  email?: string | null;
  isGroup?: boolean | null;
  socialConnectionId?: number | string | null;
  profilePicUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  tags?: ExternalContactTag[] | null;
}

export class ExternalApiService {
  private client: AxiosInstance;
  private limiterKey: string;
  private minIntervalMs: number;

  private static limiters = new Map<
    string,
    { queue: Promise<void>; lastRequestAt: number }
  >();

  constructor(apiBaseUrl: string, apiKey: string) {
    this.client = axios.create({
      baseURL: apiBaseUrl,
      headers: { 'api-key': apiKey },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    this.limiterKey = `${apiBaseUrl}::${apiKey}`;
    this.minIntervalMs = Math.ceil(60000 / env.EXTERNAL_API_REQUESTS_PER_MINUTE);
  }

  private async schedule<T>(fn: () => Promise<T>): Promise<T> {
    const limiter =
      ExternalApiService.limiters.get(this.limiterKey) ??
      (() => {
        const initial = { queue: Promise.resolve(), lastRequestAt: 0 };
        ExternalApiService.limiters.set(this.limiterKey, initial);
        return initial;
      })();

    const scheduled = limiter.queue.then(async () => {
      const now = Date.now();
      const waitMs = Math.max(0, limiter.lastRequestAt + this.minIntervalMs - now);
      if (waitMs > 0) await sleep(waitMs);
      limiter.lastRequestAt = Date.now();
      return fn();
    });

    limiter.queue = scheduled.then(
      () => undefined,
      () => undefined
    );

    return scheduled;
  }

  private async requestWithRetry<T>(config: AxiosRequestConfig, retries = 3): Promise<T> {
    try {
      const response = await this.schedule(() => this.client.request<T>(config));
      return response.data;
    } catch (error) {
      if (retries > 0) {
        console.warn(`Request failed, retrying... (${retries} attempts left)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.requestWithRetry<T>(config, retries - 1);
      }
      throw error;
    }
  }

  async getTickets(params: { page?: number; limit?: number; updatedAt_gte?: string } = {}) {
    return this.requestWithRetry<{ data: ExternalTicket[]; meta?: any } | ExternalTicket[]>({
      method: 'GET',
      url: '/ticket',
      params,
    });
  }

  async getMessages(ticketUuid: string, params: { page?: number; limit?: number }) {
    return this.requestWithRetry<any>({
      method: 'GET',
      url: `/ticket/${ticketUuid}/messages`,
      params,
    });
  }

  async getContacts(params: { page?: number; limit?: number }) {
    return this.requestWithRetry<any>({
      method: 'GET',
      url: '/contact',
      params,
    });
  }
}

export function createExternalApiClient(client: SinapseClient) {
  return new ExternalApiService(client.apiBaseUrl, client.apiKey);
}
