# M6 lesson: presence

## Goal

Show active collaborators without storing transient cursor and selection state in the shared document.

## Concepts

- Awareness is separate from durable CRDT document state.
- Disconnect cleanup prevents ghost collaborators.
- Room isolation applies to ephemeral state as well as document updates.

## Implementation

- Added validated JSON presence messages to the WebSocket room hub.
- Added client-side tracking for remote cursors and selected-shape outlines.
- Kept presence out of Yjs, document history, and persistence boundaries.

## Verification

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
