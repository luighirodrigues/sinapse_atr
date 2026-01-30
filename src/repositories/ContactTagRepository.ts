import { prisma } from '../prisma/client';

type ReplaceTagsForContactInput = {
  clientId: string;
  contactId: bigint;
  tagIds: bigint[];
};

export class ContactTagRepository {
  async replaceTagsForContact(input: ReplaceTagsForContactInput) {
    await prisma.contactTag.deleteMany({
      where: {
        clientId: input.clientId,
        contactId: input.contactId,
      },
    });

    const uniqueTagIds = Array.from(new Set(input.tagIds.map((id) => id.toString()))).map(
      (id) => BigInt(id)
    );

    if (uniqueTagIds.length === 0) return;

    await prisma.contactTag.createMany({
      data: uniqueTagIds.map((tagId) => ({
        clientId: input.clientId,
        contactId: input.contactId,
        tagId,
      })),
    });
  }
}
