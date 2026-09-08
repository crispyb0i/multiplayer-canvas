# M4 lesson: Yjs without networking

## Goal

Introduce a CRDT-backed document state while keeping synchronization framework- and transport-independent.

## What to study

- [CRDT notes](../crdt-notes.md) — reference on the merge algebra, observed-remove
  sets, and how Yjs applies them.
- Why a Y.Map keyed by stable shape IDs supports field-level concurrent updates.
- Why commands remain the validation boundary even after state becomes mutable internally.
- Why encoded Yjs updates are the seam that a later WebSocket provider can transport.
- Why deterministic conversion back to the existing array model keeps the renderer simple.

## Implementation

- Added a Yjs document adapter for the existing versioned document model.
- Kept shape mutations at the command boundary and applied only the minimal Yjs change.
- Added in-process tests for command application, validation, update exchange, convergence, and concurrent field merges.
- Deliberately deferred WebSockets, presence, persistence, and collaborative history to later milestones.

## Interview takeaway

“The renderer still consumes the stable `DocumentModel`; the Yjs adapter owns shared mutable state, and encoded updates are the transport-neutral synchronization boundary.”
