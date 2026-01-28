# Plano de Implementação

## 1. Middleware de Autenticação (`x-admin-token`)
- **Criar arquivo**: `src/middlewares/requireAdminToken.ts`
  - Implementar middleware que verifica estritamente o header `x-admin-token` contra `env.ADMIN_TOKEN`.
  - Retornar `401 { "error": "unauthorized" }` em caso de falha.
- **Atualizar Rotas**: `src/routes/index.ts`
  - Remover a função inline `adminAuth`.
  - Importar e usar o novo middleware `requireAdminToken`.
  - Aplicar nas rotas `/jobs/import`, `/jobs/import/:slug` e `/clients` (CRUD).

## 2. TicketController e Nova Rota
- **Atualizar Controller**: `src/controllers/TicketController.ts`
  - Adicionar dependência `SinapseClientRepository`.
  - Criar método `getByClientAndUuid(req, res)`:
    1. Buscar cliente pelo `clientSlug` (retornar 404 se não achar).
    2. Buscar ticket usando `(client.id, uuid)` (retornar 404 se não achar).
    3. Retornar ticket encontrado.
  - Atualizar método `get(req, res)` existente para retornar `400 { "error": "clientSlug_required" }`.
- **Atualizar Rotas**: `src/routes/index.ts`
  - Adicionar nova rota: `GET /tickets/:clientSlug/:uuid`.
  - Manter rota antiga `GET /tickets/:uuid` apontando para o método que retorna erro (para feedback claro).

## 3. Documentação
- **Atualizar README.md**:
  - Substituir referências de `Authorization: <token>` para `x-admin-token: <token>`.
  - Atualizar exemplos de cURL.
  - Documentar a nova rota de tickets.

## 4. Verificação
- Garantir que o código TypeScript compile (verificação estática).
- Revisar se todas as referências ao header antigo foram removidas.
