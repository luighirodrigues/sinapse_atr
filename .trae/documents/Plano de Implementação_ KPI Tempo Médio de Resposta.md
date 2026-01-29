O plano a seguir detalha as etapas para implementar o KPI "Tempo médio de resposta para conversas".

### 1. Modelagem de Dados (Prisma)
Atualizaremos o arquivo `prisma/schema.prisma` para suportar a classificação de mensagens e armazenar as métricas.

*   **Adicionar Enum `MessageSenderType`**: Valores `HUMAN`, `SYSTEM`, `AI`.
*   **Atualizar Model `Message`**:
    *   Adicionar campo `senderType` do tipo `MessageSenderType` com valor padrão `HUMAN`.
    *   Adicionar índices sugeridos para performance:
        *   `@@index([ticketId, sessionId, createdAt])`
        *   `@@index([ticketId, sessionId, fromMe, createdAt])`
*   **Criar Model `ConversationMetrics`**:
    *   Campos: `id`, `clientId`, `sessionId`, `firstInboundAt`, `firstOutboundAt`, `firstResponseTimeMs`, `createdAt`.
    *   Relacionamentos e constraints conforme especificado.

### 2. Tipagem e Ingestão de Dados
Atualizaremos a tipagem da API externa e a lógica de importação para classificar corretamente as mensagens.

*   **Atualizar `src/services/ExternalApiService.ts`**:
    *   Adicionar `generatedByAi?: boolean` e `sendBySystem?: boolean` na interface `ExternalMessage`.
*   **Atualizar `src/services/TicketImportService.ts`**:
    *   No método `importMessagesForTicket`, implementar a lógica de mapeamento:
        *   Se `generatedByAi` -> `senderType = AI`
        *   Se `sendBySystem` -> `senderType = SYSTEM`
        *   Caso contrário -> `senderType = HUMAN`

### 3. Implementação do Serviço de KPI
Criaremos um novo serviço dedicado ao cálculo e recuperação do KPI.

*   **Arquivo**: `src/services/kpis/AvgFirstResponseTimeService.ts`
*   **Método `calculateAndStoreFirstResponseTimes`**:
    *   Buscará sessões ativas no período.
    *   Para cada sessão, identificará o primeiro inbound e o subsequente outbound.
    *   Calculará o delta e salvará em `ConversationMetrics` (upsert).
*   **Método `getAvgFirstResponseTime`**:
    *   Realizará a consulta agregada em `ConversationMetrics` filtrando por período.
    *   Retornará média e contagens (respondidas vs não respondidas).

### 4. Controller e Rotas
Expor os dados via API.

*   **Criar `src/controllers/KpiController.ts`**:
    *   Método `getKpi`: processa a requisição GET, extrai filtros e chama o serviço.
    *   Método `recomputeKpi` (Admin): aciona o recálculo manual.
*   **Atualizar `src/routes/index.ts`**:
    *   Adicionar rota `GET /api/kpis/avg-first-response-time`.
    *   Adicionar rota `POST /api/kpis/recompute/avg-first-response-time`.

### 5. Execução e Verificação
*   Gerar migração do banco de dados (`prisma migrate dev`).
*   Verificar se mensagens antigas assumiram `HUMAN`.
*   Rodar testes manuais de importação e verificação do KPI.
