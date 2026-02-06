## Objetivo
- Criar a coluna booleana `tickets.isGroup` (default `false`) para parar de “inferir grupo” na hora de calcular KPIs e usar um valor persistido.

## Diagnóstico do código atual (ponto de partida)
- Hoje o projeto só persiste `isGroup` em `contacts.isGroup` (vem da API externa em `/contact`), e **não existe** lógica no código para inferir grupo por padrão WhatsApp (ex.: `@g.us`).
- As queries de KPIs atuais não filtram grupos (não usam `contacts.isGroup` nem outra heurística). Então a mudança vai consistir em **passar a excluir grupos explicitamente** via `tickets.isGroup = false`.

## Mudanças de Banco/Prisma
- Atualizar [schema.prisma](file:///d:/Projetos/sinapse_atr/prisma/schema.prisma) adicionando em `model Ticket`:
  - `isGroup Boolean @default(false)`
  - Índice para performance (recomendado: `@@index([clientId, isGroup])`; atende o caso real de filtro multi-tenant + flag).
- Criar migration SQL (PostgreSQL) com:
  - `ALTER TABLE "tickets" ADD COLUMN "isGroup" BOOLEAN NOT NULL DEFAULT false;`
  - Backfill dos registros existentes com a lógica atual disponível no banco:
    - `UPDATE "tickets" t SET "isGroup" = COALESCE(c."isGroup", false)
       FROM "contacts" c
      WHERE c."clientId" = t."clientId" AND c."id" = t."contactId";`
  - Criar índice (ex.: `CREATE INDEX ... ON "tickets"("clientId","isGroup");`).

## Importação (persistir `isGroup` no Ticket)
- Atualizar o contrato da API externa em [ExternalApiService.ts](file:///d:/Projetos/sinapse_atr/src/services/ExternalApiService.ts) para refletir o payload que você mostrou:
  - Incluir `isGroup?: boolean | null` em `ExternalTicket`.
- Ajustar [TicketImportService.ts](file:///d:/Projetos/sinapse_atr/src/services/TicketImportService.ts) para salvar `isGroup` ao fazer `ticketRepo.upsert(...)`:
  - `isGroup: Boolean(externalTicket.isGroup)`
  - Retrocompatibilidade de payload: se a API externa não enviar `isGroup`, cai para `false`.

## KPIs (trocar para usar `tickets.isGroup`)
- Atualizar as queries SQL para excluir tickets de grupo com `AND t."isGroup" = false`:
  - [AvgFirstResponseTimeService.ts](file:///d:/Projetos/sinapse_atr/src/services/kpis/AvgFirstResponseTimeService.ts)
    - Filtrar no CTE `Inbounds` (impacta tanto o cálculo/storing quanto o GET).
    - Corrigir um erro de sintaxe existente na query do `groupBy === 'total'` (há uma vírgula antes de `SELECT` após `InboundsInPeriod`, que invalidaria o SQL).
  - [AvgSessionDurationByTagService.ts](file:///d:/Projetos/sinapse_atr/src/services/kpis/AvgSessionDurationByTagService.ts)
    - Filtrar na CTE `BaseSessions`.
  - [TopSlowestSessionsByTagService.ts](file:///d:/Projetos/sinapse_atr/src/services/kpis/TopSlowestSessionsByTagService.ts)
    - Filtrar em todos os `WHERE t."clientId" = ...` (4 queries: com/sem tags, com/sem filtro de tag).

## Retrocompatibilidade e transição segura
- Sequência de rollout recomendada:
  1. Aplicar migration no banco (adiciona coluna + backfill + índice).
  2. Deploy do código que passa a gravar `tickets.isGroup` e filtrar KPIs.
  3. Rodar novo import (ou deixar o job atualizar tickets gradualmente), e opcionalmente disparar recompute dos KPIs (ex.: `POST /api/kpis/recompute/avg-first-response-time`).
- Durante a transição, o sistema continua funcionando porque:
  - A coluna nasce com default `false`.
  - O import tolera `isGroup` ausente no payload.

## Validação (após implementar)
- Regenerar Prisma Client e validar compilação TypeScript (`npm run build`).
- Verificar no banco:
  - Coluna e índice existem.
  - Backfill marcou `isGroup=true` nos tickets cujo contato é grupo.
- Validar KPIs:
  - Comparar resultados antes/depois em um intervalo onde existam tickets de grupo (depois devem ser excluídos).

## Arquivos que serão alterados
- Prisma/DB: `prisma/schema.prisma` + nova pasta em `prisma/migrations/.../migration.sql`
- Import: `src/services/ExternalApiService.ts`, `src/services/TicketImportService.ts`
- KPIs: `src/services/kpis/AvgFirstResponseTimeService.ts`, `AvgSessionDurationByTagService.ts`, `TopSlowestSessionsByTagService.ts`

Se você confirmar, eu implemento tudo isso e valido build + migração localmente.