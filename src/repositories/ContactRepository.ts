import { prisma } from '../prisma/client';

type UpsertMinimalContactInput = {
  clientId: string;
  id: bigint;
  name?: string;
  number?: string;
  email?: string;
  profilePicUrl?: string;
};

type UpsertFullContactInput = {
  clientId: string;
  id: bigint;
  companyId: bigint | null;
  name: string | null;
  number: string | null;
  email: string | null;
  isGroup: boolean;
  socialConnectionId: bigint | null;
  profilePicUrl: string | null;
  createdAtRemote: Date | null;
  updatedAtRemote: Date | null;
};

export class ContactRepository {
  async upsertMinimal(input: UpsertMinimalContactInput) {
    return prisma.contact.upsert({
      where: {
        clientId_id: {
          clientId: input.clientId,
          id: input.id,
        },
      },
      update: {
        name: input.name ?? undefined,
        number: input.number ?? undefined,
        email: input.email ?? undefined,
        profilePicUrl: input.profilePicUrl ?? undefined,
      },
      create: {
        clientId: input.clientId,
        id: input.id,
        name: input.name ?? null,
        number: input.number ?? null,
        email: input.email ?? null,
        profilePicUrl: input.profilePicUrl ?? null,
        isGroup: false,
      },
    });
  }

  async upsertFull(input: UpsertFullContactInput) {
    return prisma.contact.upsert({
      where: {
        clientId_id: {
          clientId: input.clientId,
          id: input.id,
        },
      },
      update: {
        companyId: input.companyId,
        name: input.name,
        number: input.number,
        email: input.email,
        isGroup: input.isGroup,
        socialConnectionId: input.socialConnectionId,
        profilePicUrl: input.profilePicUrl,
        createdAtRemote: input.createdAtRemote,
        updatedAtRemote: input.updatedAtRemote,
      },
      create: {
        clientId: input.clientId,
        id: input.id,
        companyId: input.companyId,
        name: input.name,
        number: input.number,
        email: input.email,
        isGroup: input.isGroup,
        socialConnectionId: input.socialConnectionId,
        profilePicUrl: input.profilePicUrl,
        createdAtRemote: input.createdAtRemote,
        updatedAtRemote: input.updatedAtRemote,
      },
    });
  }
}
