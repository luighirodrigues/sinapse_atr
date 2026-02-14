import { DashboardLayout, DashboardLayoutScope, Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';

export const TENANT_DEFAULT_LAYOUT_KEY = 'TENANT_DEFAULT';

export function buildUserLayoutKey(userId: string): string {
  return `USER:${userId}`;
}

export class DashboardLayoutRepository {
  async findTenantDefault(clientId: string): Promise<DashboardLayout | null> {
    return prisma.dashboardLayout.findUnique({
      where: {
        clientId_layoutKey: {
          clientId,
          layoutKey: TENANT_DEFAULT_LAYOUT_KEY,
        },
      },
    });
  }

  async upsertTenantDefault(clientId: string, layout: Prisma.InputJsonValue): Promise<DashboardLayout> {
    return prisma.dashboardLayout.upsert({
      where: {
        clientId_layoutKey: {
          clientId,
          layoutKey: TENANT_DEFAULT_LAYOUT_KEY,
        },
      },
      update: {
        scope: DashboardLayoutScope.TENANT_DEFAULT,
        userId: null,
        layout,
      },
      create: {
        clientId,
        layoutKey: TENANT_DEFAULT_LAYOUT_KEY,
        scope: DashboardLayoutScope.TENANT_DEFAULT,
        userId: null,
        layout,
      },
    });
  }

  async findUserLayout(clientId: string, userId: string): Promise<DashboardLayout | null> {
    return prisma.dashboardLayout.findUnique({
      where: {
        clientId_layoutKey: {
          clientId,
          layoutKey: buildUserLayoutKey(userId),
        },
      },
    });
  }

  async upsertUserLayout(clientId: string, userId: string, layout: Prisma.InputJsonValue): Promise<DashboardLayout> {
    const layoutKey = buildUserLayoutKey(userId);
    return prisma.dashboardLayout.upsert({
      where: {
        clientId_layoutKey: {
          clientId,
          layoutKey,
        },
      },
      update: {
        scope: DashboardLayoutScope.USER,
        userId,
        layout,
      },
      create: {
        clientId,
        layoutKey,
        scope: DashboardLayoutScope.USER,
        userId,
        layout,
      },
    });
  }

  async deleteUserLayout(clientId: string, userId: string): Promise<void> {
    await prisma.dashboardLayout.deleteMany({
      where: {
        clientId,
        layoutKey: buildUserLayoutKey(userId),
      },
    });
  }
}
