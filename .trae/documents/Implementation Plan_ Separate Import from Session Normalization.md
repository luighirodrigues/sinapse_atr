I have updated the plan to include the database reset as requested.

### 1. Database Schema Changes
*   **Create `ImportedTracking` model**:
    *   Fields: `id`, `ticketId`, `externalTrackingId` (nullable), `createdAtExternal`, `startedAtExternal` (nullable), `endedAtExternal` (nullable), `processedAt` (nullable), `processingVersion`, `processingNotes`, `createdAt`, `updatedAt`.
*   **Update `Session` model**:
    *   Add `source` (String).
    *   Add `originImportedTrackingId` (String?, FK).
    *   Add `processingVersion` (String?).

### 2. Database Reset
*   **Action**: I will execute `npx prisma migrate reset --force`.
*   **Result**: This will drop the database, re-apply all migrations (including the new schema changes), and leave the database empty and ready for a fresh import.

### 3. Import Logic Adjustment (Policy A)
*   **Raw Import**: All external trackings will be saved to `imported_trackings`.
*   **Conditional Session Creation**:
    *   **Complete Tracking**: Create `Session` (`source="imported_complete"`), link to `ImportedTracking`, mark `ImportedTracking` as processed.
    *   **Weak Tracking**: Do **NOT** create a `Session`. Messages will be imported with `sessionId = null`.

### 4. Recreation Service
*   **Implementation**: Create `recreateSessionsFromImportedTrackings` logic.
*   **Logic**:
    *   Process unprocessed weak `imported_trackings`.
    *   Group messages by **24h gap**.
    *   Create sessions (`source="recreated"`, `processingVersion="v1-gap24h"`).
    *   Link messages and update `ImportedTracking` status.

I will proceed with these steps immediately after your confirmation.
