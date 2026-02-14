-- CreateEnum
CREATE TYPE "DashboardLayoutScope" AS ENUM ('TENANT_DEFAULT', 'USER');

-- CreateTable
CREATE TABLE "tenant_kpis" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kpiKey" TEXT NOT NULL,
    "isAllowed" BOOLEAN NOT NULL DEFAULT false,
    "defaultVisible" BOOLEAN NOT NULL DEFAULT true,
    "defaultConfig" JSONB,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_layouts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "layoutKey" TEXT NOT NULL,
    "scope" "DashboardLayoutScope" NOT NULL,
    "userId" TEXT,
    "layout" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_tenant_kpis_client" ON "tenant_kpis"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_kpis_client_kpi" ON "tenant_kpis"("clientId", "kpiKey");

-- CreateIndex
CREATE INDEX "ix_dashboard_layouts_client" ON "dashboard_layouts"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dashboard_layouts_client_layout_key" ON "dashboard_layouts"("clientId", "layoutKey");

-- AddForeignKey
ALTER TABLE "tenant_kpis" ADD CONSTRAINT "tenant_kpis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "sinapse_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "sinapse_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
