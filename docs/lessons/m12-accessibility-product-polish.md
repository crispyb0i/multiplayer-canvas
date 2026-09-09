# M12 lesson: accessibility product polish

## Goal

Make the editor understandable and operable for keyboard and assistive
technology users, including empty and collaboration-error states.

## Implementation

- Shapes expose keyboard focus, an accessible label, and pressed state.
- Enter and Space select a focused shape.
- Selection changes are announced through an assertive live region.
- Empty documents explain how to add the first shape inside the canvas.
- Existing collaboration status and recovery controls remain exposed as live,
  actionable UI.

## Tradeoff

The SVG remains an application-level keyboard surface for pan, zoom, movement,
undo, redo, and deletion. Individual shapes additionally become focused
controls, so keyboard users can reach a specific object without requiring a
pointer coordinate or a renderer replacement.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

## Interview takeaway

Accessibility is part of the interaction model, not a final styling pass:
focusable objects, explicit state, and announcements make the same document
operations usable across input modalities.
