# M8 lesson: Neon persistence

## Goal

Establish PostgreSQL persistence for workspace metadata and Yjs snapshots so a
collaboration room can recover durable state instead of relying on process
memory.

## Concepts

- Migrations make database structure reproducible across development, CI, and
  deployment environments.
- A Yjs snapshot is stored as opaque `BYTEA`; the database does not need to
  understand diagram commands or CRDT internals.
- Workspace and document identifiers are scoped together so one workspace
  cannot overwrite another workspace's document.
- Persistence errors need an explicit recovery policy; silently treating a
  database failure as an empty document risks data loss.

## Implementation

- Added Neon’s serverless PostgreSQL driver and `DATABASE_URL` configuration.
- Added `npm run db:migrate`, which loads Next.js environment files and applies
  ordered, recorded SQL migrations.
- Added `workspaces`, `document_snapshots`, and `schema_migrations` tables.
- Added repository functions to upsert workspaces and load or save versioned
  Yjs snapshot bytes.
- Wired room startup recovery and post-update snapshot persistence into the
  authenticated WebSocket service, scoped by organization and document.
- Debounced snapshot writes by room and serialized writes to avoid excessive
  database traffic or out-of-order durable versions during rapid edits.
- Applied both migrations to the `multiplayer-canvas` Neon development
  project and confirmed a second migration run is idempotent.

## Current boundary

The room lifecycle now restores the latest snapshot before admitting clients
and saves the merged Yjs state after updates. A failed restore leaves the
client out of the room rather than presenting an empty document. Snapshot
write failures keep the live room available and surface an error for future
retry/observability work.

## Verification

Run:

```bash
npm run db:migrate
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

The migrations have been applied successfully, and all repository quality
gates pass.

## Interview takeaway

The WebSocket room remains responsible for real-time CRDT behavior, while a
small persistence adapter owns SQL and recovery boundaries. This separation
keeps database concerns replaceable without making the editor or Yjs model
database-aware.
