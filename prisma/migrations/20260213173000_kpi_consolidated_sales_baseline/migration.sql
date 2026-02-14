-- Baseline for table created manually via SQL in some environments.
-- Keeps migration history aligned without requiring database reset.

CREATE TABLE IF NOT EXISTS "kpi_consolidated_sales" (
  "id" SERIAL NOT NULL,
  "client_id" TEXT NOT NULL,
  "seller_id" BIGINT NOT NULL,
  "seller_name" VARCHAR(255) NOT NULL,
  "date_sale" DATE NOT NULL,
  "daily_sales_count" INTEGER NOT NULL,
  "daily_sales_value" DOUBLE PRECISION NOT NULL,
  "daily_budget_count" INTEGER NOT NULL,
  "daily_budget_value" DOUBLE PRECISION NOT NULL,
  "daily_budget_count_finalized" INTEGER NOT NULL,
  "daily_budget_value_finalized" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kpi_consolidated_sales_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'kpi_consolidated_sales_client_fk'
      AND table_name = 'kpi_consolidated_sales'
  ) THEN
    ALTER TABLE "kpi_consolidated_sales"
      ADD CONSTRAINT "kpi_consolidated_sales_client_fk"
      FOREIGN KEY ("client_id") REFERENCES "sinapse_clients"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
