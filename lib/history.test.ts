import { describe, expect, it } from "vitest";
import { applyCommand, type RectangleShape } from "./document";
import {
  canRedo,
  canUndo,
  createHistory,
  executeCommand,
  redo,
  undo,
  updateLastEntryAfter,
} from "./history";

const rectangle: RectangleShape = {
  id: "box-1",
  type: "rectangle",
  x: 10,
  y: 20,
  width: 120,
  height: 80,
  fill: "#2563eb",
};

describe("document history", () => {
  it("undoes and redoes add, update, and remove commands", () => {
    const initial = createHistory();
    const added = executeCommand(initial, { type: "add", shape: rectangle });
    const updated = executeCommand(added, {
      type: "update",
      id: rectangle.id,
      changes: { x: 40 },
    });
    const removed = executeCommand(updated, {
      type: "remove",
      id: rectangle.id,
    });

    expect(removed.document.shapes).toEqual([]);
    expect(undo(removed).document.shapes[0]).toMatchObject({
      id: rectangle.id,
      x: 40,
    });
    expect(undo(updated).document.shapes[0]).toEqual(rectangle);
    expect(redo(undo(updated)).document.shapes[0]).toMatchObject({ x: 40 });
  });

  it("keeps snapshots independent and clears redo after a new command", () => {
    const added = executeCommand(createHistory(), {
      type: "add",
      shape: rectangle,
    });
    const moved = executeCommand(added, {
      type: "update",
      id: rectangle.id,
      changes: { x: 50 },
    });
    const undone = undo(moved);
    const branched = executeCommand(undone, {
      type: "update",
      id: rectangle.id,
      changes: { y: 70 },
    });

    expect(moved.document).not.toBe(added.document);
    expect(moved.document.shapes[0]).not.toBe(added.document.shapes[0]);
    expect(canUndo(branched)).toBe(true);
    expect(canRedo(branched)).toBe(false);
    expect(redo(branched)).toBe(branched);
  });

  it("leaves empty history unchanged", () => {
    const history = createHistory();
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it("coalesces repeated drag updates into one undo entry", () => {
    const added = executeCommand(createHistory(), {
      type: "add",
      shape: rectangle,
    });
    const firstMove = executeCommand(added, {
      type: "update",
      id: rectangle.id,
      changes: { x: 20 },
    });
    const finalDocument = applyCommand(firstMove.document, {
      type: "update",
      id: rectangle.id,
      changes: { x: 40 },
    });
    const coalesced = updateLastEntryAfter(firstMove, finalDocument);

    expect(coalesced.past).toHaveLength(2);
    expect(coalesced.past.at(-1)?.before.shapes[0]).toEqual(rectangle);
    expect(coalesced.document.shapes[0]).toMatchObject({ x: 40 });
  });
});
