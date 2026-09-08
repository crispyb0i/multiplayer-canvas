# Multiplayer Canvas curriculum

This project is built as a sequence of lessons. Each milestone should leave the app runnable, tested, and explainable in an interview. The active milestone is **M0**.

## Milestones

| Milestone | Lesson | Main outcome |
| --- | --- | --- |
| M0 | Repository and engineering baseline | Next.js app, quality gates, CI, project conventions |
| M1 | Local document model | Typed shapes, commands, serialization, validation |
| M2 | Single-user editor | Canvas interactions, selection, pan/zoom, keyboard input |
| M3 | History and undo/redo | Command history with focused tests |
| M4 | Yjs without networking | CRDT document model and synced-state tests in one process |
| M5 | WebSocket collaboration | Room transport, reconnect behavior, multi-client tests |
| M6 | Presence | Cursors, selections, awareness, ephemeral state |
| M7 | Authentication and authorization | Users, sessions, workspace membership, permission boundaries |
| M8 | Neon persistence | PostgreSQL metadata, snapshots, migrations, recovery path |
| M9 | Offline and reconnect sync | Local persistence, queued updates, conflict/recovery UX |
| M10 | Collaborative history | Local undo semantics and remote update boundaries |
| M11 | Performance | Rendering strategy, profiling, large-document behavior |
| M12 | Accessibility and product polish | Keyboard workflows, focus, announcements, empty/error states |
| M13 | Portfolio packaging | Observability, CI/CD, architecture notes, demo and case study |

## M0 Definition of Done

- Git repository initialized with a clean, reproducible install.
- Minimal Next.js + TypeScript app runs and builds.
- `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- README, agent guide, milestone plan, ADR and lesson locations, and CI baseline exist.
- No Yjs, Neon/PostgreSQL, auth, WebSockets, or canvas editor dependencies or behavior.

## How to ask what is next

Ask the agent to read this file, report the active milestone and its Definition of Done, then propose the smallest lesson-sized change. The agent should wait for approval before moving to a new milestone.
