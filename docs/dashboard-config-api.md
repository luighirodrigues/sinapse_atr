# API de Dashboard - Layout ORDER

## Visao geral

O dashboard usa grid fixo no front (CSS). O backend gerencia apenas:

- ordem dos KPIs;
- visibilidade;
- overrides de configuracao por KPI.

Nao existe layout livre por coordenadas (`x,y,w,h`).

## Base URL

- Prefixo: `/api`
- Exemplo local: `http://localhost:3000/api`
- `clientId` nas rotas corresponde a `SinapseClient.id` (cuid).

## Autenticacao e autorizacao

### ADMIN

- Header obrigatorio: `x-admin-token: <ADMIN_TOKEN>`
- Invalido/ausente: `401 {"error":"unauthorized"}`

### TENANT

- `GET /api/tenant/:clientSlug/dashboard-config`: leitura publica (nesta etapa).
- Escrita (`PUT` e `POST reset`) exige:
  - `x-dashboard-write-token: <DASHBOARD_WRITE_TOKEN>`
  - ausente: `401 {"error":"unauthorized"}`
  - invalido: `403 {"error":"forbidden"}`

## UserId temporario (feature flag)

Variavel:

- `DASHBOARD_INSECURE_USER_HEADER` (`"true"` ou `"false"`)

Regras:

- Se `"true"`, backend le `x-user-id`.
- Se `"false"`, backend ignora `x-user-id`.
- Escrita exige `userId` resolvido.
- Sem `userId`: `400 {"error":"userId required"}`.

---

## Contrato de layout (ORDER)

```json
{
  "version": 1,
  "type": "ORDER",
  "order": ["avg-first-response-time", "session-analyses-summary"],
  "hidden": ["session-analyses-summary"],
  "configOverrides": {
    "avg-first-response-time": { "periodDays": 30 }
  }
}
```

Campos:

- `version`: numero da versao do contrato.
- `type`: sempre `"ORDER"`.
- `order`: lista ordenada de `kpiKey`.
- `hidden`: lista de `kpiKey` ocultos.
- `configOverrides`: mapa `kpiKey -> json`.

## Regras de merge (effectiveLayout)

- `allowed`: somente KPIs com `isAllowed=true`.
- Base order:
  - usa `tenantDefaultLayout.order`, quando existir;
  - senao usa ordem do `KPI_REGISTRY`.
- User order:
  - aplicado somente para KPIs nao locked;
  - KPIs `locked=true` mantem posicao relativa do base order.
- Itens allowed faltantes no `order` final sao anexados ao final.
- Base hidden:
  - usa `tenantDefaultLayout.hidden`, quando existir;
  - senao usa `defaultVisible=false`.
- User hidden:
  - aplicado somente para nao locked.
- `configOverrides`:
  - merge `tenantDefault -> user` apenas para nao locked.

Resultado:

- `effectiveLayout` sempre vem no formato ORDER.

## Compatibilidade com layout legado (widgets/breakpoints)

Se existir layout antigo salvo (`breakpoints`, `x,y,w,h`):

- backend converte automaticamente para ORDER na leitura;
- ordem e extraida por `y`, depois `x`, no breakpoint principal;
- `hidden` e derivado de `isVisible=false`.

---

## 1) Admin - listar KPIs do tenant

### Metodo e URL

- Recomendado (por ID): `GET /api/admin/clients/id/:clientId/kpis`
- Legacy (por slug): `GET /api/admin/clients/:clientSlug/kpis`

### Resposta (200)

```json
{
  "clientId": "clx123",
  "client": {
    "id": "clx123",
    "slug": "corz",
    "name": "Corz"
  },
  "kpis": [
    {
      "kpiKey": "avg-first-response-time",
      "isAllowed": true,
      "defaultVisible": true,
      "defaultConfig": null,
      "locked": false,
      "updatedAt": "2026-02-13T12:00:00.000Z"
    }
  ]
}
```

---

## 2) Admin - bulk upsert de KPIs

### Metodo e URL

- Recomendado (por ID): `PUT /api/admin/clients/id/:clientId/kpis`
- Legacy (por slug): `PUT /api/admin/clients/:clientSlug/kpis`

### Body

```json
{
  "kpis": [
    {
      "kpiKey": "avg-first-response-time",
      "isAllowed": true,
      "defaultVisible": true,
      "defaultConfig": null,
      "locked": false
    }
  ]
}
```

