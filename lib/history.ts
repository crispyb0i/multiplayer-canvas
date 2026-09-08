import {
  applyCommand,
  createDocument,
  type Command,
  type DocumentModel,
} from "./document";

export type HistoryEntry = {
  command: Command;
  before: DocumentModel;
  after: DocumentModel;
};

export type HistoryState = {
  document: DocumentModel;
  past: HistoryEntry[];
  future: HistoryEntry[];
};

// History owns document transitions so undo/redo can replay complete snapshots
// without asking the UI to reconstruct inverse commands for every shape type.
export function createHistory(
  document: DocumentModel = createDocument(),
): HistoryState {
  return { document: cloneDocument(document), past: [], future: [] };
}

// A new command starts a new timeline. Clearing future is what prevents an
// old redo branch from overwriting a newer edit after the user changes course.
export function executeCommand(
  history: HistoryState,
  command: Command,
): HistoryState {
  const before = cloneDocument(history.document);
  const after = applyCommand(before, command);

  return {
    document: cloneDocument(after),
    past: [...history.past, { command, before, after: cloneDocument(after) }],
    future: [],
  };
}

// Entries store both snapshots rather than only inverse commands. This keeps
// remove and future command variants lossless, including the removed shape.
export function undo(history: HistoryState): HistoryState {
  const entry = history.past.at(-1);
  if (!entry) return history;

  return {
    document: cloneDocument(entry.before),
    past: history.past.slice(0, -1),
    future: [...history.future, entry],
  };
}

export function redo(history: HistoryState): HistoryState {
  const entry = history.future.at(-1);
  if (!entry) return history;

  return {
    document: cloneDocument(entry.after),
    past: [...history.past, entry],
    future: history.future.slice(0, -1),
  };
}

export function canUndo(history: HistoryState): boolean {
  return history.past.length > 0;
}

export function canRedo(history: HistoryState): boolean {
  return history.future.length > 0;
}

// Dragging produces many intermediate documents, but users expect one undo
// action to reverse one gesture. Update the active entry instead of growing
// the timeline for every pointermove event.
function cloneDocument(document: DocumentModel): DocumentModel {
  // Copy each shape as well as the array: a history snapshot must not share
  // mutable object identity with a caller that might later edit a shape.
  return createDocument(document.shapes.map((shape) => ({ ...shape })));
}
