# AGENTS.md

This document defines the rules, constraints, and domain knowledge that AI agents must follow when generating or modifying code in this repository.

The goal is to prevent incorrect assumptions about the external API, data model, and import logic.

---

## 1. Tech Stack (DO NOT CHANGE)

- Runtime: Node.js
- Language: TypeScript (strict)
- Web Framework: Express
- ORM: Prisma
- Database: PostgreSQL
- HTTP Client: Axios

Do NOT:
- Switch database engines
- Introduce another ORM
- Introduce serverless or framework-specific assumptions

---

## 2. Database Rules

### 2.1 Database Connection
- The database is PostgreSQL.
- Connection is provided via `DATABASE_URL` environment variable.
- Prisma is the single source of truth for schema and migrations.

### 2.2 Identifiers
- Tickets are uniquely identified by `externalUuid` (tenant is already embedded in the uuid).
- Messages are uniquely identified by `externalMessageId` per ticket.
- Sessions are derived from `ticketTrakings`.

Never generate composite tenant-based identifiers.

---

## 3. External API (CRITICAL)

### Base URL

https://atende-api.corz.com.br/api

###
Headers

- api-key: `atende-api-key`(from environment variable)


### Endpoints

#### GET /ticket
- Returns tickets with `updatedAt`.
- Use `updatedAt` to decide which tickets must be reprocessed.
- Pagination may exist; code must be resilient to pagination.

#### GET /ticket/:uuid/messages
- This endpoint ALWAYS returns all messages of the ticket.
- The query parameter `updatedAfter` exists but DOES NOT filter results.
- Never assume incremental message fetch from the API.

### Consequence
- Message import MUST be incremental using local database state.
- Always use idempotent upserts for messages.

---

## 4. Ticket Import Strategy

### 4.1 Incremental Logic
- Incremental import is based on `ticket.updatedAt`.
- A global import cursor must be stored in the database (`ImportState` table).
- Initial import date: `2026-01-01T00:00:00.000Z`.

### 4.2 Message Cursor
- Each ticket stores `lastImportedMessageCreatedAt`.
- When importing messages:
  - Fetch messages paginated.
  - Stop pagination early if message.createdAt <= lastImportedMessageCreatedAt.
  - Still upsert defensively using unique constraints.

---

## 5. Session (Conversation) Rules

### 5.1 ticketTrakings Normalization

Each ticketTracking must be classified as:

#### CLOSED
- startedAt != null
- finishedAt != null
- Represents a closed conversation

#### OPEN_REAL
- startedAt != null
- finishedAt == null
- Represents an open conversation with a reliable start

#### OPEN_WEAK
- startedAt == null
- finishedAt == null
- Placeholder tracking (menu/bot/reopen)
- May be duplicated

### 5.2 Session Start / End

For each tracking:

start = startedAt ?? createdAt
end = finishedAt ?? null


### 5.3 Deduplication Rules
- Multiple OPEN_WEAK trackings with createdAt difference <= 60 seconds MUST be merged.
- Use the earliest createdAt as session start.

### 5.4 Final Sessions per Ticket
- All CLOSED sessions must be preserved.
- Only ONE open session may exist:
  - Prefer OPEN_REAL
  - Otherwise use the most recent merged OPEN_WEAK
- If no open session exists, ticket has no active conversation.

---

## 6. Message → Session Assignment

Messages are assigned using `message.createdAt`.

### Assignment Order
1. CLOSED session where:

session.start <= message.createdAt <= session.end

2. OPEN session where:

3. If no session matches:
- Assign message as UNTRACKED
- Do NOT discard messages

### Important
- When a ticket is reprocessed, messages MUST be reassigned to sessions.
- Sessions may change over time (startedAt/finishedAt can appear later).

---

## 7. OPEN_WEAK Anchoring Rule (VERY IMPORTANT)

When session type is OPEN_WEAK:
- The tracking start alone is not reliable.
- Anchor session start using messages:

session.start = min(
tracking.createdAt,
firstMessage.createdAt
)


This prevents early messages from being excluded.

---

## 8. Idempotency Rules

- Messages MUST be upserted using:

UNIQUE(ticketId, externalMessageId)

- Sessions MUST NOT be duplicated when reimporting.
- Reprocessing the same ticket multiple times MUST NOT change results.

---

## 9. Reprocessing Rules

- Any ticket whose `updatedAt` changes MUST:
- Re-normalize sessions
- Reassign messages to sessions
- Never assume sessions are immutable.

---

## 10. What NOT To Do

❌ Do NOT rely on `updatedAfter` in message endpoint  
❌ Do NOT infer sessions from message gaps  
❌ Do NOT merge CLOSED sessions  
❌ Do NOT discard messages that do not match a session  
❌ Do NOT assume one tracking equals one session  

---

## 11. Expected Code Structure

- `/src/services/import`
- `/src/services/sessions`
- `/src/services/messages`
- `/src/repositories`
- `/src/routes`
- `/src/prisma`

Agents must follow this structure.

---

## 12. Goal of the System

The system must produce:
- Accurate historical conversations
- Correct session segmentation
- Safe incremental imports
- Zero data loss
