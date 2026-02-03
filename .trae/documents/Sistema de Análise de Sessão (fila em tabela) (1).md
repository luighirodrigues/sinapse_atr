## Estado atual do repo (para alinhar integração)
1. API é Express (não Next.js): rotas em `src/routes/index.ts` sob `/api`, com middleware [requireAdminToken](file:///d:/Projetos/sinapse_atr/src/middlewares/requireAdminToken.ts#L1-L12) e `ADMIN_TOKEN` em [env.ts](file:///d:/Projetos/sinapse_atr/src/config/env.ts#L1-L16).
2. ORM é Prisma com migrations SQL em `prisma/migrations/*/migration.sql` (há uso de `CREATE TYPE`, `CREATE TABLE`, índices, FKs).
3. Não existe integração OpenAI hoje (nenhuma ocorrência de `openai|gpt` e sem dependência no `package.json`).

## Banco de dados (migrations)
1. Criar uma nova migration Prisma com SQL (compatível com Postgres) que:
   - Habilita `pgcrypto` se necessário: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
   - Cria tabelas `public.analysis_scripts` e `public.session_analyses` exatamente como no DDL fornecido (incluindo `IF NOT EXISTS`, `gen_random_uuid()`, constraints e índices).
   - Cria índice obrigatório: `CREATE INDEX IF NOT EXISTS ix_messages_sessionId ON public.messages ("sessionId");`
   - (Opcional) Criar `ix_messages_sessionId_updatedAtExternal` conforme recomendado.
2. Atualizar `prisma/schema.prisma` com os novos models (mapeando para `analysis_scripts` e `session_analyses`) para permitir CRUD via Prisma Client.

## Camada de dados (repositories/services)
1. Criar `AnalysisScriptRepository/Service` com operações:
   - `createVersion(clientId, payload)`
   - `list(clientId, {scriptKey?, activeOnly?})`
   - `getResolvedVersion(clientId, scriptKey, scriptVersion?)` (se `scriptVersion` ausente, pega maior `version` com `isActive=true`)
   - `activate(clientId, scriptKey, version, deactivateOthers=true)`.
2. Criar `SessionAnalysisQueueRepository/Service` com:
   - `listEligibleSessions(clientId, criteria)` usando SQL eficiente com `JOIN tickets`, `JOIN messages`, `GROUP BY`, `HAVING COUNT >= minMessages` e `NOT EXISTS contact_tags` para `tagFilter.mode='none'`.
   - `enqueue(sessionIds, combo, forceReprocess)`:
     - `forceReprocess=false`: `INSERT ... ON CONFLICT DO NOTHING`.
     - `forceReprocess=true`: `INSERT ... ON CONFLICT DO UPDATE` resetando inclusive `done` para `pending` (limpa `report/error/retryCount/nextRetryAt/processedAt/startedAt`, seta `updatedAt=now()`).
   - `claimNext(clientId, combo)` com `UPDATE ... RETURNING` (CTE) para concorrência futura, filtrando:
     - `status IN ('pending','failed')`
     - `status='pending' OR (status='failed' AND retryCount < 4)`
     - `(nextRetryAt IS NULL OR nextRetryAt <= now())`
     - ordenação por `sessions.endedAt DESC, sa.createdAt DESC`.
   - `markDone(id, {report, model, promptHash})`.
   - `markFailed(id, error)` aplicando backoff 1m/5m/15m e depois `failed` definitivo (`retryCount >= 4`, `nextRetryAt NULL`).

## Integração OpenAI (server-side)
1. Adicionar suporte via SDK oficial `openai` (preferencial) com envs:
   - `OPENAI_API_KEY` (obrigatória para processar de verdade)
   - `OPENAI_MODEL` (default seguro no código; sem hardcode fixo)
2. Implementar cliente em `src/clients/openai.ts` (singleton) e um serviço `SessionAnalysisModelService` que:
   - Gera prompt final a partir de `scriptText` + `topics` + mensagens.
   - Calcula `promptHash` (sha256) do texto final.
   - Chama Responses API com `response_format` do tipo `json_schema` e schema estável do report.
   - Garante “somente JSON” (sem markdown) e valida o parse.
3. Se for necessário evitar deps novas, fallback planejado para HTTP via axios (mesmo contrato), mas a implementação principal seguirá o SDK.

## Prompt e ordenação das mensagens
1. Carregar mensagens por sessão sem filtros de `mediaType`.
2. Ordenação determinística com fallback:
   - `ORDER BY COALESCE("updatedAtExternal","createdAtExternal","createdAt") ASC, "id" ASC`.
3. No prompt:
   - Explicar papéis: `fromMe=true` ATENDENTE e `fromMe=false` CLIENTE.
   - Para áudio sem transcrição: não inventar conteúdo; marcar como “audio_present”/“conteúdo não disponível”.
   - Exigir evidências com `messageId` e `excerpt` curto.

## Endpoints ADMIN (Express)
1. Proteger tudo com `requireAdminToken` (header `x-admin-token`).
2. Rotas sob `/api/admin/:clientSlug/*` seguindo o padrão existente do repo:
   - `POST /api/admin/:clientSlug/analysis-scripts`
   - `GET /api/admin/:clientSlug/analysis-scripts?scriptKey=&activeOnly=`
   - `POST /api/admin/:clientSlug/analysis-scripts/:scriptKey/activate`
   - `POST /api/admin/:clientSlug/session-analyses/run`
3. Resolver `clientId` via `SinapseClientRepository.findBySlug(clientSlug)` em todas.

## Endpoint run (enfileirar + processar sequencial)
1. Validar body e defaults: `minMessages=20`, `analysisVersionTag='v1'`, `forceReprocess=false`, `dryRun=false`, `limit` com teto (ex: 500).
2. Validar `tagFilter`:
   - aceitar apenas `{mode:'none'}` por agora; qualquer outro mode retorna 400 “não implementado”.
3. Dry run (sem writes): retornar métricas ajustadas para evitar ambiguidade:
   - `eligible`
   - `alreadyDone`
   - `alreadyQueued` (pending/failed para mesma combinação)
   - `wouldEnqueue = eligible - alreadyDone` (aproximação), e opcional `wouldProcessNow` (quantos estão elegíveis para claim agora por backoff).
4. Execução real:
   - Selecionar sessões elegíveis.
   - Enfileirar via `INSERT ... ON CONFLICT` (com reset se `forceReprocess=true`).
   - Loop sequencial: `claimNext` → carregar mensagens → montar prompt → chamar OpenAI → `markDone/markFailed`.
   - Sempre garantir que erro não deixe item em `processing`.
5. Resposta do endpoint: sumarizar `processed/failed/remainingQueue` e amostras (máx 20 ids).

## Observabilidade e segurança
1. Logs concisos no servidor por execução (enfileirado/processado/falhas + motivo curto, sem dados sensíveis).
2. Não logar prompt completo nem API key; apenas `promptHash`.

## Verificação (após implementar)
1. Rodar `prisma generate` e `prisma migrate dev` (ou aplicar migration no ambiente) e checar índices.
2. Exercitar endpoints localmente:
   - Criar script v1.
   - Ativar script.
   - Rodar `dryRun=true` e validar contagens.
   - Rodar `dryRun=false` com `limit` baixo e validar transições `pending→processing→done/failed` e backoff.

Se você confirmar este plano, eu implemento tudo no repo atual (Express + Prisma), incluindo migration, models Prisma, services e controllers/rotas com os comportamentos ajustados (dryRun por métricas, reset completo no forceReprocess, claimNext com retryCount<4 e ordenação por COALESCE).