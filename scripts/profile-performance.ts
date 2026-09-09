import { performance } from "node:perf_hooks";
import { createDocument } from "../lib/document";
import {
  createYDocument,
  encodeYjsState,
  yDocumentToDocument,
} from "../lib/yjs-document";

const sizes = [1_000, 5_000, 10_000];

// This is intentionally a small repeatable baseline rather than a benchmark
// framework. It measures the document operations that run around each editor
// update and keeps the project free of a performance dependency.
for (const size of sizes) {
  const shapes = Array.from({ length: size }, (_, index) => ({
    type: "rectangle" as const,
    id: `profile-shape-${index}`,
    x: index % 100,
    y: Math.floor(index / 100),
    width: 120,
    height: 80,
    fill: "#fff",
  }));
  const started = performance.now();
  const ydoc = createYDocument(createDocument(shapes));
  const created = performance.now();
  const update = encodeYjsState(ydoc);
  const encoded = performance.now();
  yDocumentToDocument(ydoc);
  const converted = performance.now();

  console.log(
    JSON.stringify({
      size,
      createMs: +(created - started).toFixed(1),
      encodeMs: +(encoded - created).toFixed(1),
      convertMs: +(converted - encoded).toFixed(1),
      bytes: update.byteLength,
    }),
  );
}
