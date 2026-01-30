## Ajustes incorporados (conforme pedido)
- `contactId` no payload será **string** (`String(row.contactId)`), para evitar overflow/BigInt.
- Intervalo de datas: usar padrão **half-open**:
  - `startedAt >= startDate AND startedAt < endExclusive`
  - Quando `to` vier como `YYYY-MM-DD`, `endExclusive = nextDay(to)` (00:00 do dia seguinte) para garantir consistência.
- Query mantém a estratégia de performance: CTE `Ranked` filtra tenant/datas, calcula duração, ordena e limita; só depois agrega tags via `LEFT JOIN LATERAL`.
- Filtro por `tag`: `EXISTS` case-insensitive, sem duplicar sessões.
- `includeTags=false` omite `contactTags` (default `true`).

## Implementação proposta
### 1) Service
- Criar [TopSlowestSessionsByTagService.ts](file:///d:/Projetos/sinapse_atr/src/services/kpis/) com:
  - `getTopSlowestSessionsByTag({ clientId, startDate, endDate, tag, limit, includeTags })`
- Implementar com `prisma.$queryRaw` e SQL (2 variantes: com/sem `tag`), no estilo dos serviços de KPI existentes.
- SQL (forma):
  - `WITH Ranked AS (...)` seleciona campos da session/ticket/contact, calcula `durationMs`, aplica:
    - `t."clientId" = ${clientId}`
    - `s."endedAt" IS NOT NULL`
    - `s."startedAt" >= ${startDate} AND s."startedAt" < ${endDate}` (onde `endDate` aqui é o `endExclusive` quando `to` é date-only)
    - `EXISTS (...)` quando `tag` for informado (case-insensitive)
    - `ORDER BY durationMs DESC LIMIT ${limit}`
  - Query final faz `LEFT JOIN LATERAL` para `ARRAY_AGG(DISTINCT tag.name ORDER BY tag.name)` e `COALESCE(..., ARRAY['Sem tag']::text[])`.
- Pós-processamento:
  - `contactId: String(row.contactId)`
  - `durationMs: Math.round(Number(row.durationMs))`
  - Se `includeTags=false`, remover `contactTags` do item.

### 2) Controller
- Atualizar [KpiController.ts](file:///d:/Projetos/sinapse_atr/src/controllers/KpiController.ts):
  - Instanciar `TopSlowestSessionsByTagService`.
  - Implementar `getTopSlowestSessionsByTag(req,res)`:
    - Valida `clientSlug`, `from`, `to` obrigatórios.
    - Resolve `clientSlug -> client.id` via `SinapseClientRepository.findBySlug`.
    - Parse de datas:
      - `startDate = new Date(from)`.
      - `endDate`:
        - se `to` for `YYYY-MM-DD`, `endExclusive = nextDay(to)` (00:00) e usar como `endDate` no service.
        - senão, `endDate = new Date(to)` e manter a semântica half-open apenas quando `to` date-only.
    - `limit` default 10, clamp até 50.
    - `tag` trim; vazio vira `undefined`.
    - `includeTags` default true; aceitar `false|0`.
    - Responder no formato fixo combinado (com `ticketExternalUuid` vindo de `tickets.externalUuid`).

### 3) Rotas
- Atualizar [routes/index.ts](file:///d:/Projetos/sinapse_atr/src/routes/index.ts) (protegido por `requireAdminToken`):
  - `GET /kpis/top-slowest-sessions-by-tag` → `KpiController.getTopSlowestSessionsByTag`

### 4) README + teste manual
- Atualizar [README.md](file:///d:/Projetos/sinapse_atr/README.md) com exemplos `curl` para:
  - Global
  - Por tag
  - `includeTags=false`
  - Sempre com `/api/...` e `x-admin-token`.

### 5) Verificação
- Rodar `npm run build` e corrigir qualquer erro de TypeScript/ESLint que apareça.
