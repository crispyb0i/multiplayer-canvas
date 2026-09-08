# M3 lesson: history and undo/redo

## Goal

Give the editor a predictable local timeline for document changes while keeping the document model immutable and framework-independent.

## Concepts

- Why undo and redo belong around the existing command boundary instead of inside individual UI handlers.
- How separate `past` and `future` stacks model a linear editing timeline.
- Why a new command after undo invalidates the redo branch.
- Why complete before-and-after snapshots make remove operations lossless without fragile inverse-command logic.
- Why history snapshots must clone shape objects, not only the shapes array.
- Why selection, pan, and zoom are transient UI state rather than document history.

## Implementation

- Added `HistoryState` with the current document, past entries, and future entries.
- Added `executeCommand`, `undo`, `redo`, `canUndo`, and `canRedo`.
- Recorded successful add, update, and remove commands with immutable before-and-after snapshots.
- Routed editor mutations through the history state.
- Added Undo and Redo buttons plus `Cmd/Ctrl+Z` and `Cmd/Ctrl+Shift+Z` shortcuts.
- Reconciled selection after history navigation so removed shapes cannot remain selected.

## Verification

Focused history tests cover add, update, remove, undo, redo, immutable snapshots, empty history, and redo-branch invalidation.

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Interview takeaway

The editor emits typed commands, history owns timeline semantics, and the renderer displays the current document. Snapshot history favors correctness and simplicity at this project’s scale; collaborative history is deliberately deferred.
