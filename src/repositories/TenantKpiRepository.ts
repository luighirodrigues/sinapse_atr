import { Prisma, TenantKpi } from '@prisma/client';
import { prisma } from '../prisma/client';

export type TenantKpiUpsertInput = {
  kpiKey: string;
  isAllowed: boolean;
  defaultVisible: boolean;
  defaultConfig: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  locked: boolean;
};

export class TenantKpiRepository {
  async listByClient(clientId: string): Promise<TenantKpi[]> {
    return prisma.tenantKpi.findMany({
      where: { clientId },
      orderBy: { kpiKey: 'asc' },
    });
  }

  async listAllowedByClient(clientId: string): Promise<TenantKpi[]> {
    return prisma.tenantKpi.findMany({
      where: { clientId, isAllowed: true },
      orderBy: { kpiKey: 'asc' },
    });
  }

  async bulkUpsert(clientId: string, items: TenantKpiUpsertInput[]): Promise<void> {
    if (!items.length) return;

    await prisma.$transaction(
      items.map((item) =>
        prisma.tenantKpi.upsert({
          where: {
            clientId_kpiKey: {
              clientId,
              kpiKey: item.kpiKey,
            },
          },
          update: {
            isAllowed: item.isAllowed,
            defaultVisible: item.defaultVisible,
            defaultConfig: item.defaultConfig,
            locked: item.locked,
          },
          create: {
            clientId,
            kpiKey: item.kpiKey,
            isAllowed: item.isAllowed,
            defaultVisible: item.defaultVisible,
            defaultConfig: item.defaultConfig,
            locked: item.locked,
          },
        })
      )
    );
  }
}
