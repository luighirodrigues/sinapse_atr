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

### Admin (Requer header `x-admin-token: <ADMIN_TOKEN>`)

- `GET /clients`: Lista clientes.
- `POST /clients`: Cria cliente (`slug`, `name`, `apiBaseUrl`, `apiKey`).
- `PATCH /clients/:id`: Atualiza cliente.
- `POST /jobs/import`: Inicia importação para todos os clientes ativos.
- `POST /jobs/import/:slug`: Inicia importação para um cliente específico.

Exemplo:
```bash
curl -H "x-admin-token: seu_token" http://localhost:3000/clients
```

### Público

- `GET /tickets/:clientSlug/:uuid`: Busca ticket de um cliente específico pelo UUID externo.
- `GET /tickets/:uuid`: **DEPRECATED**. Retorna erro solicitando o uso da rota com slug.
- `GET /health`: Healthcheck.

## Estrutura Multi-Tenant

O sistema suporta múltiplos clientes (`SinapseClient`).
- Tickets e ImportState são vinculados a um `clientId`.
- UUIDs de tickets não são mais unicos globalmente (apenas por cliente).
- A API externa é configurada por cliente.
