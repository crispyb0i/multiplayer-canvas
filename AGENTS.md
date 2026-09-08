# Multiplayer Canvas: agent guide

This is a learning-first portfolio project. Work in curriculum milestones and stop after the requested milestone's Definition of Done. Explain meaningful code with comments that teach the concept and tradeoff; do not add comments that merely narrate syntax.

## Working rules

- Read `docs/project-plan.md` before making changes and identify the active milestone.
- Keep changes within the active milestone unless the user explicitly expands scope.
- Prefer small, named modules over premature abstractions.
- Do not add a dependency until the milestone has a concrete reason for it.
- Never place secrets in source, logs, documentation, or commits.
- Before reporting completion, run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## Comments for learning

- Every non-trivial function or block gets a short comment on _why_ it exists or _why_ it's written that way — the concept it demonstrates, the tradeoff it makes, or the bug it avoids. Skip comments where the code is self-explanatory from naming.
- Prefer explaining: invariants (e.g. why documents are immutable), algorithmic choices (e.g. why validation runs before every mutation), and React/browser mechanics that aren't obvious from the API name (e.g. why pointer capture is used, why space-drag panning needs a ref instead of state).
- Do not write comments that just restate the line below it (e.g. `// increment i` above `i++`).
- When touching a file for a milestone, add or update teaching comments for the code you changed; you don't need to backfill the whole file unless asked.

## M0 boundary

M0 establishes repository hygiene, a minimal Next.js + TypeScript app, quality gates, and CI. Do not add Yjs, Neon/PostgreSQL, authentication, WebSockets, or canvas/editor behavior in M0.
