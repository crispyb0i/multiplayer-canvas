# M4 lesson: Yjs without networking

## Goal

Introduce CRDT-backed document state while keeping synchronization independent from the editor framework and transport layer.

## Concepts

- Why a `Y.Map` keyed by stable shape IDs supports field-level concurrent updates.
- Why commands remain the validation boundary even though Yjs state is mutable internally.
- Why encoded Yjs updates are the seam a later WebSocket provider can transport.
- Why deterministic conversion back to the existing array model keeps the renderer simple.
- See the [CRDT notes](../crdt-notes.md) for merge algebra and Yjs implementation details.

## Implementation

- Added a Yjs adapter for the existing versioned document model.
- Kept shape mutations at the command boundary and applied only the minimal Yjs change.
- Added in-process tests for command application, validation, update exchange, convergence, and concurrent field merges.
- Deliberately deferred WebSockets, presence, persistence, and collaborative history to later milestones.

## Verification

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Interview takeaway

The renderer still consumes the stable `DocumentModel`; the Yjs adapter owns shared mutable state, and encoded updates provide a transport-neutral synchronization boundary.
