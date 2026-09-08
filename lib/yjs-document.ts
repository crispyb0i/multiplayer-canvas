import * as Y from "yjs";
import {
  applyCommand,
  createDocument,
  type Command,
  type DocumentModel,
  type Shape,
} from "./document";

const ROOT_KEY = "document";
const VERSION_KEY = "version";
const SHAPES_KEY = "shapes";

type YShape = Y.Map<unknown>;

// Y.Map gives each shape a stable identity while allowing independent fields
// to merge. Sorting at the adapter boundary makes the array model deterministic
// even when two peers add shapes concurrently in different local orders.
export function createYDocument(
  document: DocumentModel = createDocument(),
): Y.Doc {
  const ydoc = new Y.Doc();
  const root = getRoot(ydoc);
  ydoc.transact(() => {
    root.set(VERSION_KEY, document.version);
    const shapes = getShapes(ydoc);
    for (const shape of document.shapes)
      shapes.set(shape.id, shapeToYMap(shape));
  });
  return ydoc;
}

// Conversion validates Yjs data at the trust boundary. This protects the
// typed editor from malformed persisted or network-delivered CRDT updates.
export function yDocumentToDocument(ydoc: Y.Doc): DocumentModel {
  const shapes = getShapes(ydoc);

  const plainShapes = Array.from(shapes.values())
    .map((shape) => yMapToShape(shape))
    .sort((left, right) => left.id.localeCompare(right.id));
  return createDocument(plainShapes);
}

// Validate through applyCommand first, then perform the minimal Yjs mutation.
// This preserves the existing command contract without replacing the whole
// shared map, which would discard CRDT field-level merge behavior.
export function executeYjsCommand(
  ydoc: Y.Doc,
  command: Command,
): DocumentModel {
  const before = yDocumentToDocument(ydoc);
  applyCommand(before, command);
  const shapes = getShapes(ydoc);

  ydoc.transact(() => {
    if (command.type === "add") {
      shapes.set(command.shape.id, shapeToYMap(command.shape));
    } else if (command.type === "remove") {
      shapes.delete(command.id);
    } else {
      const shape = shapes.get(command.id);
      if (!shape) throw new Error(`Shape id does not exist: ${command.id}`);
      for (const [key, value] of Object.entries(command.changes)) {
        shape.set(key, value);
      }
    }
  });

  return yDocumentToDocument(ydoc);
}

export function encodeYjsState(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc);
}

// Applying updates is intentionally separate from command execution: in M5 a
// transport can carry these bytes, while this milestone tests the sync core in
// one process without introducing a networking abstraction prematurely.
export function applyYjsUpdate(ydoc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(ydoc, update);
}

function getRoot(ydoc: Y.Doc): Y.Map<unknown> {
  return ydoc.getMap(ROOT_KEY);
}

function getShapes(ydoc: Y.Doc): Y.Map<YShape> {
  // A top-level shared type has one stable identity per Y.Doc. Keeping it out
  // of the initialized metadata map avoids competing nested-map roots when
  // two fresh peers exchange their first update.
  return ydoc.getMap<YShape>(SHAPES_KEY);
}

function shapeToYMap(shape: Shape): YShape {
  const result = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(shape)) result.set(key, value);
  return result;
}

function yMapToShape(shape: YShape): Shape {
  return Object.fromEntries(shape.entries()) as Shape;
}
