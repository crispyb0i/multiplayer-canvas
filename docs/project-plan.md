# Multiplayer Canvas curriculum

Active milestone: M11

This project is built as a sequence of lessons. Each milestone should leave the app runnable, tested, and explainable in an interview. The active milestone is **M11**.

## Milestones

| Milestone | Lesson                              | Main outcome                                                 |
| --------- | ----------------------------------- | ------------------------------------------------------------ |
| M0        | Repository and engineering baseline | Next.js app, quality gates, CI, project conventions          |
| M1        | Local document model                | Typed shapes, commands, serialization, validation            |
| M2        | Single-user editor                  | Canvas interactions, selection, pan/zoom, keyboard input     |
| M3        | History and undo/redo               | Command history with focused tests                           |
| M4        | Yjs without networking              | CRDT document model synced-state tests in one process        |
| M5        | WebSocket collaboration             | Room transport, reconnect behavior, multi-client tests       |
| M6        | Presence                            | Cursors, selections, awareness, ephemeral state              |
| M7        | Authentication and authorization    | Users, sessions, workspace membership, permission boundaries |
| M8        | Neon persistence                    | PostgreSQL metadata, snapshots, migrations, recovery path    |
| M9        | Offline and reconnect sync          | Local persistence, queued updates, conflict/recovery UX      |
| M10       | Collaborative history               | Local undo semantics remote update boundaries                |
| M11       | Performance                         | Rendering strategy, profiling, large-document behavior       |
| M12       | Accessibility product polish        | Keyboard workflows, focus, announcements, empty/error states |
| M13       | Portfolio packaging                 | Observability, CI/CD, architecture notes, demo case study    |

## M1 Definition of Done

- Rectangle and text shapes have explicit TypeScript types.
- Add, update, and remove commands return immutable document snapshots.
- Documents serialize to and deserialize from versioned JSON.
- Invalid JSON, shape data, duplicate IDs, and invalid command targets fail clearly.
- Focused model tests pass without a new dependency.

## M2 Definition of Done

- The editor renders rectangle and text shapes from the document model.
- Users can add, select, drag, edit text, move with the keyboard, and remove shapes.
- Users can pan with Space-drag and zoom with the mouse wheel within bounded zoom levels.
- Editor interactions update the document through immutable model commands.
- Editor and page styling uses Tailwind CSS instead of handwritten `globals.css`, as a deliberate exercise in a modern utility-first CSS framework.
- Focused editor tests and all repository quality gates pass.

## M3 Definition of Done

- Commands are recorded as history entries without mutating prior document snapshots.
- Users can undo and redo document changes.
- New changes after undo discard the redo branch.
- Undo and redo behavior has focused tests for add, update, remove, and branch invalidation.
- All repository quality gates pass.

## M4 Definition of Done

- Yjs stores the versioned document and shapes without networking.
- Existing add, update, and remove commands mutate Yjs state through a validated adapter.
- Yjs updates can be encoded, applied to another document, and converge to the same document model.
- Concurrent independent shape-field updates merge predictably.
- Focused Yjs synchronization tests and all repository quality gates pass.

## M5 Definition of Done

- A standalone WebSocket service manages in-memory rooms and relays Yjs updates.
- Clients joining a room receive its current state and updates stay isolated between rooms.
- Disconnect and reconnect behavior is covered by focused multi-client tests.
- The service exposes a health endpoint and has Railway deployment configuration.
- All repository quality gates pass.

## M6 Definition of Done

- Presence travels over the collaboration transport without entering Yjs.
- Connected peers see each other's cursors and selected shapes.
- Presence is isolated by room and removed when a client disconnects.
- Invalid presence payloads are ignored without affecting document updates.
- All repository quality gates pass.

## M8 Definition of Done

- PostgreSQL migrations create reproducible workspace and document snapshot
  tables.
- Workspace metadata and versioned Yjs snapshots load and save within
  organization and document boundaries.
- A room restores its durable snapshot before admitting clients.
- Snapshot writes are debounced and serialized to avoid excessive or
  out-of-order writes.
- Restore failures prevent room admission instead of presenting an empty
  document; write failures keep the live room available and are surfaced for
  retry or observability.
- Migration idempotency and persistence recovery behavior are covered by
  focused tests, and all repository quality gates pass.

## M9 Definition of Done

- A browser-side local store restores the latest known Yjs document and pending
  outbound updates after refresh or process restart.
- Local edits made without an open collaboration connection are queued durably
  and survive tab close.
- Reconnect syncs local state with the server, then drains pending updates only
  after the connection is ready.
- Queue entries are acknowledged or retried safely; duplicate delivery is
  harmless because Yjs updates are idempotent.
- The editor exposes connection and sync state, pending-work state, and a
  recoverable error when storage or synchronization fails.
- Focused tests cover reload recovery, offline edits, reconnect delivery,
  retries, duplicate updates, malformed stored data, and storage failures.
- All repository quality gates pass.

## M9 Implementation Plan

1. Define the offline state machine and contracts: `offline`, `connecting`,
   `syncing`, `online`, and `error`, plus a versioned local-record format.
2. Add a small browser-only persistence adapter using IndexedDB. Store one
   document record and an ordered outbound-update queue per organization and
   document; keep credentials and server metadata out of the store.
3. Refactor `CollaborationClient` so local updates are persisted before network
   delivery, queued while disconnected, and removed only after sync succeeds.
   Keep Yjs responsible for merge semantics.
4. Make reconnect two-phase: join and apply the server state, then send the
   durable queue. Do not treat reconnect as a fresh empty document.
5. Add bounded retry/backoff and explicit recovery actions for quota errors,
   corrupt records, authentication expiry, and repeated connection failure.
6. Connect the state machine to the editor UI with a pending-update count and
   non-destructive retry or reset-local-cache path.
7. Add adapter, client, and editor tests, then run all repository quality gates.

## M10 Definition of Done

- Local collaborative commands use a tracked Yjs transaction origin.
- Yjs `UndoManager` undoes and redoes only this client’s local commands.
- Remote updates are applied with a separate origin and create local history
  boundaries without overwriting unrelated peer changes.
- Single-user mode retains snapshot-based history.
- Focused collaborative history tests and all repository quality gates pass.

## M11 Definition of Done

- Shape rendering avoids rebuilding unchanged SVG visuals during toolbar,
  presence, and synchronization updates.
- Presence selection lookups use indexed access rather than repeated full-array
  scans.
- A representative large document round-trips through Yjs without data loss.
- Performance observations and remaining tradeoffs are recorded in the M11
  lesson.
- All repository quality gates pass.

## M11 Implementation Plan

1. Establish a repeatable baseline with a 1,000-shape document and browser
   profiling for presence updates, selection, dragging, and remote sync.
2. Keep shape visuals in a memoized render component so unrelated parent state
   changes preserve unchanged SVG subtrees.
3. Index document shapes by ID for collaborator selection outlines and other
   repeated lookups.
4. Compare the baseline and optimized paths, then optimize only if profiling
   identifies a remaining hotspot.
5. Document the rendering strategy, large-document behavior, and measured
   limits before running the full quality gates.
