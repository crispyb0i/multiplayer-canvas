# M5 lesson: WebSocket collaboration

## Goal

Connect separate clients to shared Yjs room state through a standalone WebSocket service while keeping the transport small and testable.

## Concepts

- Why a room hub should own membership and transport while Yjs owns document merge semantics.
- Why a reconnecting client needs the room’s current encoded state before receiving new updates.
- Why room isolation is a correctness and security boundary even before authentication exists.
- Why the WebSocket process is hosted separately from the Vercel frontend.
- Why process-local room state is acceptable for this milestone but not a persistence strategy.

## Implementation

- Added a transport-neutral room hub that stores one Yjs document per room.
- Added a Node WebSocket server with binary Yjs update relaying and a `/health` endpoint.
- Added Railway start configuration for the long-lived collaboration service.
- Added multi-client tests for same-room relaying, reconnect recovery, and room isolation.
- Deliberately deferred presence, authentication, persistence, and collaborative history.

## Verification

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Interview takeaway

The Vercel app remains the frontend, while Railway runs a small stateful WebSocket process. The server does not interpret diagram commands; it relays Yjs updates and lets the CRDT layer guarantee convergence.
