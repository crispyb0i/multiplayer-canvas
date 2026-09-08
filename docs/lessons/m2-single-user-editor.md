# M2 lesson: single-user editor

## Goal

Build a usable single-user editor on top of the M1 document model while keeping transient interaction state separate from persisted shapes.

## Concepts

- How screen-space coordinates convert to document-space coordinates under pan and zoom.
- Why selection belongs to editor state rather than the persisted document.
- How pointer gestures and keyboard commands share the immutable document command boundary.
- Why pointer capture keeps dragging reliable when the pointer leaves the shape.
- Why native SVG is an appropriate learning-stage renderer before adding a canvas library.

## Implementation

- Rendered rectangle and text shapes from the document model.
- Added shape creation, selection, dragging, text editing, keyboard movement, and removal.
- Added Space-drag panning and zoom-aware coordinate conversion.
- Styled the editor with Tailwind CSS.
- Added focused editor tests for rendering and core interactions.

## Verification

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Interview takeaway

The editor translates browser interactions into typed document commands. Rendering and transient navigation state stay separate from the durable document model.
