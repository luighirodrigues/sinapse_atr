# Refactor for Multi-Tenancy (Clean Database Strategy)

Since existing data can be discarded, we will implement the schema changes directly with strict constraints.

## 1. Database Schema (`prisma/schema.prisma`)

1. **Create** **`SinapseClient`** **model**:

   * Fields: `id`, `slug` (unique), `name`, `apiBaseUrl`, `apiKey`, `isActive`, timestamps.
2. **Update** **`Ticket`** **model**:

   * Add `clientId` (String, NOT NULL).

   * Relation to `SinapseClient`.

   * Update unique to `@@unique([clientId, externalUuid])`.

   * Add index `@@index([clientId, updatedAtExternal])`.
3. **Update** **`ImportState`** **model**:

   * Add `clientId` (String, NOT NULL).

   * Relation to `SinapseClient`.

   * Update unique to `@@unique([clientId, key])`.
4. **Migration**:

   * Generate a new migration. Since we are allowed to reset the database, this migration will apply the changes directly (which would normally require a reset if data existed).

## 2. Configuration & Env

* Remove global `EXTERNAL_API_BASE_URL` and `EXTERNAL_API_TOKEN` from `src/config/env.ts`.

* Add `ADMIN_TOKEN` for API protection.

* Update `.env.example`.

## 3. Code Refactoring

1. **External API**:

   * Create factory `createExternalApiClient(client: SinapseClient)` returning an Axios instance with `api-key` header.
2. **Repositories**:

   * Update `TicketRepository` and `ImportStateRepository` to require and use `clientId`.

   * Create `SinapseClientRepository` for client management.
3. **Import Service**:

   * Refactor `TicketImportService` to iterate through all active clients.

   * Use client-specific API instances and repositories.

## 4. Admin API

* Create `ClientController` for CRUD operations (`/clients`).

* Update `JobController` to support importing all clients or a specific client by slug.

* Protect these routes with `ADMIN_TOKEN`.

## 5. Verification

* Create a seed script to insert a test client.

* Run the import job to verify end-to-end functionality.

