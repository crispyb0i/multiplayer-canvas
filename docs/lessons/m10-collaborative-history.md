# M10 lesson: collaborative history

Status: complete

## Goal

Let each collaborator undo and redo their own edits without turning another
user's work into local history or restoring an outdated whole-document
snapshot.

## Why Yjs UndoManager

The earlier history milestone stores immutable document snapshots, which is
safe for a single user. Restoring one of those snapshots in a shared document
could overwrite changes that arrived from a peer. Yjs `UndoManager` records
inverse operations instead, so undo applies this client's change to the current
shared state and preserves unrelated remote edits.

## Implementation

- Local editor commands run with a tracked `LOCAL_ORIGIN` transaction origin.
- Server and restored updates use `REMOTE_ORIGIN` and are excluded from local
  undo history.
- `createCollaborativeHistory` scopes `Y.UndoManager` to the shared shapes map
  and exposes undo, redo, and availability checks to the editor.
- Remote updates call `stopCapturing()` so local history entries cannot merge
  across a collaborator boundary.
- Single-user mode continues to use the snapshot history from M3.

## Verification

Focused tests cover:

- local undo and redo;
- remote changes excluded from local history;
- undo preserving unrelated peer changes.

Then run:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

## Interview takeaway

Collaborative undo is an origin-tracking problem. The client tracks only its
own operations, while Yjs applies inverse changes against the latest shared
state instead of replaying an old snapshot.
