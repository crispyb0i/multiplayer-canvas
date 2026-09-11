# Multiplayer Canvas

A real-time diagramming prototype built with Next.js, TypeScript, SVG, and Yjs.
Create and move shapes, edit labels, undo your changes, and collaborate inside
an authenticated workspace with live presence and offline update queuing.

**[Live demo](https://multiplayer-canvas-orpin.vercel.app)** ·
[Architecture](docs/architecture.md) · [Case study](docs/case-study.md) ·
[Readiness audit](docs/portfolio-audit.md)

The live deployment may lag this checkout. No account is needed to try the local
editor. Shared workspaces require Clerk organization membership.

## Run locally

Use Node.js 22 (matching CI) and npm:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Without service configuration, the app runs as a
single-user demo. **Local-demo drawings last until reload.** The app does not
need a database, account, or paid API call for this mode.

If your machine already has service configuration, explicitly disable it for
an isolated demo:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='' NEXT_PUBLIC_COLLAB_URL='' CLERK_SECRET_KEY='' npm run dev
```

## Two-minute demo

1. Add a rectangle and drag it. Add text and edit its label in the text field.
2. Tab to a shape and press Enter to select it. Use arrow keys to move it;
   hold Shift for larger steps. Delete removes it.
3. Undo/redo with the toolbar or Ctrl/⌘ Z and Ctrl/⌘ Shift Z on the canvas.
4. Space-drag or middle-drag to pan. Scroll over the canvas to zoom around the
   pointer. Reset view restores the original viewport.
5. To demonstrate collaboration, use two signed-in sessions in the same Clerk
   organization. Edit, observe selection presence, disconnect one client, then
   reconnect and inspect its pending-update count. Use a disposable test
   workspace; the authenticated mode writes shared data.

## Optional collaboration services

The browser and WebSocket service are separate processes. Configure these
variable names through your local environment or deployment secret manager:

| Variable                            | Purpose                                                  |
| ----------------------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Enables Clerk's browser UI                               |
| `CLERK_SECRET_KEY`                  | Verifies server-side sessions/tokens                     |
| `NEXT_PUBLIC_COLLAB_URL`            | WebSocket endpoint; use `wss://` for HTTPS deployments   |
| `DATABASE_URL`                      | Neon PostgreSQL connection for the collaboration service |
| `PORT`                              | Collaboration HTTP/WebSocket port, default 8080          |

Enable Clerk Organizations and use an active organization with an admin or
member role. On your own disposable database, run `npm run db:migrate`, then
start `npm run collab:start` alongside `npm run dev`. The collaboration process
exposes `/health` for process liveness; it does not verify database readiness.
Do not put credentials into source, issue reports, or screenshots.

Use one collaboration-server instance. Acknowledgements currently confirm
in-memory acceptance, **not a committed database write**. See the audit for
crash recovery, authorization lifetime, schema validation, and multi-tab offline
limitations before using this for important data.

## Engineering decisions

- Typed immutable commands define the editor's document boundary.
- Yjs merges shared fields and tracks local collaborative undo origins.
- SVG keeps the rendering model inspectable; memoized visuals reduce redundant
  reconciliation without introducing a rendering framework.
- IndexedDB queues outbound updates; WebSockets carry deltas and ephemeral
  presence; Neon stores debounced snapshots.
- Tests isolate transport and persistence so failure paths run without services.

## Quality gates

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm audit --omit=dev
npm run profile:performance
```

Run build/typecheck sequentially while the dev server is stopped, since Next.js
regenerates `.next/types`. CI runs tests, typecheck, lint, formatting, and build.
The performance script measures document operations, not browser frame rates.
`package.json` overrides Next's PostCSS and Sharp versions for published security
fixes; remove these overrides when the framework includes compatible fixes.

## Project notes

Current milestone: **M13 — portfolio audit and demo hardening**.
[Milestone lessons](docs/lessons/README.md), [ADRs](docs/adr/README.md), and the
[project plan](docs/project-plan.md) explain the learning sequence and tradeoffs.
[AGENTS.md](AGENTS.md) defines the contribution and verification contract.
