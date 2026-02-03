## Contexto do repositório

* O projeto atual está estruturado como API Express + Prisma (não há handlers Next.js), mas as rotas continuam sob prefixo `/api` via `app.use('/api', routes)`, então implementar `/api/admin/...` segue o padrão existente.

* Já existe middleware de ADMIN token em `x-admin-token` e resolução `clientSlug -> clientId` via `SinapseClientRepository.findBySlug`.

* Não há integração OpenAI hoje; será necessário adicionar um serviço novo (provavelmente via `axios`) e variáveis de ambiente.

## Banco de dados (Prisma migration + models)

* Criar uma migration SQL nova com:

  * `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`

  * `CREATE TABLE IF NOT EXISTS analysis_scripts ...` (uuid `gen_random_uuid()`, jsonb `topics`, índices e unique conforme especificação).

  * `CREATE TABLE IF NOT EXISTS session_analyses ...` (uuid `gen_random_uuid()`, FK `sessionId -> sessions(id)`, índices e unique conforme especificação).

  * Índices recomendados em `messages` (`(sessionId)` e opcional `(sessionId, updatedAtExternal)`).

* Atualizar `prisma/schema.prisma` com models `AnalysisScript` e `SessionAnalysis` mapeando para `analysis_scripts` e `session_analyses` (incluindo `@db.Uuid`, `@db.Timestamptz` onde aplicável e defaults via `dbgenerated` para `gen_random_uuid()`/`'[]'::jsonb`).

## Serviços/Repositórios

* `AnalysisScriptService` (e repositório, se fizer sentido):

  * `create` (se `version` ausente: `max(version)+1` para `(clientId, scriptKey)`),

  * `list`/`getActiveLatest` (filtro `activeOnly`),

  * `activate` (transação: marca versão alvo `isActive=true` e desativa outras versões do mesmo `scriptKey`).

* `SessionAnalysisQueueService`:

  * `listEligibleSessions(clientId, criteria)` com SQL eficiente:

    * `sessions.startedAt IS NOT NULL`, `sessions.endedAt IS NOT NULL` (campo correto `endedAt`),

    * `HAVING COUNT(messages.id) >= minMessages` contando todas as mensagens da sessão,

    * `tagFilter.mode='none'`: `NOT EXISTS` em `contact_tags` para `(ticket.clientId, ticket.contactId)`,

    * `forceReprocess=false`: excluir sessões que já tenham `session_analyses.status='done'` para a mesma combinação.

  * `enqueue(sessionIds, ...)` com `INSERT ... ON CONFLICT DO NOTHING` e, se `forceReprocess=true`, `ON CONFLICT DO UPDATE` resetando para `pending` (limpando `report/error/retryCount/nextRetryAt/processedAt/startedAt`).

  * `claimNext(...)` usando CTE + `UPDATE ... RETURNING` para “claim” atômico:

    * selecionar `status='pending'` OU (`status='failed'` e `retryCount < 4` e `nextRetryAt <= now()`),

    * ordenar por `sessions.endedAt DESC` e `session_analyses.createdAt DESC`,

    * setar `status='processing'`, `startedAt=now()`, limpar `error`.

  * `markDone` e `markFailed`:

    * backoff: 1m, 5m, 15m, depois falha definitiva (manter `status='failed'`, `retryCount>=4` e `nextRetryAt=NULL`, e impedir novo claim via filtro `retryCount < 4`).

## Integração OpenAI + Prompt

* Adicionar `OPENAI_API_KEY` ao `env.ts` (validação zod) e escolher `OPENAI_MODEL` default (ex.: `gpt-5-mini`), sem logar segredos.

* Criar `OpenAiService` (server-side) usando `axios` para chamar a API (Responses) com `response_format` em `json_schema` (strict), exigindo saída apenas JSON.

* Definir schema de report estável (o sugerido no requisito) e validar minimamente a resposta (parse JSON + checar campos essenciais) antes de salvar.

* Montar prompt com:

  * `scriptText` + `topics` como checklist,

  * instruções `fromMe=true => ATENDENTE`, `fromMe=false => CLIENTE`,

  * mensagens ordenadas por `updatedAtExternal ASC` (com fallback `createdAtExternal`), incluindo metadados,

  * regra de áudio: não inventar conteúdo.

* Calcular `promptHash` (sha256 do texto final do prompt) e salvar `model`/`promptHash` em `session_analyses`.

## Endpoints ADMIN (Express)

* Atualizar `src/routes/index.ts` para adicionar, protegidos por `requireAdminToken`:

  * `POST /admin/:clientSlug/analysis-scripts`

  * `GET /admin/:clientSlug/analysis-scripts?scriptKey=&activeOnly=`

  * `POST /admin/:clientSlug/analysis-scripts/:scriptKey/activate`

  * `POST /admin/:clientSlug/session-analyses/run`

* Implementar controllers novos:

  * `AnalysisScriptController` para CRUD mínimo/activate.

  * `SessionAnalysisController` para `run`.

* Fluxo do `run`:

  * resolver `clientId` por `clientSlug`,

  * resolver script por `(scriptKey, scriptVersion)` ou pela versão ativa mais alta,

  * validar `tagFilter` (aceitar só `{mode:'none'}`; demais: 400 “não implementado”),

  * aplicar defaults e teto seguro de `limit` (ex.: 500),

  * `dryRun=true`: apenas calcular `enqueued/processed/remainingQueue` estimados sem INSERT/UPDATE nem OpenAI,

  * caso normal: enfileirar e processar sequencialmente com loop `claim -> load messages -> call OpenAI -> markDone/markFailed` até `limit`.

* Retornar o JSON de resumo exatamente no formato solicitado (incluindo `sample.processedIds/failedIds` com máx 20).

## Verificação

* Rodar geração do Prisma Client e build TypeScript.

* Validar manualmente com chamadas HTTP:

  * criar script, ativar versão,

  * executar `run` em `dryRun`,

  * executar `run` real com `limit` pequeno e observar persistência em `session_analyses`.

## Arquivos que serão adicionados/alterados

* Alterar: `prisma/schema.prisma`, `src/routes/index.ts`, `src/config/env.ts`.

* Adicionar: migration SQL nova em `prisma/migrations/.../migration.sql`.

* Adicionar: `src/controllers/AnalysisScriptController.ts`, `src/controllers/SessionAnalysisController.ts`.

* Adicionar: `src/services/AnalysisScriptService.ts`, `src/services/SessionAnalysisQueueService.ts`, `src/services/OpenAiService.ts` (ou pasta `services/openai`).

* Adicionar: repositórios se necessário (ou usar Prisma direto nos services, seguindo padrão do projeto).

