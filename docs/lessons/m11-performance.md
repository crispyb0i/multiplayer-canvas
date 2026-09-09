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
