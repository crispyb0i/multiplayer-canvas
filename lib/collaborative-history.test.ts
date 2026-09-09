import { describe, expect, it } from "vitest";
import { createCollaborativeHistory } from "./collaborative-history";
import {
  applyYjsUpdate,
  createYDocument,
  encodeYjsState,
  executeYjsCommand,
  REMOTE_ORIGIN,
  yDocumentToDocument,
} from "./yjs-document";
import type { RectangleShape } from "./document";

const shape = (id: string, x: number): RectangleShape => ({
  type: "rectangle",
  id,
  x,
  y: 20,
  width: 120,
  height: 80,
  fill: "#fff",
});

describe("collaborative history", () => {
  it("tracks local commands and supports undo/redo", () => {
    const document = createYDocument();
    const history = createCollaborativeHistory(document);

    executeYjsCommand(document, { type: "add", shape: shape("local", 10) });
    expect(history.canUndo()).toBe(true);

    history.undo();
    expect(yDocumentToDocument(document).shapes).toEqual([]);
    expect(history.canRedo()).toBe(true);

    history.redo();
    expect(yDocumentToDocument(document).shapes).toEqual([shape("local", 10)]);
  });

  it("does not undo remote changes or overwrite unrelated peers", () => {
    const document = createYDocument();
    const history = createCollaborativeHistory(document);
    const peer = createYDocument();

    executeYjsCommand(document, { type: "add", shape: shape("first", 10) });
    executeYjsCommand(peer, { type: "add", shape: shape("remote", 100) });
    applyYjsUpdate(document, encodeYjsState(peer), REMOTE_ORIGIN);
    history.remoteUpdateBoundary();
    executeYjsCommand(document, { type: "add", shape: shape("second", 200) });

    history.undo();

    expect(yDocumentToDocument(document).shapes).toEqual([
      shape("first", 10),
      shape("remote", 100),
    ]);
    expect(history.canUndo()).toBe(true);
  });
});
