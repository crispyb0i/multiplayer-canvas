"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, WheelEvent } from "react";
import {
  type DocumentModel,
  type Shape,
  type TextShape,
} from "../lib/document";
import {
  CollaborationClient,
  type CollaborationStatus,
} from "../lib/collaboration-client";
import type { Presence } from "../lib/collaboration";
import {
  canRedo,
  canUndo,
  createHistory,
  executeCommand,
  redo,
  undo,
  type HistoryState,
} from "../lib/history";
import {
  createYDocument,
  executeYjsCommand,
  replaceYjsDocument,
  yDocumentToDocument,
} from "../lib/yjs-document";
import { createCollaborativeHistory } from "../lib/collaborative-history";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 560;
const movements: Record<string, { x?: number; y?: number }> = {
  ArrowLeft: { x: -1 },
  ArrowRight: { x: 1 },
  ArrowUp: { y: -1 },
  ArrowDown: { y: 1 },
};

type CollaborationAuth = {
  organizationId: string;
  tokenProvider: () => Promise<string | null>;
};
// crypto.randomUUID isn't available in every test/SSR environment, so this
// falls back to Date.now() rather than crashing; collisions there just fail
// the document model's duplicate-id check instead of corrupting state.
function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID?.() ?? Date.now()}`;
}

export default function Editor({
  collaborationAuth,
}: { collaborationAuth?: CollaborationAuth } = {}) {
  const ydocRef = useRef(createYDocument());
  const collaborativeHistory = useRef(
    createCollaborativeHistory(ydocRef.current),
  );
  const [history, setHistory] = useState<HistoryState>(() => createHistory());
  const [document, setDocument] = useState<DocumentModel>(() =>
    yDocumentToDocument(ydocRef.current),
  );
  const [collaborationStatus, setCollaborationStatus] =
    useState<CollaborationStatus>("disconnected");
  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [, setCollaborativeHistoryVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [remotePresence, setRemotePresence] = useState<Presence[]>([]);
  const collaborationClient = useRef<CollaborationClient | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  // Drag/pan state lives in refs, not useState: they change on every
  // pointermove and don't need to trigger a re-render themselves — only the
  // derived document/viewport updates below do. Refs also avoid stale
  // closures inside the pointer handlers between mousedown and mouseup.
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    shape: Shape;
    latestShape: Shape;
  } | null>(null);
  const pan = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const selected = document.shapes.find((shape) => shape.id === selectedId);
  const collaborativeMode = Boolean(
    process.env.NEXT_PUBLIC_COLLAB_URL && collaborationAuth,
  );

  // The URL is injected only in deployed environments. Local development and
  // tests remain useful without a backend by falling back to single-user mode.
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_COLLAB_URL;
    if (!url || !collaborationAuth) return;

    const client = new CollaborationClient({
      url,
      roomId: "demo",
      ...collaborationAuth,
      document: ydocRef.current,
      clientId: newId("client"),
      color: "#f6c85f",
      onStatusChange: setCollaborationStatus,
      onPendingChange: setPendingUpdates,
      onPresenceChange: setRemotePresence,
      onRemoteUpdate: () => {
        const syncedDocument = yDocumentToDocument(ydocRef.current);
        setDocument(syncedDocument);
        if (collaborativeMode) {
          collaborativeHistory.current.remoteUpdateBoundary();
          setCollaborativeHistoryVersion((version) => version + 1);
        } else {
          // Snapshot history cannot safely cross a remote update. The
          // collaborative path uses Yjs UndoManager instead.
          setHistory(createHistory(syncedDocument));
        }
      },
    });
    collaborationClient.current = client;
    client.connect();
    return () => {
      client.dispose();
      collaborationClient.current = null;
    };
  }, [collaborationAuth, collaborativeMode]);

  // Selection is local UI state, but publishing it lets peers render an
  // awareness outline without polluting the shared document or undo stack.
  useEffect(() => {
    collaborationClient.current?.sendPresence({ cursor: null, selectedId });
  }, [selectedId]);

  // Selection is UI state, not part of the document timeline. Reconcile it
  // after undo/redo so a restored or removed shape cannot stay selected.
  useEffect(() => {
    if (
      selectedId &&
      !document.shapes.some((shape) => shape.id === selectedId)
    ) {
      setSelectedId(null);
    }
  }, [document, selectedId]);

  function runCommand(command: Parameters<typeof executeCommand>[1]) {
    const nextDocument = executeYjsCommand(ydocRef.current, command);
    setDocument(nextDocument);
    setHistory((current) => executeCommand(current, command));
  }

  function undoDocument() {
    if (collaborativeMode) {
      collaborativeHistory.current.undo();
      setDocument(yDocumentToDocument(ydocRef.current));
      setCollaborativeHistoryVersion((version) => version + 1);
      return;
    }
    const next = undo(history);
    if (next === history) return;
    replaceYjsDocument(ydocRef.current, next.document);
    setDocument(next.document);
    setHistory(next);
  }

  function redoDocument() {
    if (collaborativeMode) {
      collaborativeHistory.current.redo();
      setDocument(yDocumentToDocument(ydocRef.current));
      setCollaborativeHistoryVersion((version) => version + 1);
      return;
    }
    const next = redo(history);
    if (next === history) return;
    replaceYjsDocument(ydocRef.current, next.document);
    setDocument(next.document);
    setHistory(next);
  }

  // Converts a browser pointer event into canvas-space coordinates: first
  // scale from CSS pixels to the SVG's viewBox units (in case the element is
  // rendered at a different size than CANVAS_WIDTH/HEIGHT), then undo the
  // pan/zoom transform applied to the <g> the shapes live in.
  //
  // Always measures the <svg> itself via svgRef, not event.currentTarget:
  // shape drag events originate on a per-shape <g>, whose bounding rect is
  // sized to that shape's content rather than the full canvas, which made
  // the shape jump the instant a drag started.
  function point(event: { clientX: number; clientY: number }) {
    const bounds = svgRef.current!.getBoundingClientRect();
    const canvasX =
      ((event.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH;
    const canvasY =
      ((event.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT;
    return {
      x: (canvasX - viewport.x) / viewport.scale,
      y: (canvasY - viewport.y) / viewport.scale,
    };
  }
  function addShape(kind: "rectangle" | "text") {
    const shape: Shape =
      kind === "rectangle"
        ? {
            type: "rectangle",
            id: newId("rectangle"),
            x: 120,
            y: 100,
            width: 180,
            height: 100,
            fill: "#8ee6c5",
          }
        : {
            type: "text",
            id: newId("text"),
            x: 150,
            y: 160,
            width: 220,
            height: 42,
            fill: "#eef2ff",
            text: "Double-click to edit",
          };
    runCommand({ type: "add", shape });
    setSelectedId(shape.id);
  }
  // Middle-click or Space-drag pans instead of selecting. setPointerCapture
  // keeps sending pointermove/up events to this element even if the cursor
  // leaves the SVG mid-drag, so a fast pan doesn't get stuck.
  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button === 1 || isSpaceDown) {
      pan.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: viewport.x,
        originY: viewport.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    setSelectedId(null);
  }
  // stopPropagation prevents this from also triggering onPointerDown on the
  // <svg> background, which would otherwise clear the selection we just set.
  function onShapePointerDown(event: PointerEvent<SVGGElement>, shape: Shape) {
    event.stopPropagation();
    const position = point(event);
    collaborationClient.current?.sendPresence({ cursor: position, selectedId });
    setSelectedId(shape.id);
    drag.current = {
      id: shape.id,
      startX: position.x,
      startY: position.y,
      shape,
      latestShape: shape,
    };
  }
  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (pan.current) {
      setViewport((current) => ({
        ...current,
        x: pan.current!.originX + event.clientX - pan.current!.startX,
        y: pan.current!.originY + event.clientY - pan.current!.startY,
      }));
      return;
    }
    if (!drag.current) {
      collaborationClient.current?.sendPresence({
        cursor: point(event),
        selectedId,
      });
      return;
    }
    if (!drag.current) return;
    const position = point(event);
    // Move is computed as an offset from the shape's position at drag start,
    // not the shape's current position each frame — this avoids compounding
    // rounding error and keeps the shape locked to the same point under the
    // cursor for the whole gesture.
    const { id, shape, startX, startY } = drag.current;
    const command = {
      type: "update" as const,
      id,
      changes: {
        x: shape.x + position.x - startX,
        y: shape.y + position.y - startY,
      },
    };
    const nextDocument = executeYjsCommand(ydocRef.current, command);
    drag.current.latestShape =
      nextDocument.shapes.find((item) => item.id === id) ?? shape;
    setDocument(nextDocument);
  }
  function stopPointer() {
    if (drag.current && drag.current.latestShape !== drag.current.shape) {
      const { id, latestShape } = drag.current;
      setHistory((current) =>
        executeCommand(current, {
          type: "update",
          id,
          changes: {
            x: latestShape.x,
            y: latestShape.y,
          },
        }),
      );
    }
    pan.current = null;
    drag.current = null;
  }
  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === " ") setIsSpaceDown(true);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redoDocument();
      else undoDocument();
      return;
    }
    if (!selectedId || !selected) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      runCommand({ type: "remove", id: selectedId });
      setSelectedId(null);
      return;
    }
    const movement = movements[event.key];
    if (movement) {
      event.preventDefault();
      const distance = event.shiftKey ? 10 : 1;
      runCommand({
        type: "update",
        id: selectedId,
        changes: {
          x: selected.x + (movement.x ?? 0) * distance,
          y: selected.y + (movement.y ?? 0) * distance,
        },
      });
    }
  }
  // Zoom is multiplicative (scale *= factor), not additive, so each wheel
  // tick feels like the same proportional zoom whether you're at 0.4x or
  // 3x. The clamp keeps shapes from shrinking to nothing or growing past a
  // usable size.
  function onWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    setViewport((current) => ({
      ...current,
      scale: Math.min(
        3,
        Math.max(0.4, current.scale * (event.deltaY < 0 ? 1.1 : 0.9)),
      ),
    }));
  }
  return (
    <section className="mt-10" aria-label="Collaborative canvas editor">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          className="cursor-pointer rounded-lg border-0 bg-accent px-3.5 py-2.5 font-bold text-[#10201b]"
          onClick={() => addShape("rectangle")}
        >
          Add rectangle
        </button>
        <button
          className="cursor-pointer rounded-lg border-0 bg-accent px-3.5 py-2.5 font-bold text-[#10201b]"
          onClick={() => addShape("text")}
        >
          Add text
        </button>
        <button
          aria-label="Undo"
          className="cursor-pointer rounded-lg border border-[#52617d] bg-panel px-3.5 py-2.5 font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"
          disabled={
            collaborativeMode
              ? !collaborativeHistory.current.canUndo()
              : !canUndo(history)
          }
          onClick={undoDocument}
        >
          Undo
        </button>
        <button
          aria-label="Redo"
          className="cursor-pointer rounded-lg border border-[#52617d] bg-panel px-3.5 py-2.5 font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"
          disabled={
            collaborativeMode
              ? !collaborativeHistory.current.canRedo()
              : !canRedo(history)
          }
          onClick={redoDocument}
        >
          Redo
        </button>
        <span className="text-sm text-muted">
          {selected ? `Selected: ${selected.type}` : "Nothing selected"}
        </span>
        <span className="text-sm text-muted" aria-live="polite">
          {process.env.NEXT_PUBLIC_COLLAB_URL
            ? `Collaboration: ${collaborationStatus}${pendingUpdates ? ` (${pendingUpdates} pending)` : ""}`
            : "Collaboration: local mode"}
        </span>
        {collaborationStatus === "error" && (
          <button
            className="cursor-pointer rounded-md border border-[#b86b6b] bg-panel px-2.5 py-2 text-sm text-ink"
            onClick={() => {
              void collaborationClient.current?.clearLocalState().then(() => {
                collaborationClient.current?.connect();
              });
            }}
          >
            Reset local sync data
          </button>
        )}
        {selected?.type === "text" && (
          <label className="text-sm text-muted">
            Text{" "}
            <input
              aria-label="Selected text"
              className="ml-1.5 rounded-md border border-[#52617d] bg-panel px-2.5 py-2.5 text-ink"
              value={(selected as TextShape).text}
              onChange={(event) =>
                runCommand({
                  type: "update",
                  id: selected.id,
                  changes: { text: event.target.value },
                })
              }
            />
          </label>
        )}
      </div>
      <svg
        ref={svgRef}
        aria-label="Drawing canvas"
        className="block w-full cursor-crosshair rounded-xl border border-[#35405a] bg-[#111827] outline-none focus:border-accent focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]"
        role="application"
        tabIndex={0}
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        onKeyDown={onKeyDown}
        onKeyUp={(event) => event.key === " " && setIsSpaceDown(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopPointer}
        onPointerLeave={stopPointer}
        onWheel={onWheel}
      >
        <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#111827" />
        <g
          transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}
        >
          {document.shapes.map((shape) => (
            <g
              key={shape.id}
              onPointerDown={(event) => onShapePointerDown(event, shape)}
            >
              {shape.type === "rectangle" ? (
                <rect
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                  rx="8"
                  fill={shape.fill}
                />
              ) : (
                <text
                  x={shape.x}
                  y={shape.y + 28}
                  fill={shape.fill}
                  fontSize="22"
                >
                  {shape.text}
                </text>
              )}
              {selectedId === shape.id && (
                // Tailwind has no utility for SVG presentation attributes like
                // stroke-dasharray, so the selection outline stays inline style.
                <rect
                  x={shape.x - 6}
                  y={shape.y - 6}
                  width={shape.width + 12}
                  height={shape.height + 12}
                  style={{
                    fill: "none",
                    stroke: "#ffffff",
                    strokeDasharray: "5 4",
                    strokeWidth: 2,
                    pointerEvents: "none",
                  }}
                />
              )}
            </g>
          ))}
          {remotePresence.map((presence) => (
            <g key={presence.clientId} pointerEvents="none">
              {presence.cursor && (
                <circle
                  cx={presence.cursor.x}
                  cy={presence.cursor.y}
                  r="6"
                  fill={presence.color}
                  stroke="#111827"
                  strokeWidth="2"
                />
              )}
              {presence.selectedId &&
                document.shapes.some(
                  (shape) => shape.id === presence.selectedId,
                ) && (
                  <rect
                    x={
                      (document.shapes.find(
                        (shape) => shape.id === presence.selectedId,
                      )?.x ?? 0) - 8
                    }
                    y={
                      (document.shapes.find(
                        (shape) => shape.id === presence.selectedId,
                      )?.y ?? 0) - 8
                    }
                    width={
                      (document.shapes.find(
                        (shape) => shape.id === presence.selectedId,
                      )?.width ?? 0) + 16
                    }
                    height={
                      (document.shapes.find(
                        (shape) => shape.id === presence.selectedId,
                      )?.height ?? 0) + 16
                    }
                    fill="none"
                    stroke={presence.color}
                    strokeDasharray="3 3"
                    strokeWidth="2"
                  />
                )}
            </g>
          ))}
        </g>
      </svg>
      <p className="text-[0.85rem] leading-relaxed text-muted">
        Click a shape to select it. Drag to move. Arrow keys move the selection;
        Shift moves by 10. Space-drag pans; the wheel zooms.
      </p>
    </section>
  );
}
