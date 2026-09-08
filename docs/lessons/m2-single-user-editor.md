# M2 lesson: single-user editor

## Goal

Turn the framework-independent M1 document model into a small, usable local editor.

## What to study

- Why interactive browser state belongs in a client component while the document model stays framework-independent.
- How pointer coordinates are converted between screen space and document space under pan and zoom.
- Why selection is editor state rather than persisted document data.
- How keyboard commands and pointer gestures share the immutable document command boundary.
- Why native SVG is a useful learning-stage renderer before introducing a canvas library.

## Verification evidence

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
