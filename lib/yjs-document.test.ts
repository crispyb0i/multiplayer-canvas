import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyYjsUpdate,
  createYDocument,
  encodeYjsState,
  executeYjsCommand,
  yDocumentToDocument,
} from "./yjs-document";
import { createDocument, type RectangleShape } from "./document";

const rectangle: RectangleShape = {
  id: "box-1",
  type: "rectangle",
  x: 10,
  y: 20,
  width: 120,
  height: 80,
  fill: "#2563eb",
};

describe("Yjs document adapter", () => {
  it("applies existing commands to shared state", () => {
    const ydoc = createYDocument();

    executeYjsCommand(ydoc, { type: "add", shape: rectangle });
    executeYjsCommand(ydoc, {
      type: "update",
      id: rectangle.id,
      changes: { x: 40 },
    });
    executeYjsCommand(ydoc, { type: "remove", id: rectangle.id });

    expect(yDocumentToDocument(ydoc)).toEqual(createDocument());
  });

  it("rejects invalid commands before mutating the Yjs document", () => {
    const ydoc = createYDocument(createDocument([rectangle]));

    expect(() =>
      executeYjsCommand(ydoc, { type: "add", shape: rectangle }),
    ).toThrow(/already exists/);
    expect(yDocumentToDocument(ydoc).shapes).toEqual([rectangle]);
  });

  it("converges two documents by exchanging encoded updates", () => {
    const first = createYDocument();
    const second = createYDocument();

    executeYjsCommand(first, { type: "add", shape: rectangle });
    applyYjsUpdate(second, encodeYjsState(first));

    executeYjsCommand(second, {
      type: "update",
      id: rectangle.id,
      changes: { x: 90 },
    });
    applyYjsUpdate(first, encodeYjsState(second));

    expect(yDocumentToDocument(first)).toEqual(yDocumentToDocument(second));
    expect(yDocumentToDocument(first).shapes[0]).toMatchObject({ x: 90 });
  });

  it("merges independent concurrent field changes", () => {
    const first = createYDocument(createDocument([rectangle]));
    const second = new Y.Doc();
    applyYjsUpdate(second, encodeYjsState(first));

    executeYjsCommand(first, {
      type: "update",
      id: rectangle.id,
      changes: { x: 50 },
    });
    executeYjsCommand(second, {
      type: "update",
      id: rectangle.id,
      changes: { y: 70 },
    });
    applyYjsUpdate(first, encodeYjsState(second));
    applyYjsUpdate(second, encodeYjsState(first));

    expect(yDocumentToDocument(first).shapes[0]).toMatchObject({
      x: 50,
      y: 70,
    });
    expect(yDocumentToDocument(first)).toEqual(yDocumentToDocument(second));
  });

  it("round-trips a large document without losing shapes", () => {
    const shapes = Array.from({ length: 1000 }, (_, index) => ({
      ...rectangle,
      id: `shape-${index}`,
      x: index % 50,
      y: Math.floor(index / 50),
    }));
    const source = createYDocument(createDocument(shapes));
    const restored = createYDocument();

    applyYjsUpdate(restored, encodeYjsState(source));

    expect(yDocumentToDocument(restored).shapes).toHaveLength(1000);
  });
});