Regras:

- valida `kpiKey` contra catalogo;
- rejeita campos inesperados no payload.

---

## 3) Admin - salvar tenant default layout

### Metodo e URL

- Recomendado (por ID): `PUT /api/admin/clients/id/:clientId/dashboard-layout/default`
- Legacy (por slug): `PUT /api/admin/clients/:clientSlug/dashboard-layout/default`

### Body

```json
{
  "layout": {
    "version": 1,
    "type": "ORDER",
    "order": ["avg-first-response-time", "session-analyses-summary"],
    "hidden": [],
    "configOverrides": {}
  }
}
```

### Resposta (200)

```json
{
  "clientId": "clx123",
  "client": {
    "id": "clx123",
    "slug": "corz",
    "name": "Corz"
  },
  "layout": {
    "version": 1,
    "type": "ORDER",
    "order": ["avg-first-response-time", "session-analyses-summary"],
    "hidden": [],
    "configOverrides": {}
  }
}
```

---

## 4) Tenant - obter dashboard-config

### Metodo e URL

- Recomendado (por ID): `GET /api/tenant/clients/id/:clientId/dashboard-config`
- Legacy (por slug): `GET /api/tenant/:clientSlug/dashboard-config`

### Resposta (200)

```json
{
  "clientId": "clx123",
  "client": {
    "id": "clx123",
    "slug": "corz",
    "name": "Corz"
  },
  "allowedKpis": [
    {
      "kpiKey": "avg-first-response-time",
      "defaultVisible": true,
      "defaultConfig": null,
      "locked": false
    }
  ],
  "tenantDefaultLayout": {
    "version": 1,
    "type": "ORDER",
    "order": ["avg-first-response-time"],
    "hidden": [],
    "configOverrides": {}
  },
  "userLayout": null,
  "effectiveLayout": {
    "version": 1,
    "type": "ORDER",
    "order": ["avg-first-response-time"],
    "hidden": [],
    "configOverrides": {}
  }
}
```

Observacao:

- este endpoint nao grava no banco.

---

## 5) Tenant - salvar layout do usuario

### Metodo e URL

- Recomendado (por ID): `PUT /api/tenant/clients/id/:clientId/dashboard-layout`
- Legacy (por slug): `PUT /api/tenant/:clientSlug/dashboard-layout`

### Headers obrigatorios

- `x-dashboard-write-token: <DASHBOARD_WRITE_TOKEN>`
- `x-user-id: <USER_ID>` (somente quando `DASHBOARD_INSECURE_USER_HEADER=true`)

### Body

```json
{
  "layout": {
    "version": 1,
    "type": "ORDER",
    "order": ["session-analyses-summary", "avg-first-response-time"],
    "hidden": ["avg-first-response-time"],
    "configOverrides": {
      "session-analyses-summary": { "fromDays": 15 }
    }
  }
}
```

Sanitizacao aplicada:

- remove `kpiKey` invalida/fora do catalogo;
- remove `kpiKey` nao allowed;
- deduplica `order` e `hidden`;
- ignora alteracoes de KPIs locked (`order`, `hidden`, `configOverrides`).

### Resposta (200)

Retorna o payload completo de `dashboard-config` recalculado.

---

## 6) Tenant - resetar layout do usuario

### Metodo e URL

- Recomendado (por ID): `POST /api/tenant/clients/id/:clientId/dashboard-layout/reset`
- Legacy (por slug): `POST /api/tenant/:clientSlug/dashboard-layout/reset`

### Headers obrigatorios

- `x-dashboard-write-token: <DASHBOARD_WRITE_TOKEN>`
- `x-user-id: <USER_ID>` (somente quando `DASHBOARD_INSECURE_USER_HEADER=true`)

### Acao

- remove `layoutKey=USER:<userId>`;
- retorna `dashboard-config` recalculado.

---

## Erros comuns

- `400 {"error":"userId required"}`
- `400 {"error":"Invalid body: ..."}`
- `401 {"error":"unauthorized"}`
- `403 {"error":"forbidden"}`
- `404 {"error":"client_not_found"}`
- `409 {"error":"slug_conflict","message":"Slug already in use"}` (endpoints de clients)
- `500 {"error":"Internal server error"}`
