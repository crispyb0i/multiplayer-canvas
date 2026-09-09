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

## Browser measurements

Measured against the seeded `demo` room with 1,000 rectangles in a signed-in
`David Org` workspace on the local development server:

| Operation                          | Observed result                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Snapshot restore after page reload | 1,001 SVG rectangles visible in 5.16 s; this includes page/authentication and collaboration startup, not just Yjs decoding |
| Collaboration connection           | `connected`                                                                                                                |
| Select a rectangle                 | `Selected: rectangle` in 301 ms through the browser interaction                                                            |

The rectangle count includes the editor background, so the document contains
the expected 1,000 seeded shapes. Drag and multi-client presence latency were
not isolated in this run; they need a two-client trace before becoming a
performance claim.

Cross-client presence was verified qualitatively: after Guest selected a
rectangle, a fresh observation client remained `Nothing selected` but rendered
1,002 SVG groups, versus the 1,001 baseline. The extra group is the remote
presence indicator. Dragging was also manually confirmed to complete without
the missing-shape crash; exact interaction latency was not isolated.

## Next profiling work

Capture a two-client browser trace while dragging, moving the cursor, and
receiving remote updates. Separate authentication/network startup from Yjs
restore and interaction scripting before considering viewport culling or a
canvas renderer.

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
