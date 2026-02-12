import { prisma } from '../../prisma/client';
import { resolveClientIdBySlug } from '../tenants/resolveClientIdBySlug';

type BaseParams = {
  tenantSlug: string;
  startDate: Date | string;
  endDate: Date | string;
  sellerName?: string | null;
};

type SellerParams = {
  tenantSlug: string;
};

export type ConsolidatedSalesSummary = {
  sales: { countTotal: number; valueTotal: number };
  budgetOpen: { countTotal: number; valueTotal: number };
  budgetFinalized: { countTotal: number; valueTotal: number };
  daysInPeriod: number;
};

export type ConsolidatedSalesDailyItem = {
  date: string;
  salesCount: number;
  salesValue: number;
  budgetOpenCount: number;
  budgetOpenValue: number;
  budgetFinalizedCount: number;
  budgetFinalizedValue: number;
};

// Semantica: "orcamentos abertos" sao do proprio dia e zeram diariamente.
export class ConsolidatedSalesService {
  async getConsolidatedSalesSummary(params: BaseParams): Promise<ConsolidatedSalesSummary> {
    const clientId = await resolveClientIdBySlug(params.tenantSlug);
    const startDate = toDate(params.startDate);
    const endDate = toDate(params.endDate);
    const sellerName = normalizeSellerName(params.sellerName);

    const [row] = await prisma.$queryRaw<
      Array<{
        sales_count_total: number | null;
        sales_value_total: number | null;
        budget_open_count_total: number | null;
        budget_open_value_total: number | null;
        budget_finalized_count_total: number | null;
        budget_finalized_value_total: number | null;
        days_in_period: number | null;
      }>
    >`
      SELECT
        COALESCE(SUM(kcs.daily_sales_count), 0)::int AS sales_count_total,
        COALESCE(SUM(kcs.daily_sales_value), 0)::float8 AS sales_value_total,
        COALESCE(SUM(kcs.daily_budget_count), 0)::int AS budget_open_count_total,
        COALESCE(SUM(kcs.daily_budget_value), 0)::float8 AS budget_open_value_total,
        COALESCE(SUM(kcs.daily_budget_count_finalized), 0)::int AS budget_finalized_count_total,
        COALESCE(SUM(kcs.daily_budget_value_finalized), 0)::float8 AS budget_finalized_value_total,
        (${endDate}::date - ${startDate}::date + 1)::int AS days_in_period
      FROM public.kpi_consolidated_sales kcs
      WHERE kcs."clientId" = ${clientId}
        AND kcs.date_sale BETWEEN ${startDate}::date AND ${endDate}::date
        AND (${sellerName}::text IS NULL OR kcs.seller_name = ${sellerName})
    `;

    return {
      sales: {
        countTotal: Number(row?.sales_count_total ?? 0),
        valueTotal: Number(row?.sales_value_total ?? 0),
      },
      budgetOpen: {
        countTotal: Number(row?.budget_open_count_total ?? 0),
        valueTotal: Number(row?.budget_open_value_total ?? 0),
      },
      budgetFinalized: {
        countTotal: Number(row?.budget_finalized_count_total ?? 0),
        valueTotal: Number(row?.budget_finalized_value_total ?? 0),
      },
      daysInPeriod: Number(row?.days_in_period ?? 0),
    };
  }

  async getConsolidatedSalesDailySeries(params: BaseParams): Promise<ConsolidatedSalesDailyItem[]> {
    const clientId = await resolveClientIdBySlug(params.tenantSlug);
    const startDate = toDate(params.startDate);
    const endDate = toDate(params.endDate);
    const sellerName = normalizeSellerName(params.sellerName);

    const rows = await prisma.$queryRaw<
      Array<{
        date: string;
        sales_count: number | null;
        sales_value: number | null;
        budget_open_count: number | null;
        budget_open_value: number | null;
        budget_finalized_count: number | null;
        budget_finalized_value: number | null;
      }>
    >`
      WITH date_series AS (
        SELECT generate_series(${startDate}::date, ${endDate}::date, interval '1 day')::date AS date_sale
      )
      SELECT
        TO_CHAR(ds.date_sale, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(kcs.daily_sales_count), 0)::int AS sales_count,
        COALESCE(SUM(kcs.daily_sales_value), 0)::float8 AS sales_value,
        COALESCE(SUM(kcs.daily_budget_count), 0)::int AS budget_open_count,
        COALESCE(SUM(kcs.daily_budget_value), 0)::float8 AS budget_open_value,
        COALESCE(SUM(kcs.daily_budget_count_finalized), 0)::int AS budget_finalized_count,
        COALESCE(SUM(kcs.daily_budget_value_finalized), 0)::float8 AS budget_finalized_value
      FROM date_series ds
      LEFT JOIN public.kpi_consolidated_sales kcs
        ON kcs.date_sale = ds.date_sale
       AND kcs."clientId" = ${clientId}
       AND (${sellerName}::text IS NULL OR kcs.seller_name = ${sellerName})
      GROUP BY ds.date_sale
      ORDER BY ds.date_sale ASC
    `;

    return rows.map((row) => ({
      date: row.date,
      salesCount: Number(row.sales_count ?? 0),
      salesValue: Number(row.sales_value ?? 0),
      budgetOpenCount: Number(row.budget_open_count ?? 0),
      budgetOpenValue: Number(row.budget_open_value ?? 0),
      budgetFinalizedCount: Number(row.budget_finalized_count ?? 0),
      budgetFinalizedValue: Number(row.budget_finalized_value ?? 0),
    }));
  }

  async listConsolidatedSalesSellers(params: SellerParams): Promise<string[]> {
    const clientId = await resolveClientIdBySlug(params.tenantSlug);

    const rows = await prisma.$queryRaw<Array<{ seller_name: string }>>`
      SELECT DISTINCT kcs.seller_name
      FROM public.kpi_consolidated_sales kcs
      WHERE kcs."clientId" = ${clientId}
        AND kcs.seller_name IS NOT NULL
        AND BTRIM(kcs.seller_name) <> ''
      ORDER BY kcs.seller_name ASC
    `;

    return rows.map((row) => row.seller_name);
  }
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function normalizeSellerName(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}
