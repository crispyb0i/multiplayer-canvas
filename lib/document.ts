// Bumping this later (e.g. to migrate shape fields) lets deserializeDocument
// reject or upgrade documents written by an older version instead of silently
// misreading them.
export const DOCUMENT_VERSION = 1;

export type ShapeType = "rectangle" | "text";

type ShapeGeometry = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
};

// A discriminated union (tagged by `type`) instead of one shape with optional
// fields: the compiler can prove `text` only exists on TextShape, so callers
// can't accidentally read it off a rectangle.
export type RectangleShape = ShapeGeometry & { type: "rectangle" };
export type TextShape = ShapeGeometry & { type: "text"; text: string };
export type Shape = RectangleShape | TextShape;

export type DocumentModel = { version: typeof DOCUMENT_VERSION; shapes: Shape[] };
export type ShapePatch = Partial<Pick<RectangleShape, "x" | "y" | "width" | "height" | "fill">> & {
  text?: string;
};
// Every mutation is expressed as one of these commands rather than a direct
// document edit. That makes mutations a closed, serializable set of
// operations — the shape M3's undo/redo stack and later CRDT sync will need.
export type Command =
  | { type: "add"; shape: Shape }
  | { type: "update"; id: string; changes: ShapePatch }
  | { type: "remove"; id: string };

export class DocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentValidationError";
  }
}

// Copies the shapes array and validates before returning, so callers always
// get either a fully valid document or a thrown error — never a document
// that's been partially constructed or shares array identity with the input.
export function createDocument(shapes: Shape[] = []): DocumentModel {
  const document: DocumentModel = { version: DOCUMENT_VERSION, shapes: [...shapes] };
  validateDocument(document);
  return document;
}

// applyCommand never mutates `document` in place; it builds a new array and
// routes it back through createDocument. This immutability is what lets React
// state updates in the editor detect changes by reference and lets M3's undo
// stack keep past documents around safely.
export function applyCommand(document: DocumentModel, command: Command): DocumentModel {
  validateDocument(document);
  if (command.type === "add") {
    const index = document.shapes.findIndex((shape) => shape.id === command.shape.id);
    if (index !== -1) throw new DocumentValidationError(`Shape id already exists: ${command.shape.id}`);
    return createDocument([...document.shapes, command.shape]);
  }
  const index = document.shapes.findIndex((shape) => shape.id === command.id);
  if (index === -1) throw new DocumentValidationError(`Shape id does not exist: ${command.id}`);
  if (command.type === "remove") return createDocument(document.shapes.filter((shape) => shape.id !== command.id));

  const shapes = [...document.shapes];
  shapes[index] = { ...shapes[index], ...command.changes } as Shape;
  return createDocument(shapes);
}

export function serializeDocument(document: DocumentModel): string {
  validateDocument(document);
  return JSON.stringify(document);
}

// JSON.parse returns `any`, so the result is typed `unknown` first and only
// promoted to DocumentModel once validateDocument has actually checked its
// shape — that's what keeps untrusted input (e.g. from storage or a future
// network payload) from silently becoming a false-typed document.
export function deserializeDocument(serialized: string): DocumentModel {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new DocumentValidationError("Document is not valid JSON");
  }
  validateDocument(value);
  return value;
}

// An `asserts` return type: after this call returns without throwing,
// TypeScript narrows `value` to DocumentModel at every call site, so callers
// don't need a separate type cast.
export function validateDocument(value: unknown): asserts value is DocumentModel {
  if (!isRecord(value) || value.version !== DOCUMENT_VERSION || !Array.isArray(value.shapes)) {
    throw new DocumentValidationError("Document must have version 1 and a shapes array");
  }
  const ids = new Set<string>();
  value.shapes.forEach((shape, index) => {
    validateShape(shape, `shapes[${index}]`);
    if (ids.has(shape.id)) throw new DocumentValidationError(`Duplicate shape id: ${shape.id}`);
    ids.add(shape.id);
  });
}

function validateShape(value: unknown, path: string): asserts value is Shape {
  if (!isRecord(value) || (value.type !== "rectangle" && value.type !== "text")) {
    throw new DocumentValidationError(`${path} has an unknown shape type`);
  }
  for (const key of ["id", "fill"] as const) {
    if (typeof value[key] !== "string" || value[key].length === 0) {
      throw new DocumentValidationError(`${path}.${key} must be a non-empty string`);
    }
  }
  for (const key of ["x", "y", "width", "height"] as const) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
      throw new DocumentValidationError(`${path}.${key} must be a finite number`);
    }
  }
  const { width, height } = value;
  if (typeof width !== "number" || typeof height !== "number") {
    throw new DocumentValidationError(`${path} dimensions must be numbers`);
  }
  if (width < 0 || height < 0) throw new DocumentValidationError(`${path} dimensions cannot be negative`);
  if (value.type === "text" && typeof value.text !== "string") {
    throw new DocumentValidationError(`${path}.text must be a string`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
