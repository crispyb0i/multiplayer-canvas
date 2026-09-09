# M11 lesson: performance

Status: in progress

## Goal

Keep the editor responsive as the document grows and as collaboration produces
frequent presence and synchronization updates.

## Current implementation

- Shape visuals are isolated in a memoized component, so toolbar, presence, and
  sync-status renders can reuse unchanged SVG visuals.
- Document shapes are indexed by ID for collaborator selection outlines instead
  of repeatedly scanning the full shape array.
- A 1,000-shape Yjs round-trip test protects large-document correctness.

Run `npm run profile:performance` for the repeatable document-operation
baseline. In the local baseline, 10,000 shapes took approximately 49 ms to
create, 33 ms to encode, and 23 ms to convert back to the typed model; costs
grew roughly linearly across the 1,000, 5,000, and 10,000 shape samples.

## Next profiling work

Measure a representative 1,000-shape document in the browser while adding,
dragging, moving the cursor, and receiving remote updates. Compare scripting,
rendering, and interaction latency before introducing a more complex rendering
strategy such as viewport culling or a canvas renderer.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

## Interview takeaway

Performance work starts with a measured bottleneck. Memoized SVG visuals and
indexed lookups are small, explainable optimizations; a renderer replacement is
justified only if profiling shows they are insufficient.
