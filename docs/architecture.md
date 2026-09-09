# Multiplayer Canvas architecture

```text
Browser (Next.js + Clerk)
  ├─ typed commands → Yjs document → SVG editor
  ├─ IndexedDB local snapshot + pending updates
  └─ authenticated WebSocket
       ↓
Collaboration server (Node + ws)
  ├─ Clerk token and organization authorization
  ├─ Yjs room relay + ephemeral presence
  └─ debounced Neon snapshot persistence
       ↓
Neon PostgreSQL
  ├─ workspaces and schema migrations
  └─ versioned document snapshots
```

The browser owns interaction responsiveness and a local Yjs replica. The
server relays encoded updates and is the persistence boundary; it does not
interpret drawing commands. Typed document validation remains at the command
boundary, while Clerk organization membership protects each room.

Important boundaries:

- Durable shapes use Yjs; cursors and selections use ephemeral presence.
- IndexedDB enables reconnect recovery without making the browser database the
  source of truth.
- Neon snapshots provide restart recovery, not per-pointer-move transactions.
- The `/health` endpoint reports service identity and process uptime without
  exposing configuration or credentials.

See the ADRs and milestone lessons for the decisions behind these boundaries.
