import { SinapseClientRepository } from '../../repositories/SinapseClientRepository';

export class TenantNotFoundError extends Error {
  public readonly statusCode: number;

  constructor(message = 'Client not found') {
    super(message);
    this.name = 'TenantNotFoundError';
    this.statusCode = 404;
  }
}

const clientRepo = new SinapseClientRepository();

export async function resolveClientIdBySlug(tenantSlug: string): Promise<string> {
  const normalizedSlug = String(tenantSlug ?? '').trim();
  const client = await clientRepo.findBySlug(normalizedSlug);

  if (!client) {
    throw new TenantNotFoundError();
  }

  return client.id;
}
