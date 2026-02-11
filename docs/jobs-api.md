# API de Jobs — Documentação

## Visão geral

Este endpoint dispara jobs assíncronos de importação de tickets, mensagens e contatos a partir da API externa, persistindo dados no PostgreSQL via Prisma. A resposta é imediata e não aguarda o término do processamento.

**Base URL**

- Prefixo: `/api`
- Exemplo local: `http://localhost:3000/api`

**Autenticação e autorização**

- Obrigatória: `x-admin-token: <ADMIN_TOKEN>`
- Token inválido ou ausente retorna `401 {"error":"unauthorized"}`

**Formato**

- `Content-Type: application/json`

**Versionamento**

- Sem versionamento explícito na URL

---

## Admin · Jobs

### Iniciar importação (todos os clients ativos)

**Descrição**

Dispara a importação para todos os clients ativos cadastrados.

**Método e URL**

- `POST /api/jobs/import`

**Autenticação**

- Obrigatória: `x-admin-token`

**Parâmetros**

- Path: nenhum
- Query: nenhum
- Body: não aplicável

**Resposta de sucesso (202)**

```json
{
  "message": "Import job started",
  "slug": "all"
}
```

**Respostas possíveis**

- `202 Accepted`
- `401 Unauthorized`
- `500 Internal Server Error`

**Exemplo cURL**

```bash
curl -X POST \
  -H "x-admin-token: seu_token" \
  http://localhost:3000/api/jobs/import
```

**Exemplo Postman**

- Method: `POST`
- URL: `http://localhost:3000/api/jobs/import`
- Headers: `x-admin-token: seu_token`
- Body: vazio

---

### Iniciar importação (client específico)

**Descrição**

Dispara a importação apenas para o client indicado pelo `slug`. Se o client não existir ou estiver inativo, o job inicia mas não processa nenhum client.

**Método e URL**

- `POST /api/jobs/import/:slug`

**Autenticação**

- Obrigatória: `x-admin-token`

**Parâmetros**

- Path:
  - `slug` (string, obrigatório): identificador do client
- Query: nenhum
- Body: não aplicável

**Resposta de sucesso (202)**

```json
{
  "message": "Import job started",
  "slug": "meu-cliente"
}
```

**Respostas possíveis**

- `202 Accepted`
- `401 Unauthorized`
- `500 Internal Server Error`

**Exemplo cURL**

```bash
curl -X POST \
  -H "x-admin-token: seu_token" \
  http://localhost:3000/api/jobs/import/meu-cliente
```

**Exemplo Postman**

- Method: `POST`
- URL: `http://localhost:3000/api/jobs/import/meu-cliente`
- Headers: `x-admin-token: seu_token`
- Body: vazio

---

### Sincronizar contatos (todos os clients ativos)

**Descrição**

Dispara a sincronização de contatos e tags para todos os clients ativos cadastrados.

**Método e URL**

- `POST /api/admin/sync/contacts`

**Autenticação**

- Obrigatória: `x-admin-token`

**Parâmetros**

- Path: nenhum
- Query: nenhum
- Body: não aplicável

**Resposta de sucesso (202)**

```json
{
  "message": "Contacts sync job started",
  "slug": "all"
}
```

**Respostas possíveis**

- `202 Accepted`
- `401 Unauthorized`
- `500 Internal Server Error`

**Exemplo cURL**

```bash
curl -X POST \
  -H "x-admin-token: seu_token" \
  http://localhost:3000/api/admin/sync/contacts
```

**Exemplo Postman**

- Method: `POST`
- URL: `http://localhost:3000/api/admin/sync/contacts`
- Headers: `x-admin-token: seu_token`
- Body: vazio

---

### Sincronizar contatos (client específico)

**Descrição**

Dispara a sincronização de contatos e tags apenas para o client indicado por `clientSlug` ou `slug`. Se o client não existir ou estiver inativo, o job inicia mas não processa nenhum client.

**Método e URL**

- `POST /api/admin/sync/contacts`

**Autenticação**

- Obrigatória: `x-admin-token`

**Parâmetros**

- Path: nenhum
- Query:
  - `clientSlug` (string, opcional): identificador do client
  - `slug` (string, opcional): alias para `clientSlug`
- Body:
  - `clientSlug` (string, opcional): identificador do client
  - `slug` (string, opcional): alias para `clientSlug`

**Resposta de sucesso (202)**

```json
{
  "message": "Contacts sync job started",
  "slug": "meu-cliente"
}
```

**Respostas possíveis**

- `202 Accepted`
- `401 Unauthorized`
- `500 Internal Server Error`

**Exemplo cURL (query)**

```bash
curl -X POST \
  -H "x-admin-token: seu_token" \
  "http://localhost:3000/api/admin/sync/contacts?clientSlug=meu-cliente"
```

**Exemplo cURL (body)**

```bash
curl -X POST \
  -H "x-admin-token: seu_token" \
  -H "Content-Type: application/json" \
  -d "{\"clientSlug\":\"meu-cliente\"}" \
  http://localhost:3000/api/admin/sync/contacts
```

**Exemplo Postman**

- Method: `POST`
- URL: `http://localhost:3000/api/admin/sync/contacts`
- Headers: `x-admin-token: seu_token`
- Body: `{"clientSlug":"meu-cliente"}`

---

## Estrutura de resposta

**Sucesso (202) — importação de tickets**

```json
{
  "message": "Import job started",
  "slug": "all"
}
```

**Sucesso (202) — sincronização de contatos**

```json
{
  "message": "Contacts sync job started",
  "slug": "all"
}
```

**Erro de autenticação (401)**

```json
{
  "error": "unauthorized"
}
```

---

## Códigos de status HTTP

- `202 Accepted`: job iniciado com sucesso
- `400 Bad Request`: não utilizado atualmente
- `401 Unauthorized`: token inválido ou ausente
- `404 Not Found`: não utilizado atualmente
- `500 Internal Server Error`: erro não tratado no servidor

---

## Validações e regras de negócio

- O header `x-admin-token` deve ser igual a `ADMIN_TOKEN`.
- Com `slug` informado:
  - Se o client existir e estiver ativo, ele é processado.
  - Se não existir ou estiver inativo, o job não processa nenhum client, mas retorna 202.
- A importação filtra tickets por `updatedAt >= lastImportAt` e atualiza o cursor ao final.
- A sincronização de contatos aceita `clientSlug` ou `slug` via query ou body.
- A sincronização de contatos busca páginas com `limit=50`, atualiza o cursor `contacts:page` por página e reseta para `0` ao concluir.

---

## Dependências externas

- API externa de tickets e mensagens:
  - `GET /ticket`
  - `GET /ticket/:uuid/messages`
- API externa de contatos:
  - `GET /contact`
- PostgreSQL via Prisma
- Variáveis de ambiente: `ADMIN_TOKEN`, `DATABASE_URL`, `IMPORT_START_AT`, `EXTERNAL_API_REQUESTS_PER_MINUTE`

---

## Considerações de segurança

- Endpoint protegido por token administrativo (`x-admin-token`).
- Sem rate limit no backend atual.
- Chamadas externas usam HTTPS com `rejectUnauthorized: false`, exigindo atenção em produção.

---

## Casos de uso típicos

- Disparar importação manual para todos os clients após manutenção.
- Disparar importação somente de um client específico para atualizar dados recentes.
- Sincronizar contatos e tags de um client após mudanças no CRM externo.

