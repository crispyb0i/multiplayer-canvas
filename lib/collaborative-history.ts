import * as Y from "yjs";
import { LOCAL_ORIGIN } from "./yjs-document";

export type CollaborativeHistory = {
  undoManager: Y.UndoManager;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  remoteUpdateBoundary(): void;
};

// Tracking only local origins prevents a peer's edits from becoming undoable
// here. Yjs then computes inverse operations against the current shared state,
// preserving unrelated remote changes instead of restoring an old snapshot.
export function createCollaborativeHistory(ydoc: Y.Doc): CollaborativeHistory {
  const undoManager = new Y.UndoManager(ydoc.getMap("shapes"), {
    trackedOrigins: new Set([LOCAL_ORIGIN]),
    captureTimeout: 0,
  });

  return {
    undoManager,
    undo: () => undoManager.undo(),
    redo: () => undoManager.redo(),
    canUndo: () => undoManager.canUndo(),
    canRedo: () => undoManager.canRedo(),
    // Remote transactions use a separate origin and are untracked; stopping
    // capture also prevents adjacent local edits crossing that boundary.
    remoteUpdateBoundary: () => undoManager.stopCapturing(),
  };
}
