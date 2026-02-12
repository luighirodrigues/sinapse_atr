# API de KPI — Consolidated Sales

## Visao geral

Esta API expoe o KPI de vendas consolidadas com base na tabela `public.kpi_consolidated_sales`.

Os endpoints recebem `tenantSlug` e o backend resolve internamente o `clientId` correspondente (`sinapse_clients.slug -> sinapse_clients.id`).

## Base URL

- Prefixo: `/api`
- Exemplo local: `http://localhost:3000/api`

## Autenticacao e autorizacao

- Obrigatoria: `x-admin-token: <ADMIN_TOKEN>`
- Token invalido ou ausente retorna `401 {"error":"unauthorized"}`

## Semantica dos dados

- `sales`:
  - `count` = soma de `daily_sales_count`
  - `value` = soma de `daily_sales_value`
- `budgetOpen`:
  - `count` = soma de `daily_budget_count`
  - `value` = soma de `daily_budget_value`
- `budgetFinalized`:
  - `count` = soma de `daily_budget_count_finalized`
  - `value` = soma de `daily_budget_value_finalized`
- Regra importante: **orcamentos abertos sao do proprio dia (zeram diariamente)**.

## Identificacao do tenant

Todos os endpoints usam `:tenantSlug` no path:

- `GET /api/tenants/:tenantSlug/kpis/consolidated-sales/...`

Se o tenant nao existir:

- `404 {"error":"Client not found"}`

---

## 1) Summary (totais no periodo)

### Metodo e URL

- `GET /api/tenants/:tenantSlug/kpis/consolidated-sales/summary`

### Query params

- `start` (obrigatorio): data inicial (`YYYY-MM-DD` ou ISO date)
- `end` (obrigatorio): data final (`YYYY-MM-DD` ou ISO date)
- `sellerName` (opcional): nome do vendedor (`seller_name`)

### Regras de validacao

- `tenantSlug` obrigatorio no path
- `start` e `end` obrigatorios e validos
- `start <= end`
- `sellerName` passa por `trim`; se vazio, o filtro e ignorado

### Resposta de sucesso (200)

```json
{
  "sales": { "countTotal": 34, "valueTotal": 125000.5 },
  "budgetOpen": { "countTotal": 12, "valueTotal": 48000.0 },
  "budgetFinalized": { "countTotal": 9, "valueTotal": 31000.0 },
  "daysInPeriod": 31
}
```

### Erros comuns

- `400 {"error":"Missing parameter: tenantSlug"}`
- `400 {"error":"Missing or invalid parameters: start, end"}`
- `400 {"error":"Invalid date range: start > end"}`
- `404 {"error":"Client not found"}`
- `500 {"error":"Internal server error"}`

### Exemplo cURL

```bash
curl -H "x-admin-token: $ADMIN_TOKEN" \
  "http://localhost:3000/api/tenants/meu-tenant/kpis/consolidated-sales/summary?start=2026-02-01&end=2026-02-11"
```

### Exemplo cURL com vendedor

```bash
curl -H "x-admin-token: $ADMIN_TOKEN" \
  "http://localhost:3000/api/tenants/meu-tenant/kpis/consolidated-sales/summary?start=2026-02-01&end=2026-02-11&sellerName=Maria%20Silva"
```

---

## 2) Daily (serie diaria)

### Metodo e URL

- `GET /api/tenants/:tenantSlug/kpis/consolidated-sales/daily`

### Query params

- `start` (obrigatorio): data inicial (`YYYY-MM-DD` ou ISO date)
- `end` (obrigatorio): data final (`YYYY-MM-DD` ou ISO date)
- `sellerName` (opcional): nome do vendedor (`seller_name`)

### Regra critica do periodo

O endpoint sempre retorna **todos os dias** do intervalo informado, incluindo dias sem registro na tabela, com valores zerados.

Implementacao no backend:

- `generate_series(startDate, endDate, interval '1 day')`
- `LEFT JOIN` com `kpi_consolidated_sales`
- `COALESCE` para preencher com `0`

### Resposta de sucesso (200)

```json
[
  {
    "date": "2026-02-01",
    "salesCount": 2,
    "salesValue": 10000.0,
    "budgetOpenCount": 1,
    "budgetOpenValue": 4200.0,
    "budgetFinalizedCount": 1,
    "budgetFinalizedValue": 3800.0
  },
  {
    "date": "2026-02-02",
    "salesCount": 0,
    "salesValue": 0,
    "budgetOpenCount": 0,
    "budgetOpenValue": 0,
    "budgetFinalizedCount": 0,
    "budgetFinalizedValue": 0
  }
]
```

### Erros comuns

- `400 {"error":"Missing parameter: tenantSlug"}`
- `400 {"error":"Missing or invalid parameters: start, end"}`
- `400 {"error":"Invalid date range: start > end"}`
- `404 {"error":"Client not found"}`
- `500 {"error":"Internal server error"}`

### Exemplo cURL

```bash
curl -H "x-admin-token: $ADMIN_TOKEN" \
  "http://localhost:3000/api/tenants/meu-tenant/kpis/consolidated-sales/daily?start=2026-02-01&end=2026-02-11"
```

---

## 3) Sellers (lista de vendedores)

### Metodo e URL

- `GET /api/tenants/:tenantSlug/kpis/consolidated-sales/sellers`

### Descricao

Retorna `seller_name` distintos para o tenant, ordenados alfabeticamente, ignorando nulos e vazios.

### Resposta de sucesso (200)

```json
[
  "Carlos",
  "Maria Silva",
  "Vendedor 03"
]
```

### Erros comuns

- `400 {"error":"Missing parameter: tenantSlug"}`
- `404 {"error":"Client not found"}`
- `500 {"error":"Internal server error"}`

### Exemplo cURL

```bash
curl -H "x-admin-token: $ADMIN_TOKEN" \
  "http://localhost:3000/api/tenants/meu-tenant/kpis/consolidated-sales/sellers"
```

---

## Tipagem de retorno

- Contadores (`count*`): `number` inteiro
- Valores monetarios (`value*`): `number` (float)
- Datas da serie diaria (`date`): `string` no formato `YYYY-MM-DD`

