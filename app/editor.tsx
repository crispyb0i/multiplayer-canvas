"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { type DocumentModel, type Shape } from "../lib/document";
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

const ShapeVisual = memo(
  function ShapeVisual({
    shape,
    selected,
  }: {
    shape: Shape;
    selected: boolean;
  }) {
    // The scalar comparator also handles fresh objects from Yjs conversion.
    // Memoizing the visual keeps presence, sync-status, and toolbar updates from
    // rebuilding unchanged SVG nodes. The parent still owns pointer behavior so
    // interaction state does not leak into this render-only component.
    return (
      <>
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
          <text x={shape.x} y={shape.y + 28} fill={shape.fill} fontSize="22">
            {shape.text}
          </text>
        )}
        {selected && (
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
      </>
    );
  },
  (previous, next) =>
    previous.selected === next.selected &&
    previous.shape.id === next.shape.id &&
    previous.shape.type === next.shape.type &&
    previous.shape.x === next.shape.x &&
    previous.shape.y === next.shape.y &&
    previous.shape.width === next.shape.width &&
    previous.shape.height === next.shape.height &&
    previous.shape.fill === next.shape.fill &&
    (previous.shape.type !== "text" ||
      (next.shape.type === "text" && previous.shape.text === next.shape.text)),
);

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
  // Ref arguments are evaluated on every render. A lazy state initializer
  // allocates one replica, while the effect owns UndoManager subscriptions.
  const collaborativeMode = Boolean(
    process.env.NEXT_PUBLIC_COLLAB_URL && collaborationAuth,
  );
  const [ydoc] = useState(() => createYDocument());
  const collaborativeHistory = useRef<ReturnType<
    typeof createCollaborativeHistory
  > | null>(null);
  useEffect(() => {
    if (!collaborativeMode) return;
    const history = createCollaborativeHistory(ydoc);
    collaborativeHistory.current = history;
    return () => {
      history.undoManager.destroy();
      collaborativeHistory.current = null;
    };
  }, [ydoc, collaborativeMode]);
  const [history, setHistory] = useState<HistoryState>(() => createHistory());
  const [document, setDocument] = useState<DocumentModel>(() =>
    yDocumentToDocument(ydoc),
  );
  const [collaborationStatus, setCollaborationStatus] =
    useState<CollaborationStatus>("disconnected");
  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [, setCollaborativeHistoryVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [remotePresence, setRemotePresence] = useState<Presence[]>([]);
  const collaborationClient = useRef<CollaborationClient | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const isSpaceDown = useRef(false);
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
  const shapesById = useMemo(
    () => new Map(document.shapes.map((shape) => [shape.id, shape])),
    [document.shapes],
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
      document: ydoc,
      clientId: newId("client"),
      color: "#f6c85f",
      onStatusChange: setCollaborationStatus,
      onPendingChange: setPendingUpdates,
      onPresenceChange: setRemotePresence,
      onRemoteUpdate: () => {
        const syncedDocument = yDocumentToDocument(ydoc);
        setDocument(syncedDocument);
        if (collaborativeMode) {
          collaborativeHistory.current?.remoteUpdateBoundary();
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
  }, [collaborationAuth, collaborativeMode, ydoc]);

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
    const nextDocument = executeYjsCommand(ydoc, command);
    setDocument(nextDocument);
    // Snapshot history cannot contain shapes restored by another client.
    // Collaborative mode has one authoritative history: the Yjs UndoManager.
    if (!collaborativeMode)
      setHistory((current) => executeCommand(current, command));
  }

  function undoDocument() {
    if (collaborativeMode) {
      collaborativeHistory.current?.undo();
      setDocument(yDocumentToDocument(ydoc));
      setCollaborativeHistoryVersion((version) => version + 1);
      return;
    }
    const next = undo(history);
    if (next === history) return;
    replaceYjsDocument(ydoc, next.document);
    setDocument(next.document);
    setHistory(next);
  }

  function redoDocument() {
    if (collaborativeMode) {
      collaborativeHistory.current?.redo();
      setDocument(yDocumentToDocument(ydoc));
      setCollaborativeHistoryVersion((version) => version + 1);
      return;
    }
    const next = redo(history);
    if (next === history) return;
    replaceYjsDocument(ydoc, next.document);
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
            text: "Edit me in the text field",
          };
    runCommand({ type: "add", shape });
    setSelectedId(shape.id);
  }
  // Middle-click or Space-drag pans instead of selecting. setPointerCapture
  // keeps sending pointermove/up events to this element even if the cursor
  // leaves the SVG mid-drag, so a fast pan doesn't get stuck.
  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button === 1 || isSpaceDown.current) {
      event.preventDefault();
      pan.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: viewport.x,
        originY: viewport.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button === 0) setSelectedId(null);
  }
  // stopPropagation prevents this from also triggering onPointerDown on the
  // <svg> background, which would otherwise clear the selection we just set.
  function onShapePointerDown(event: PointerEvent<SVGGElement>, shape: Shape) {
    // Let pan gestures reach the SVG even when they start on a shape.
    if (event.button === 1 || isSpaceDown.current) return;
    if (event.button !== 0) return;
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    const position = point(event);
    collaborationClient.current?.sendPresence({ cursor: position, selectedId });
    setSelectedId(shape.id);
    setAnnouncement(`${shape.type} selected`);
    // Group one gesture into one undo step, with remote updates still able to
    // establish their own boundary. Pointer completion resets capture policy.
    const manager = collaborativeHistory.current?.undoManager;
    if (manager) {
      manager.stopCapturing();
      manager.captureTimeout = Infinity;
    }
    drag.current = {
      id: shape.id,
      startX: position.x,
      startY: position.y,
      shape,
      latestShape: shape,
    };
  }
  // SVG groups are not keyboard controls by default. Giving each shape an
  // explicit activation path keeps selection usable without pointer input.
  function onShapeKeyDown(event: KeyboardEvent<SVGGElement>, shape: Shape) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(shape.id);
    setAnnouncement(`${shape.type} selected`);
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (pan.current) {
      // Pointer deltas are CSS pixels; the viewport uses viewBox units.
      const bounds = svgRef.current!.getBoundingClientRect();
      setViewport((current) => ({
        ...current,
        x:
          pan.current!.originX +
          ((event.clientX - pan.current!.startX) * CANVAS_WIDTH) / bounds.width,
        y:
          pan.current!.originY +
          ((event.clientY - pan.current!.startY) * CANVAS_HEIGHT) /
            bounds.height,
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
    // A remote delete can arrive between pointer events. Cancel the gesture
    // instead of issuing an update against a shape that no longer exists.
    if (!shapesById.has(drag.current.id)) {
      drag.current = null;
      return;
    }
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
    const nextDocument = executeYjsCommand(ydoc, command);
    drag.current.latestShape =
      nextDocument.shapes.find((item) => item.id === id) ?? shape;
    setDocument(nextDocument);
  }
  function stopPointer() {
    // Collaborative drags already commit each pointer move to Yjs. Keeping
    // a second snapshot-history commit here would apply against the local
    // history baseline, which may not contain a server-restored shape.
    if (
      !collaborativeMode &&
      drag.current &&
      drag.current.latestShape !== drag.current.shape
    ) {
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
    const manager = collaborativeHistory.current?.undoManager;
    if (manager) {
      manager.stopCapturing();
      manager.captureTimeout = 0;
    }
    pan.current = null;
    drag.current = null;
  }
  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === " ") {
      event.preventDefault();
      isSpaceDown.current = true;
    }
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
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // React delegates wheel events passively, so preventDefault there cannot
    // stop page scrolling. A scoped non-passive listener owns canvas zoom.
    const zoom = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      const bounds = svg.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) * CANVAS_WIDTH) / bounds.width;
      const y = ((event.clientY - bounds.top) * CANVAS_HEIGHT) / bounds.height;
      setViewport((current) => {
        const scale = Math.min(
          3,
          Math.max(0.4, current.scale * (event.deltaY < 0 ? 1.1 : 0.9)),
        );
        // Keep the point under the cursor fixed as scale changes.
        return {
          scale,
          x: x - ((x - current.x) * scale) / current.scale,
          y: y - ((y - current.y) * scale) / current.scale,
        };
      });
    };
    svg.addEventListener("wheel", zoom, { passive: false });
    return () => svg.removeEventListener("wheel", zoom);
  }, []);
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
              ? !collaborativeHistory.current?.canUndo()
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
              ? !collaborativeHistory.current?.canRedo()
              : !canRedo(history)
          }
          onClick={redoDocument}
        >
          Redo
        </button>
        <button
          className="rounded-lg border border-[#52617d] bg-panel px-3.5 py-2.5 text-ink"
          onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
        >
          Reset view
        </button>
        <span className="text-sm text-muted">
          {selected ? `Selected: ${selected.type}` : "Nothing selected"}
        </span>
        <span className="text-sm text-muted" aria-live="polite">
          {collaborativeMode
            ? `Collaboration: ${collaborationStatus}${pendingUpdates ? ` (${pendingUpdates} pending)` : ""}`
            : "Local demo · changes last until you reload"}
        </span>
        <span className="sr-only" aria-live="assertive" aria-atomic="true">
          {announcement}
        </span>
        {collaborationStatus === "error" && (
          <button
            className="cursor-pointer rounded-md border border-[#b86b6b] bg-panel px-2.5 py-2 text-sm text-ink"
            onClick={() => {
              collaborationClient.current?.connect();
            }}
          >
            Retry connection
          </button>
        )}
        {selected?.type === "text" && (
          <label className="text-sm text-muted">
            Text{" "}
            <input
              aria-label="Selected text"
              className="ml-1.5 rounded-md border border-[#52617d] bg-panel px-2.5 py-2.5 text-ink"
              value={selected.text}
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
        className="block w-full touch-none cursor-crosshair rounded-xl border border-[#35405a] bg-[#111827] outline-none focus:border-accent focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]"
        role="application"
        tabIndex={0}
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        onKeyDown={onKeyDown}
        onKeyUp={(event) => {
          if (event.key === " ") isSpaceDown.current = false;
        }}
        onBlur={() => {
          isSpaceDown.current = false;
          stopPointer();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopPointer}
        onPointerCancel={stopPointer}
        onLostPointerCapture={stopPointer}
        onPointerLeave={() => {
          collaborationClient.current?.sendPresence({
            cursor: null,
            selectedId,
          });
        }}
      >
        <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#111827" />
        <g
          transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}
        >
          {document.shapes.length === 0 && (
            <text x="450" y="280" textAnchor="middle" fill="#aab5cc">
              Canvas is empty. Use Add rectangle or Add text to begin.
            </text>
          )}
          {document.shapes.map((shape) => (
            <g
              key={shape.id}
              role="button"
              tabIndex={0}
              aria-label={`${shape.type} shape`}
              aria-pressed={selectedId === shape.id}
              onPointerDown={(event) => onShapePointerDown(event, shape)}
              onKeyDown={(event) => onShapeKeyDown(event, shape)}
            >
              <ShapeVisual shape={shape} selected={selectedId === shape.id} />
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
              {presence.selectedId && shapesById.has(presence.selectedId) && (
                <rect
                  x={(shapesById.get(presence.selectedId)?.x ?? 0) - 8}
                  y={(shapesById.get(presence.selectedId)?.y ?? 0) - 8}
                  width={(shapesById.get(presence.selectedId)?.width ?? 0) + 16}
                  height={
                    (shapesById.get(presence.selectedId)?.height ?? 0) + 16
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
        Shift moves by 10. Space-drag pans; the wheel zooms. Delete removes a
        shape; Ctrl/⌘ Z undoes. Select text to edit its label.
      </p>
    </section>
  );
}
