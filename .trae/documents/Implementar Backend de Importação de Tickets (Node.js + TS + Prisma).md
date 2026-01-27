Vou criar o projeto seguindo a arquitetura em camadas e os requisitos detalhados.

# Plano de Implementação: Backend de Importação de Tickets

## 1. Configuração do Projeto
- Inicializar projeto Node.js com TypeScript.
- Instalar dependências: `express`, `prisma`, `@prisma/client`, `axios`, `zod`, `dotenv`.
- Configurar `tsconfig.json` e scripts no `package.json` (`dev`, `build`, `start`, `import`).

## 2. Modelagem de Dados (Prisma)
- Criar `prisma/schema.prisma` com os modelos:
    - `ImportState`: Controle de cursor global (`tickets_import`).
    - `Ticket`: Dados do ticket e cursor local (`lastImportedMessageCreatedAt`).
    - `Session`: Sessões normalizadas (CLOSED, OPEN_REAL, OPEN_WEAK).
    - `Message`: Mensagens com vínculo a Ticket e Sessão.
- Definir índices para performance.

## 3. Arquitetura em Camadas (`src/`)
- **config/**: Validação de variáveis de ambiente com Zod (`env.ts`).
- **prisma/**: Instância singleton do Prisma Client.
- **repositories/**:
    - `TicketRepository`: Upsert e busca de tickets.
    - `SessionRepository`: Gerenciamento de sessões.
    - `MessageRepository`: Upsert de mensagens e atualização de vínculos.
    - `ImportStateRepository`: Controle do `lastImportAt`.
- **services/**:
    - `ExternalApiService`: Cliente Axios com retry/backoff para a API externa.
    - `NormalizationService`:
        - Lógica de merge de sessões OPEN_WEAK.
        - Regras de atribuição de mensagens (Time Window).
    - `TicketImportService`:
        - Orquestração do fluxo incremental (ImportState -> Tickets -> Messages).
        - Paginação e controle de cursor local por ticket.
- **controllers/**: Handlers para os endpoints da API.
- **routes/**: Definição das rotas (`/jobs/import`, `/health`, `/tickets/:uuid`).
- **app.ts**: Configuração do Express.
- **server.ts**: Entry point do servidor HTTP.
- **console.ts**: Entry point para o runner CLI.

## 4. Lógica de Negócio Crítica
- **Idempotência**: Uso de chaves únicas (`externalUuid`, `externalMessageId`) e `upsert`.
- **Incremental**:
    - Global: Filtrar tickets por `updatedAt >= lastImportAt`.
    - Local: Parar paginação de mensagens quando `createdAt <= lastImportedMessageCreatedAt`.
- **Sessões**: Implementação rigorosa das regras de merge (60s) e prioridade de sessões abertas.

## 5. Entregáveis Finais
- Código fonte completo.
- Arquivo `.env.example`.
- `README.md` com instruções de execução.
- Scripts de migração do Prisma.
