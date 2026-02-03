# Endpoints — Análise de Sessão (fila + dashboard)

Este documento descreve:

- **ADMIN**: gerenciar **rubricas (scripts)** e executar a **fila de análises de sessão**
- **TENANT**: endpoints de leitura para o **dashboard** (ex.: summary)

## Autenticação

### ADMIN

Todos os endpoints `ADMIN` abaixo exigem o header:

- `x-admin-token: <ADMIN_TOKEN>`

O token é validado pelo middleware [requireAdminToken](file:///d:/Projetos/sinapse_atr/src/middlewares/requireAdminToken.ts#L1-L12).

### TENANT

Os endpoints `TENANT` descritos abaixo **não exigem autenticação** no backend atual (leitura pública por `clientSlug`).

## Base URL

As rotas estão registradas sob `/api` (Express). Logo, os prefixos reais são:

- `/api/admin/...`
- `/api/tenant/...`

## Identificação do tenant

Todos os endpoints são multi-tenant e recebem:

- `:clientSlug` (ex: `meu-cliente`)

O backend resolve `clientId` a partir do `clientSlug` via `SinapseClientRepository.findBySlug`.

---

## ADMIN — Scripts (rubricas)

Scripts ficam na tabela `analysis_scripts` e são versionados por:

- `clientId + scriptKey + version`

Uma versão pode estar `isActive=true`. O endpoint de execução pode resolver automaticamente a versão ativa mais alta.

### 1) Criar script/version

`POST /api/admin/:clientSlug/analysis-scripts`

Cria um novo script. Se `version` não vier, o backend usa `max(version)+1` para o `scriptKey` daquele `clientId`.

**Body**

```json
{
  "scriptKey": "agendamento-revisao",
  "version": 1,
  "name": "Rubrica de agendamento e revisão",
  "description": "Opcional",
  "scriptText": "Texto humano completo da rubrica",
  "topics": [
    { "key": "greeting", "label": "Cumprimentou", "weight": 1 }
  ],
  "isActive": true
}
```

**Respostas**

- `201` com o registro criado (inclui `clientId`, `createdAt`, `updatedAt`)
- `400` se faltar `scriptKey`, `name` ou `scriptText`, ou se `version` for inválida
- `404` se `clientSlug` não existir

**Exemplo (curl)**

```bash
curl -X POST "http://localhost:3000/api/admin/MEU_SLUG/analysis-scripts" ^
  -H "Content-Type: application/json" ^
  -H "x-admin-token: $ADMIN_TOKEN" ^
  -d "{\"scriptKey\":\"agendamento-revisao\",\"name\":\"Rubrica v1\",\"scriptText\":\"...\",\"topics\":[]}"
```

### 2) Listar scripts

`GET /api/admin/:clientSlug/analysis-scripts?scriptKey=...&activeOnly=...`

**Query params**

- `scriptKey` (opcional): filtra por uma chave específica
- `activeOnly` (opcional, default `false`): quando `true`, retorna apenas versões `isActive=true`

**Respostas**

- `200` com lista (ordenada por `scriptKey asc, version desc`)
- `404` se `clientSlug` não existir

**Exemplo**

```bash
curl "http://localhost:3000/api/admin/MEU_SLUG/analysis-scripts?scriptKey=agendamento-revisao&activeOnly=true" ^
  -H "x-admin-token: $ADMIN_TOKEN"
```

### 3) Ativar uma versão

`POST /api/admin/:clientSlug/analysis-scripts/:scriptKey/activate`

Ativa a versão informada. Por padrão, desativa as outras versões do mesmo `scriptKey`.

**Body**

```json
{
  "version": 2,
  "deactivateOthers": true
}
```

**Respostas**

- `200` `{ ok: true, scriptKey, version, deactivateOthers }`
- `400` se `version` faltar/for inválida
- `404` se `clientSlug` não existir ou se aquela versão não existir

---

## Rodar fila (enfileirar + processar sequencialmente)

`POST /api/admin/:clientSlug/session-analyses/run`

Esse endpoint:

1. Resolve `clientId` por `clientSlug`
2. Resolve o script:
   - se `scriptVersion` vier: busca aquela versão
   - se não vier: busca a versão ativa (`isActive=true`) de maior `version`
3. Seleciona sessões elegíveis
4. Enfileira (cria/atualiza `session_analyses`)
5. Processa sequencialmente (1 por vez) até `limit`

### Body

```json
{
  "scriptKey": "agendamento-revisao",
  "scriptVersion": 1,
  "analysisVersionTag": "v1",
  "minMessages": 20,
  "tagFilter": { "mode": "none" },
  "limit": 200,
  "forceReprocess": false,
  "dryRun": false
}
```

**Defaults**

- `analysisVersionTag`: `"v1"`
- `minMessages`: `20`
- `limit`: `200` (teto seguro no backend: `500`)
- `forceReprocess`: `false`
- `dryRun`: `false`
- `tagFilter`: `{ "mode":"none" }`

### Elegibilidade (implementação atual)

O endpoint considera elegível quando:

- `sessions.startedAt IS NOT NULL`
- `sessions.endedAt IS NOT NULL`
- `COUNT(messages) >= minMessages` (conta **todas** as mensagens da sessão)
- `tagFilter.mode='none'`: o contato do ticket **não tem tags**  
  (`NOT EXISTS contact_tags WHERE (clientId, contactId)` do ticket)

Observação: por ora, apenas `tagFilter.mode='none'` está implementado; outros modes retornam `400`.

### Idempotência vs Reprocessamento

Chave única de execução:

- `(sessionId, scriptKey, scriptVersion, analysisVersionTag)`

**`forceReprocess=false`**

- Enfileira apenas sessões que **não têm** uma execução `done` na mesma combinação.
- `enqueue` usa `ON CONFLICT DO NOTHING`.

**`forceReprocess=true`**

- Permite re-enfileirar mesmo se já existir `done`.
- Como existe constraint única, o backend faz **reset** via `ON CONFLICT DO UPDATE`, colocando tudo de volta em `pending` e limpando:
  - `report`, `error`, `retryCount`, `nextRetryAt`, `processedAt`, `startedAt`, `model`, `promptHash`

### dryRun (sem writes)

Quando `dryRun=true`, o endpoint não insere nem atualiza nada. Ele retorna métricas para estimativa:

- `eligible`: sessões que atendem critérios
- `alreadyDone`: quantas já têm `done` na mesma combinação
- `alreadyQueued`: quantas já estão `pending/failed` na mesma combinação
- `wouldEnqueue = max(eligible - alreadyDone, 0)`

Além disso, retorna `remainingQueue` (quantidade ainda “processável” na fila para aquela combinação).

### Claim e execução sequencial (1 a 1)

O processamento é feito em loop sequencial, em que cada iteração:

1. Faz `claimNext` com `UPDATE ... RETURNING`, pegando 1 item por vez.
2. Filtra por:
   - `status IN ('pending','failed')`
   - `status='pending' OR (status='failed' AND retryCount < 4)`
   - `nextRetryAt IS NULL OR nextRetryAt <= now()`
3. Ordena por `sessions.endedAt DESC, session_analyses.createdAt DESC`
4. Carrega mensagens da sessão sem filtros, ordenando por:
   - `ORDER BY COALESCE(updatedAtExternal, createdAtExternal, createdAt) ASC, id ASC`
5. Monta prompt e chama OpenAI Responses API com `response_format=json_schema`

### Backoff e “failed definitivo”

Em erro, a execução:

- incrementa `retryCount`
- define `nextRetryAt`:
  - `1` → +1min
  - `2` → +5min
  - `3` → +15min
  - `>=4` → `nextRetryAt = NULL` (não será mais “claimada”)
- status fica `failed` (não permanece `processing`)

### Resposta (dryRun=false)

```json
{
  "clientId": "cuid-ou-text",
  "scriptKey": "agendamento-revisao",
  "scriptVersion": 1,
  "analysisVersionTag": "v1",
  "criteria": {
    "minMessages": 20,
    "tagFilter": { "mode": "none" },
    "forceReprocess": false
  },
  "enqueued": 123,
  "processed": 15,
  "failed": 2,
  "remainingQueue": 50,
  "sample": {
    "processedIds": ["... até 20 ids ..."],
    "failedIds": ["... até 20 ids ..."]
  }
}
```

### Resposta (dryRun=true)

Além dos campos de contexto e `criteria`, retorna:

```json
{
  "eligible": 1000,
  "alreadyDone": 200,
  "alreadyQueued": 50,
  "wouldEnqueue": 800
}
```

### Exemplo (curl) — dryRun

```bash
curl -X POST "http://localhost:3000/api/admin/MEU_SLUG/session-analyses/run" ^
  -H "Content-Type: application/json" ^
  -H "x-admin-token: $ADMIN_TOKEN" ^
  -d "{\"scriptKey\":\"agendamento-revisao\",\"analysisVersionTag\":\"v1\",\"minMessages\":20,\"tagFilter\":{\"mode\":\"none\"},\"dryRun\":true}"
```

### Exemplo (curl) — executar de verdade

```bash
curl -X POST "http://localhost:3000/api/admin/MEU_SLUG/session-analyses/run" ^
  -H "Content-Type: application/json" ^
  -H "x-admin-token: $ADMIN_TOKEN" ^
  -d "{\"scriptKey\":\"agendamento-revisao\",\"analysisVersionTag\":\"v1\",\"minMessages\":20,\"tagFilter\":{\"mode\":\"none\"},\"limit\":50,\"forceReprocess\":false,\"dryRun\":false}"
```

## Variáveis de ambiente relevantes

- `ADMIN_TOKEN` (obrigatória para subir o servidor)
- `OPENAI_API_KEY` (obrigatória para `dryRun=false`)
- `OPENAI_MODEL` (opcional; default no código: `gpt-5-mini`)

---

## TENANT — Dashboard

### 1) Summary (card do dashboard)

`GET /api/tenant/:clientSlug/session-analyses/summary`

Retorna um resumo agregado para alimentar o card do dashboard:

- Resolve `clientId` por `clientSlug`
- Resolve a combinação (`scriptKey/scriptVersion`) assim:
  - se vier `scriptKey` e não vier `scriptVersion`: usa a **versão ativa mais alta** daquele `scriptKey`
  - se não vier `scriptKey`: usa o **script ativo mais recentemente atualizado**
- Agrega contadores da fila para a combinação:
  - `pending`, `processing`, `failedRetryable` (`retryCount < 4`), `failedPermanent` (`retryCount >= 4`)
- Agrega resultados recentes (janela `fromDays`) para a combinação:
  - `done`, `avgOverallScore`, contagem por `temperature`, `lastProcessedAt`

**Query params**

- `analysisVersionTag` (opcional, default `"v1"`)
- `scriptKey` (opcional)
- `scriptVersion` (opcional; int)
- `fromDays` (opcional; int `1..365`, default `30`)

**Resposta (200)**

```json
{
  "clientId": "cuid-ou-text",
  "clientSlug": "tterrasul",
  "combo": { "scriptKey": "agendamento-revisao", "scriptVersion": 1, "analysisVersionTag": "v1" },
  "window": { "from": "2026-01-04T00:00:00.000Z", "to": "2026-02-03T00:00:00.000Z", "fromDays": 30 },
  "queue": { "pending": 0, "processing": 0, "failedRetryable": 0, "failedPermanent": 0 },
  "results": {
    "done": 2,
    "avgOverallScore": 11,
    "temperature": { "cold": 1, "neutral": 1, "warm": 0, "hot": 0 },
    "lastProcessedAt": "2026-02-03T18:38:55.852Z"
  }
}
```

**Sem script ativo**

Se o tenant não tiver nenhuma rubrica ativa (`analysis_scripts.isActive=true`), a API retorna `combo=null` e métricas zeradas (para a tela não quebrar), além de uma mensagem de aviso.

**Exemplo (curl)**

```bash
curl "http://localhost:3000/api/tenant/MEU_SLUG/session-analyses/summary?fromDays=30"
```

### 2) Ranking (lista do dashboard)

`GET /api/tenant/:clientSlug/session-analyses/ranking`

Retorna uma lista das análises `done` mais “críticas” (ordenadas por `overallScore` asc) dentro da janela `fromDays`.

**Query params**

- `analysisVersionTag` (opcional, default `"v1"`)
- `scriptKey` (opcional)
- `scriptVersion` (opcional; int)
- `fromDays` (opcional; int `1..365`, default `30`)
- `limit` (opcional; int `1..200`, default `10`)

**Resposta (200)**

```json
{
  "clientId": "cuid-ou-text",
  "clientSlug": "tterrasul",
  "combo": { "scriptKey": "agendamento-revisao", "scriptVersion": 1, "analysisVersionTag": "v1" },
  "window": { "from": "2026-01-04T00:00:00.000Z", "to": "2026-02-03T00:00:00.000Z", "fromDays": 30 },
  "limit": 10,
  "items": [
    {
      "sessionAnalysisId": "uuid",
      "sessionId": "uuid",
      "ticket": { "id": "uuid", "externalUuid": "..." },
      "session": { "startedAt": "ISO|null", "endedAt": "ISO|null" },
      "processedAt": "ISO|null",
      "overallScore": 11,
      "temperature": "cold",
      "summary": "..."
    }
  ]
}
```

**Exemplo (curl)**

```bash
curl "http://localhost:3000/api/tenant/MEU_SLUG/session-analyses/ranking?limit=10&fromDays=30"
```

### 3) Details (detalhe do relatório)

`GET /api/tenant/:clientSlug/session-analyses/details?sessionId=...`

Retorna o detalhe da análise (inclui `report`) para uma sessão específica, na combinação resolvida (`scriptKey/scriptVersion/analysisVersionTag`).

**Query params**

- `sessionId` (obrigatório)
- `analysisVersionTag` (opcional, default `"v1"`)
- `scriptKey` (opcional)
- `scriptVersion` (opcional; int)

**Resposta (200)**

```json
{
  "clientId": "cuid-ou-text",
  "clientSlug": "tterrasul",
  "combo": { "scriptKey": "agendamento-revisao", "scriptVersion": 1, "analysisVersionTag": "v1" },
  "session": {
    "id": "uuid",
    "ticketId": "uuid|null",
    "ticketExternalUuid": "string|null",
    "startedAt": "ISO|null",
    "endedAt": "ISO|null"
  },
  "analysis": {
    "id": "uuid",
    "status": "done|pending|processing|failed",
    "startedAt": "ISO|null",
    "processedAt": "ISO|null",
    "retryCount": 0,
    "nextRetryAt": "ISO|null",
    "error": "string|null",
    "model": "string|null",
    "promptHash": "string|null",
    "report": {},
    "createdAt": "ISO",
    "updatedAt": "ISO"
  }
}
```

**Exemplo (curl)**

```bash
curl "http://localhost:3000/api/tenant/MEU_SLUG/session-analyses/details?sessionId=SESSION_ID"
```
