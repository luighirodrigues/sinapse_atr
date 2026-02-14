# Sinapse ATR Backend

Backend de importação de tickets (Multi-Tenant).

## Configuração

1. Copie `.env.example` para `.env` e configure as variáveis.
   - `DATABASE_URL`: URL do Postgres.
   - `ADMIN_TOKEN`: Token para proteger endpoints administrativos.

2. Instale dependências:
   ```bash
   npm install
   ```

3. Configure o banco de dados:
   ```bash
   npx prisma migrate dev
   ```

4. Crie um cliente inicial (Seed):
   ```bash
   # Configure SEED_API_URL e SEED_API_KEY no .env se desejar
   npx ts-node seed_client.ts
   ```

## Endpoints

Todos os endpoints abaixo são servidos com prefixo `/api`.

### Admin (Requer header `x-admin-token: <ADMIN_TOKEN>`)

- `GET /api/clients`: Lista clientes.
- `POST /api/clients`: Cria cliente e retorna `{ client: { id, slug, name, isActive } }`.
- `POST /api/clients/ensure`: Cria/atualiza idempotente por slug e retorna `{ client: { id, slug, name, isActive } }`.
- `GET /api/clients/id/:clientId`: Busca client por ID (cuid).
- `PATCH /api/clients/id/:clientId`: Atualiza client por ID (recomendado).
- `PATCH /api/clients/:id`: Atualiza cliente (legacy).
- `POST /api/jobs/import`: Inicia importação para todos os clientes ativos.
- `POST /api/jobs/import/:slug`: Inicia importação para um cliente específico.

Exemplo:
```bash
curl -H "x-admin-token: seu_token" http://localhost:3000/api/clients
```

### KPIs (Requer header `x-admin-token: <ADMIN_TOKEN>`)

- `GET /api/kpis/top-slowest-sessions-by-tag`: Top N atendimentos mais lentos por tag (ou global).

Exemplos:
```bash
# Global
curl -H "x-admin-token: seu_token" \
  "http://localhost:3000/api/kpis/top-slowest-sessions-by-tag?clientSlug=corz&from=2026-01-01&to=2026-01-31&limit=10"

# Por tag (case-insensitive)
curl -H "x-admin-token: seu_token" \
  "http://localhost:3000/api/kpis/top-slowest-sessions-by-tag?clientSlug=corz&from=2026-01-01&to=2026-01-31&tag=interno&limit=10"

# Sem retornar contactTags
curl -H "x-admin-token: seu_token" \
  "http://localhost:3000/api/kpis/top-slowest-sessions-by-tag?clientSlug=corz&from=2026-01-01&to=2026-01-31&includeTags=false"
```

### Público

- `GET /api/tickets/:clientSlug/:uuid`: Busca ticket de um cliente específico pelo UUID externo.
- `GET /api/tickets/:uuid`: **DEPRECATED**. Retorna erro solicitando o uso da rota com slug.
- `GET /api/health`: Healthcheck.

### Dashboard Config (Admin + Tenant)

- Recomendado por ID (cuid):
  - `GET /api/admin/clients/id/:clientId/kpis`
  - `PUT /api/admin/clients/id/:clientId/kpis`
  - `PUT /api/admin/clients/id/:clientId/dashboard-layout/default`
  - `GET /api/tenant/clients/id/:clientId/dashboard-config`
  - `PUT /api/tenant/clients/id/:clientId/dashboard-layout`
  - `POST /api/tenant/clients/id/:clientId/dashboard-layout/reset`
- Legacy por slug (mantido):
  - `GET /api/admin/clients/:clientSlug/kpis`
  - `PUT /api/admin/clients/:clientSlug/kpis`
  - `PUT /api/admin/clients/:clientSlug/dashboard-layout/default`
  - `GET /api/tenant/:clientSlug/dashboard-config`
  - `PUT /api/tenant/:clientSlug/dashboard-layout`
  - `POST /api/tenant/:clientSlug/dashboard-layout/reset`

Respostas de dashboard/config relevantes incluem `client: { id, slug, name }` e mantem `clientId` quando aplicavel. Endpoints tenant de layout nao exigem mais `x-dashboard-write-token` nem `x-user-id` no backend.

Detalhes e exemplos completos em [docs/dashboard-config-api.md](docs/dashboard-config-api.md).

## Estrutura Multi-Tenant

O sistema suporta múltiplos clientes (`SinapseClient`).
- Tickets e ImportState são vinculados a um `clientId`.
- UUIDs de tickets não são mais unicos globalmente (apenas por cliente).
- A API externa é configurada por cliente.
