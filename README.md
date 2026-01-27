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

### Admin (Requer header `Authorization: <ADMIN_TOKEN>`)

- `GET /clients`: Lista clientes.
- `POST /clients`: Cria cliente (`slug`, `name`, `apiBaseUrl`, `apiKey`).
- `PATCH /clients/:id`: Atualiza cliente.
- `POST /jobs/import`: Inicia importação para todos os clientes ativos.
- `POST /jobs/import/:slug`: Inicia importação para um cliente específico.

### Público / Legado

- `GET /tickets/:uuid`: Busca ticket (primeiro encontrado com o UUID externo).
- `GET /health`: Healthcheck.

## Estrutura Multi-Tenant

O sistema suporta múltiplos clientes (`SinapseClient`).
- Tickets e ImportState são vinculados a um `clientId`.
- UUIDs de tickets não são mais unicos globalmente (apenas por cliente).
- A API externa é configurada por cliente.
