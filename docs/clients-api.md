# API de Clients — Documentação

## Índice

- [Visão geral](#visão-geral)
- [Admin · Clients](#admin--clients)
  - [Listar clients](#listar-clients)
  - [Criar client](#criar-client)
  - [Ensure client (idempotente por slug)](#ensure-client-idempotente-por-slug)
  - [Buscar client por ID](#buscar-client-por-id)
  - [Atualizar client por ID (recomendado)](#atualizar-client-por-id-recomendado)
  - [Atualizar client](#atualizar-client)

## Visão geral

**Base URL**

- Prefixo: `/api`
- Exemplo local: `http://localhost:3000/api`

**Autenticação e autorização**

- Todos os endpoints de clients exigem `x-admin-token: <ADMIN_TOKEN>`.
- Token inválido ou ausente retorna `401 {"error":"unauthorized"}`.

**Versionamento**

- Sem versionamento explícito na URL (API não versionada).

**Rate limits**

- Não há rate limit implementado para estes endpoints no backend atual.

**Formato**

- `Content-Type: application/json`

---

## Admin · Clients

### Listar clients

**Descrição**

Retorna todos os clients cadastrados, ordenados por nome.

**Método e URL**

- `GET /api/clients`

**Autenticação**

- Obrigatória: `x-admin-token`

**Parâmetros**

- Path: nenhum
- Query: nenhum

**Corpo da requisição**

- Não aplicável

**Respostas possíveis**

- `200 OK`
- `401 Unauthorized`
- `500 Internal Server Error`

**Resposta de sucesso (200)**

```json
[
  {
    "id": "clxk0b6xq0001s9nqf5xv9q3f",
    "slug": "corz",
    "name": "Corz",
    "apiBaseUrl": "https://atende-api.corz.com.br/api",
    "apiKey": "********",
    "isActive": true,
    "createdAt": "2026-02-01T12:34:56.789Z",
    "updatedAt": "2026-02-01T12:34:56.789Z"
  }
]
```

**Exemplo de requisição**

```bash
curl -H "x-admin-token: $ADMIN_TOKEN" \
  "http://localhost:3000/api/clients"
```

**Exemplo de resposta**

```json
[
  {
    "id": "clxk0b6xq0001s9nqf5xv9q3f",
    "slug": "corz",
    "name": "Corz",
    "apiBaseUrl": "https://atende-api.corz.com.br/api",
    "apiKey": "********",
    "isActive": true,
    "createdAt": "2026-02-01T12:34:56.789Z",
    "updatedAt": "2026-02-01T12:34:56.789Z"
  }
]
```

**Casos de uso**

- Painel administrativo listando tenants ativos e inativos.
- Verificação rápida dos dados de integração por client.

**Possíveis erros**

- `401 {"error":"unauthorized"}`
- `500 {"error":"Internal server error"}` (erro inesperado)

---

### Criar client

**Descrição**

Cria um novo client com as credenciais da API externa.

**Método e URL**

- `POST /api/clients`

**Autenticação**

- Obrigatória: `x-admin-token`

**Parâmetros**

- Path: nenhum
- Query: nenhum

**Corpo da requisição**

Obrigatórios:

- `slug` (string, único)
- `name` (string)
- `apiBaseUrl` (string, URL da API externa)
- `apiKey` (string)

Opcionais:

- `isActive` (boolean, default `true`)

```json
{
  "slug": "corz",
  "name": "Corz",
  "apiBaseUrl": "https://atende-api.corz.com.br/api",
  "apiKey": "seu_token",
  "isActive": true
}
```

**Respostas possíveis**

- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `500 Internal Server Error`

**Resposta de sucesso (201)**

```json
{
  "client": {
    "id": "clxk0b6xq0001s9nqf5xv9q3f",
    "slug": "corz",
    "name": "Corz",
    "isActive": true
  }
}
```

**Exemplo de requisição**

```bash
curl -X POST "http://localhost:3000/api/clients" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d "{\"slug\":\"corz\",\"name\":\"Corz\",\"apiBaseUrl\":\"https://atende-api.corz.com.br/api\",\"apiKey\":\"seu_token\",\"isActive\":true}"
```

**Exemplo de resposta**

```json
{
  "client": {
    "id": "clxk0b6xq0001s9nqf5xv9q3f",
    "slug": "corz",
    "name": "Corz",
    "isActive": true
  }
}
```

**Casos de uso**

- Provisionar um novo tenant.
- Registrar credenciais de integração para importação.

**Possíveis erros**

- `400 {"error":"Failed to create client","details":...}`
- `409 {"error":"slug_conflict","message":"Slug already in use"}`
- `401 {"error":"unauthorized"}`
- `500 {"error":"Internal server error"}` (erro inesperado)

---

### Ensure client (idempotente por slug)

**Descrição**

Cria ou atualiza um client com base no `slug`. Repetir a mesma chamada para o mesmo `slug` retorna o mesmo `id`.

**Método e URL**

- `POST /api/clients/ensure`

**Autenticação**

- Obrigatória: `x-admin-token`

**Corpo da requisição**

```json
{
  "slug": "corz",
  "name": "Corz",
  "apiBaseUrl": "https://atende-api.corz.com.br/api",
  "apiKey": "seu_token",
  "isActive": true
}
```

**Resposta de sucesso (200)**

```json
{
  "client": {
    "id": "clxk0b6xq0001s9nqf5xv9q3f",
    "slug": "corz",
    "name": "Corz",
    "isActive": true
  }
}
```

**Possíveis erros**

- `400 {"error":"Failed to ensure client","details":...}`
- `409 {"error":"slug_conflict","message":"Slug already in use"}`
- `401 {"error":"unauthorized"}`

---

### Buscar client por ID

**Método e URL**

- `GET /api/clients/id/:clientId`

**Autenticação**

- Obrigatória: `x-admin-token`

**Resposta de sucesso (200)**

```json
{
  "client": {
    "id": "clxk0b6xq0001s9nqf5xv9q3f",
    "slug": "corz",
    "name": "Corz",
    "isActive": true
  }
}
```

**Possíveis erros**

- `404 {"error":"client_not_found"}`
- `401 {"error":"unauthorized"}`

---

### Atualizar client por ID (recomendado)

**Método e URL**

- `PATCH /api/clients/id/:clientId`

**Autenticação**

- Obrigatória: `x-admin-token`

**Corpo da requisição**

Parcial, com campos permitidos:

- `slug` (string)
- `name` (string)
- `apiBaseUrl` (string)
- `apiKey` (string)
- `isActive` (boolean)

**Resposta de sucesso (200)**

```json
{
  "client": {
    "id": "clxk0b6xq0001s9nqf5xv9q3f",
    "slug": "corz",
    "name": "Corz Atendimento",
    "isActive": false
  }
}
```

**Possíveis erros**

- `404 {"error":"client_not_found"}`
- `409 {"error":"slug_conflict","message":"Slug already in use"}`
- `401 {"error":"unauthorized"}`

---

### Atualizar client

**Descrição**

Atualiza campos de um client existente.

**Método e URL**

- Legacy: `PATCH /api/clients/:id`
- Recomendado: `PATCH /api/clients/id/:clientId`

**Autenticação**

- Obrigatória: `x-admin-token`

**Parâmetros**

- Path:
  - `id` (string, obrigatório) — ID do client
- Query: nenhum

**Corpo da requisição**

Parcial. Todos os campos abaixo são opcionais:

- `slug` (string)
- `name` (string)
- `apiBaseUrl` (string)
- `apiKey` (string)
- `isActive` (boolean)

```json
{
  "name": "Corz Atendimento",
  "isActive": false
}
```

**Respostas possíveis**

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `500 Internal Server Error`

**Resposta de sucesso (200)**

```json
{
  "id": "clxk0b6xq0001s9nqf5xv9q3f",
  "slug": "corz",
  "name": "Corz Atendimento",
  "apiBaseUrl": "https://atende-api.corz.com.br/api",
  "apiKey": "seu_token",
  "isActive": false,
  "createdAt": "2026-02-01T12:34:56.789Z",
  "updatedAt": "2026-02-05T09:10:11.123Z"
}
```

**Exemplo de requisição**

```bash
curl -X PATCH "http://localhost:3000/api/clients/clxk0b6xq0001s9nqf5xv9q3f" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d "{\"name\":\"Corz Atendimento\",\"isActive\":false}"
```

**Exemplo de resposta**

```json
{
  "id": "clxk0b6xq0001s9nqf5xv9q3f",
  "slug": "corz",
  "name": "Corz Atendimento",
  "apiBaseUrl": "https://atende-api.corz.com.br/api",
  "apiKey": "seu_token",
  "isActive": false,
  "createdAt": "2026-02-01T12:34:56.789Z",
  "updatedAt": "2026-02-05T09:10:11.123Z"
}
```

**Casos de uso**

- Rotacionar `apiKey` da integração externa.
- Desativar temporariamente um client.
- Corrigir dados de identificação.

**Possíveis erros**

- `400 {"error":"Failed to update client","details":...}`
- `401 {"error":"unauthorized"}`
- `500 {"error":"Internal server error"}` (erro inesperado)

