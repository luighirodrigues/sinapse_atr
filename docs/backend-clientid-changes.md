# Alteracoes realizadas - suporte a `backendClientId`

## Objetivo entregue

Backend atualizado para aceitar chamadas por `clientId` (`SinapseClient.id`, cuid), mantendo compatibilidade com rotas legacy por `clientSlug`.

## Principais mudancas

### 1) Resolucao centralizada de client

- Criado helper unico: `resolveClientOrThrow({ clientId?, clientSlug? })`
- Regra aplicada:
  - se vier `clientId`, resolve por ID;
  - senao resolve por `clientSlug`;
  - se nao encontrar: `404 { "error": "client_not_found" }`
- Controllers de dashboard passaram a depender desse helper (sem duplicar lookup/404).

Arquivos:
- `src/services/tenants/resolveClientOrThrow.ts`
- `src/repositories/SinapseClientRepository.ts`

### 2) Novas rotas por ID (sem quebrar legacy)

#### Admin (`x-admin-token`)

- `GET /api/admin/clients/id/:clientId/kpis`
- `PUT /api/admin/clients/id/:clientId/kpis`
- `PUT /api/admin/clients/id/:clientId/dashboard-layout/default`

#### Tenant

- `GET /api/tenant/clients/id/:clientId/dashboard-config`
- `PUT /api/tenant/clients/id/:clientId/dashboard-layout`
- `POST /api/tenant/clients/id/:clientId/dashboard-layout/reset`

#### Legacy mantido

- Rotas por slug continuam ativas:
  - `/api/admin/clients/:clientSlug/...`
  - `/api/tenant/:clientSlug/...`

#### Ordem de registro para evitar conflito

- Rotas `.../id/:clientId` foram registradas antes das rotas `.../:clientSlug`.

Arquivo:
- `src/routes/index.ts`

### 3) Refatoracao dos controllers de dashboard

- `AdminDashboardController`:
  - adicionadas actions por ID;
  - handlers internos unicos para evitar duplicacao;
  - respostas passaram a incluir `client`.
- `TenantDashboardController`:
  - adicionadas actions por ID;
  - handlers internos unicos;
  - respostas passaram a incluir `client`.

Arquivos:
- `src/controllers/AdminDashboardController.ts`
- `src/controllers/TenantDashboardController.ts`

### 4) Padronizacao de payloads com objeto `client`

Respostas relevantes de dashboard/admin agora incluem explicitamente:

```json
{
  "client": { "id": "...", "slug": "...", "name": "..." }
}
```

E mantem `clientId` quando ja fazia parte do contrato.

### 5) Endpoints de clients para provisionamento do Next

- `POST /api/clients` padronizado para retornar:
  - `{ "client": { "id", "slug", "name", "isActive" } }`
- Adicionado `GET /api/clients/id/:clientId`
- Adicionado `PATCH /api/clients/id/:clientId`
- Mantido `PATCH /api/clients/:id` (legacy)
- Adicionado `POST /api/clients/ensure` (idempotente por slug):
  - se existe por slug: atualiza e retorna `client`;
  - se nao existe: cria e retorna `client`;
  - conflito de slug: `409 { "error": "slug_conflict", "message": "Slug already in use" }`

Arquivo:
- `src/controllers/ClientController.ts`

### 6) Remocao de dependencia de token/header de dashboard

Conforme solicitacao posterior:

- removido uso de `DASHBOARD_WRITE_TOKEN`
- removido uso de `DASHBOARD_INSECURE_USER_HEADER`
- removido uso de `x-dashboard-write-token`
- removido uso de `x-user-id`
- removido middleware `requireDashboardWriteToken`

Arquivos:
- `src/config/env.ts`
- `src/routes/index.ts`
- `src/services/dashboard/resolveDashboardUserId.ts`
- `src/middlewares/requireDashboardWriteToken.ts` (removido)

## Documentacao atualizada

- `docs/dashboard-config-api.md`
- `docs/clients-api.md`
- `README.md`

Inclui:
- rotas por ID como recomendadas;
- rotas por slug como legacy;
- shape padrao com `client`;
- erros padronizados `client_not_found` e `slug_conflict`;
- remocao de exigencia de headers extras nos endpoints tenant de layout.

## Testes e validacao

Adicionado smoke test:
- `test/smoke/client-id-support.test.ts`

Cobertura validada:
- ensure cria e retorna `client.id`
- ensure repetido retorna mesmo ID
- ensure conflito retorna `409 slug_conflict`
- rotas por ID nao conflitam com legacy por slug
- `404 client_not_found` no resolver
- auth admin (`401`) mantida

Resultado final da suite:
- `npm test` -> **8 passed, 0 failed**
