# M13 lesson: portfolio packaging

## Goal

Make the project inspectable as a portfolio artifact: explain the architecture,
show the engineering tradeoffs, and expose a safe deployment health signal.

## Implementation

- Added an architecture overview covering browser, WebSocket, Clerk, Yjs,
  IndexedDB, and Neon boundaries.
- Added a case study describing the problem, solution, verified outcomes, and
  honest next improvements.
- Extended the collaboration `/health` response with service identity and
  process uptime; it does not expose secrets or environment values.
- Existing GitHub Actions CI runs the complete quality gate and production
  build on pushes and pull requests.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
curl http://localhost:8080/health
```

## Interview takeaway

Portfolio packaging is part of engineering communication: a reviewer should
be able to see the system boundaries, reproduce the quality gates, and tell
which claims are measured versus planned.
