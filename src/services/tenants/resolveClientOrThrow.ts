import { SinapseClient } from '@prisma/client';
import { SinapseClientRepository } from '../../repositories/SinapseClientRepository';

type ResolveClientInput = {
  clientId?: string | null;
  clientSlug?: string | null;
};

export class ClientNotFoundError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor() {
    super('Client not found');
    this.name = 'ClientNotFoundError';
    this.statusCode = 404;
    this.code = 'client_not_found';
  }
}

const clientRepo = new SinapseClientRepository();

export async function resolveClientOrThrow(
  input: ResolveClientInput,
  deps?: { clientRepository?: Pick<SinapseClientRepository, 'findById' | 'findBySlug'> }
): Promise<SinapseClient> {
  const repository = deps?.clientRepository ?? clientRepo;
  const normalizedId = String(input.clientId ?? '').trim();
  const normalizedSlug = String(input.clientSlug ?? '').trim();

  if (normalizedId) {
    const clientById = await repository.findById(normalizedId);
    if (!clientById) throw new ClientNotFoundError();
    return clientById;
  }

  if (normalizedSlug) {
    const clientBySlug = await repository.findBySlug(normalizedSlug);
    if (!clientBySlug) throw new ClientNotFoundError();
    return clientBySlug;
  }

  throw new ClientNotFoundError();
}

export function sendClientResolutionError(error: unknown, res: { status: (code: number) => { json: (body: unknown) => unknown } }): boolean {
  if (!(error instanceof ClientNotFoundError)) return false;
  res.status(error.statusCode).json({ error: error.code });
  return true;
}
