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

<!-- graft:start -->

## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->
