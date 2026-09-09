# Case study: Multiplayer Canvas

## Problem

Technical diagramming becomes difficult when several people edit at once,
lose connectivity, or need to understand who can access a workspace. The
project needed a small but credible foundation that made those tradeoffs
visible rather than hiding them behind a large editor framework.

## Solution

Multiplayer Canvas uses a typed immutable document model at the product
boundary and Yjs for convergent shared state. A small WebSocket service relays
updates, Clerk supplies organization authorization, IndexedDB queues offline
work, and Neon stores restart-safe snapshots. The UI keeps SVG rendering
simple while memoization and indexed shape lookup protect the 1,000-shape
benchmark.

## Results

Live demo: https://multiplayer-canvas-orpin.vercel.app

- 1,000 seeded rectangles restore as a real persisted Yjs snapshot.
- Two authenticated clients connect to the same organization room.
- Selection presence crosses clients without entering document history.
- Offline updates queue locally and drain after reconnect.
- Keyboard shape selection, announcements, empty states, and recovery UI are
  part of the editor interaction model.
- CI runs tests, typecheck, lint, formatting, and production build checks.

## What I would improve next

I would add a timed browser trace to separate network startup from restore and
drag scripting, then use that evidence to decide whether viewport culling is
needed. Production deployment would also add centralized logs, metrics, and
alerting around WebSocket reconnects and snapshot failures.

## Technical lesson

The most useful architecture is the one that keeps responsibilities legible:
commands validate intent, Yjs merges state, the server authenticates and
persists, and the UI explains current state to every kind of user.
