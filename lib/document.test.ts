import { describe, expect, it } from "vitest";
import { applyCommand, createDocument, deserializeDocument, DocumentValidationError, serializeDocument, type RectangleShape } from "./document";

const rectangle: RectangleShape = { id: "box-1", type: "rectangle", x: 10, y: 20, width: 120, height: 80, fill: "#2563eb" };

describe("document model", () => {
  it("applies immutable add, update, and remove commands", () => {
    const empty = createDocument();
    const withShape = applyCommand(empty, { type: "add", shape: rectangle });
    const moved = applyCommand(withShape, { type: "update", id: rectangle.id, changes: { x: 40 } });
    const removed = applyCommand(moved, { type: "remove", id: rectangle.id });
    expect(empty.shapes).toEqual([]);
    expect(moved.shapes[0]).toMatchObject({ id: rectangle.id, x: 40 });
    expect(removed.shapes).toEqual([]);
  });

  it("round-trips a document as versioned JSON", () => {
    const document = createDocument([rectangle]);
    expect(deserializeDocument(serializeDocument(document))).toEqual(document);
  });

  it("rejects malformed or unsafe data", () => {
    expect(() => deserializeDocument("not json")).toThrow(DocumentValidationError);
    expect(() => deserializeDocument(JSON.stringify({ version: 1, shapes: [{ ...rectangle, width: -1 }] }))).toThrow(/dimensions cannot be negative/);
    expect(() => createDocument([rectangle, rectangle])).toThrow(/Duplicate shape id/);
  });

  it("rejects missing and duplicate command targets", () => {
    const document = createDocument([rectangle]);
    expect(() => applyCommand(document, { type: "add", shape: rectangle })).toThrow(/already exists/);
    expect(() => applyCommand(document, { type: "remove", id: "missing" })).toThrow(/does not exist/);
  });
});
