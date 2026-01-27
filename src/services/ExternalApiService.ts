import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import https from 'https';
import { SinapseClient } from '@prisma/client';

export interface ExternalTicket {
  uuid: string;
  updatedAt: string;
  createdAt: string;
  status: string;
  contact: {
    id: number;
    name: string;
    number: string;
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
}

export class ExternalApiService {
  private client: AxiosInstance;

  constructor(apiBaseUrl: string, apiKey: string) {
    this.client = axios.create({
      baseURL: apiBaseUrl,
      headers: { 'api-key': apiKey },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });
  }

  private async requestWithRetry<T>(config: AxiosRequestConfig, retries = 3): Promise<T> {
    try {
      const response = await this.client.request<T>(config);
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
}

export function createExternalApiClient(client: SinapseClient) {
  return new ExternalApiService(client.apiBaseUrl, client.apiKey);
}
