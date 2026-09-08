# Multiplayer Canvas curriculum

This project is built as a sequence of lessons. Each milestone should leave the app runnable, tested, and explainable in an interview. The active milestone is **M3**.

## Milestones

| Milestone | Lesson | Main outcome |
| --- | --- | --- |
| M0 | Repository and engineering baseline | Next.js app, quality gates, CI, project conventions |
| M1 | Local document model | Typed shapes, commands, serialization, validation |
| M2 | Single-user editor | Canvas interactions, selection, pan/zoom, keyboard input |
| M3 | History and undo/redo | Command history with focused tests |
| M4 | Yjs without networking | CRDT document model synced-state tests in one process |
| M5 | WebSocket collaboration | Room transport, reconnect behavior, multi-client tests |
| M6 | Presence | Cursors, selections, awareness, ephemeral state |
| M7 | Authentication and authorization | Users, sessions, workspace membership, permission boundaries |
| M8 | Neon persistence | PostgreSQL metadata, snapshots, migrations, recovery path |
| M9 | Offline and reconnect sync | Local persistence, queued updates, conflict/recovery UX |
| M10 | Collaborative history | Local undo semantics remote update boundaries |
| M11 | Performance | Rendering strategy, profiling, large-document behavior |
| M12 | Accessibility product polish | Keyboard workflows, focus, announcements, empty/error states |
| M13 | Portfolio packaging | Observability, CI/CD, architecture notes, demo case study |

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
