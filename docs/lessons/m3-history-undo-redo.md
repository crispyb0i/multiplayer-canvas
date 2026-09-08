# M3 lesson: history and undo/redo

## Goal

Give the editor a predictable local timeline for document changes while keeping
the document model immutable and framework-independent.

## What to study

- Why undo/redo belongs around the existing command boundary instead of inside
  individual UI handlers.
- How a `past` stack and a `future` stack model a linear editing timeline.
- Why a new command after undo invalidates the redo branch.
- Why storing complete before/after snapshots makes remove operations lossless
  and avoids writing fragile inverse-command logic.
- Why history snapshots must clone shape objects, not only the shapes array.
- Why selection, pan, and zoom are transient UI state rather than document
  history.
- Why the history module is framework-independent and can be tested without
  rendering React.

## Implementation

- Added `HistoryState` with the current document, past entries, and future
  entries.
- Added `executeCommand`, `undo`, `redo`, `canUndo`, and `canRedo`.
- Recorded each successful add, update, and remove command with its before and
  after document snapshots.
- Routed editor mutations through the history state.
- Added Undo and Redo buttons plus `Cmd/Ctrl+Z` and
  `Cmd/Ctrl+Shift+Z` keyboard shortcuts.
- Reconciled selection after history navigation so removed shapes cannot remain
  selected.

## Verification evidence

The following commands pass:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Focused history tests cover add, update, remove, undo, redo, immutable
snapshots, empty history, and redo-branch invalidation.

## Interview takeaways

- “The editor emits typed commands; history owns timeline semantics; the
  renderer only displays the current document.”
- “Undo stores complete snapshots for correctness and simplicity at this
  stage. That is appropriate for a small local document, but memory usage and
  collaborative semantics are future tradeoffs.”
- “A branch is invalidated when a new edit follows undo, matching the common
  linear-editor model.”
