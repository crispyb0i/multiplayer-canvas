# Multiplayer Canvas

Multiplayer Canvas is a learning-first portfolio project: a real-time collaborative technical diagramming workspace designed to demonstrate senior frontend engineering decisions.

## Current milestone: M0

M0 is the repository and engineering baseline. It intentionally contains only a minimal Next.js App Router page, TypeScript, a smoke test, linting, type checking, production build, and CI.

```bash
npm install
npm run dev
```

Quality gates:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

See [`docs/project-plan.md`](docs/project-plan.md) for the curriculum and [`AGENTS.md`](AGENTS.md) for the implementation contract.

## Baseline map

- `app/` — the Next.js App Router entry point and the intentionally tiny M0 page.
- `test/` — shared Vitest setup; colocated `*.test.tsx` files test behavior near the code.
- `docs/` — the milestone curriculum, architecture decisions, and future lesson notes.
- `.github/workflows/` — the CI quality gate run on pushes to `main` and pull requests.
- Root configuration — package scripts, TypeScript, ESLint, Vitest, and Next.js configuration.

## Dependency boundary

Installed for M0: Next.js, React, and React DOM for the app; TypeScript and React/Node types for
static safety; ESLint for code quality; Vitest, JSDOM, and Testing Library for the smoke test.

Intentionally deferred: Yjs and WebSockets (M4–M5), Neon/PostgreSQL and its ORM (M8), auth (M7),
and canvas/editor libraries (M1–M2). Redis, object storage, monitoring, Storybook, and deployment
tooling are also deferred until a milestone gives each one a concrete job.
