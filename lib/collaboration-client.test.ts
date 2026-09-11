import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CollaborationClient } from "./collaboration-client";
import type { LocalSyncState, OfflinePersistence } from "./offline-persistence";
import {
  createYDocument,
  executeYjsCommand,
  yDocumentToDocument,
} from "./yjs-document";
import type { RectangleShape } from "./document";

class MemoryPersistence implements OfflinePersistence {
  state: LocalSyncState | null = null;
  async load() {
    return this.state;
  }
  async persist(document: Uint8Array, update?: Uint8Array) {
    const pending = this.state?.pending ? [...this.state.pending] : [];
    const id = update ? (pending.at(-1)?.id ?? 0) + 1 : null;
    if (update && id !== null)
      pending.push({ id, update: new Uint8Array(update) });
    this.state = { version: 1, document: new Uint8Array(document), pending };
    return id;
  }
  async acknowledge(id: number) {
    if (this.state)
      this.state.pending = this.state.pending.filter(
        (entry) => entry.id !== id,
      );
  }
  async clear() {
    this.state = null;
  }
}

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: Array<string | Uint8Array> = [];
  private listeners = new Map<string, ((event: MessageEvent) => void)[]>();
  constructor(public readonly url: URL) {
    FakeWebSocket.instances.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  send(data: string | Uint8Array) {
    this.sent.push(data);
  }
  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open");
  }
  message(data: string | ArrayBuffer) {
    this.emit("message", { data } as MessageEvent);
  }
  private emit(type: string, event = { data: undefined } as MessageEvent) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const rectangle: RectangleShape = {
  type: "rectangle",
  id: "offline-box",
  x: 10,
  y: 20,
  width: 120,
  height: 80,
  fill: "#fff",
};

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("CollaborationClient offline sync", () => {
  const originalWebSocket = globalThis.WebSocket;
  beforeEach(() => {
    FakeWebSocket.instances = [];
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  });
  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  it("queues edits and restores them in a new client", async () => {
    const persistence = new MemoryPersistence();
    const firstDocument = createYDocument();
    const first = new CollaborationClient({
      url: "ws://canvas.test",
      roomId: "room",
      organizationId: "org",
      tokenProvider: async () => "token",
      document: firstDocument,
      clientId: "one",
      color: "red",
      persistence,
    });
    executeYjsCommand(firstDocument, { type: "add", shape: rectangle });
    await flush();
    expect(persistence.state?.pending).toHaveLength(1);
    first.dispose();

    const document = createYDocument();
    const pending: number[] = [];
    new CollaborationClient({
      url: "ws://canvas.test",
      roomId: "room",
      organizationId: "org",
      tokenProvider: async () => "token",
      document,
      clientId: "two",
      color: "blue",
      persistence,
      onPendingChange: (count) => pending.push(count),
    });
    await flush();
    expect(yDocumentToDocument(document).shapes).toEqual([rectangle]);
    expect(pending.at(-1)).toBe(1);
  });

  it("waits for sync-ready and removes updates only after acknowledgement", async () => {
    const persistence = new MemoryPersistence();
    const document = createYDocument();
    const client = new CollaborationClient({
      url: "ws://canvas.test",
      roomId: "room",
      organizationId: "org",
      tokenProvider: async () => "token",
      document,
      clientId: "one",
      color: "red",
      persistence,
    });
    executeYjsCommand(document, { type: "add", shape: rectangle });
    await flush();
    client.connect();
    await flush();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    expect(socket.sent).toHaveLength(1);
    socket.message(JSON.stringify({ type: "sync-ready" }));
    await flush();
    expect(socket.sent[1]).toBeInstanceOf(Uint8Array);
    expect(persistence.state?.pending).toHaveLength(1);
    socket.message(JSON.stringify({ type: "sync-ack" }));
    await flush();
    expect(persistence.state?.pending).toHaveLength(0);
    client.dispose();
  });
  it("drains edits created while an earlier update awaits acknowledgement", async () => {
    const persistence = new MemoryPersistence();
    const document = createYDocument();
    const client = new CollaborationClient({
      url: "ws://canvas.test",
      roomId: "room",
      organizationId: "org",
      tokenProvider: async () => "token",
      document,
      clientId: "one",
      color: "red",
      persistence,
    });
    client.connect();
    await flush();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    executeYjsCommand(document, { type: "add", shape: rectangle });
    await flush();
    socket.message(JSON.stringify({ type: "sync-ready" }));
    await flush();
    executeYjsCommand(document, {
      type: "update",
      id: rectangle.id,
      changes: { x: 99 },
    });
    await flush();
    socket.message(JSON.stringify({ type: "sync-ack" }));
    await flush();
    expect(
      socket.sent.filter((message) => message instanceof Uint8Array),
    ).toHaveLength(2);
    socket.message(JSON.stringify({ type: "sync-ack" }));
    await flush();
    expect(persistence.state?.pending).toHaveLength(0);
    client.dispose();
  });

  it("reports token failure and allows a non-destructive retry", async () => {
    const tokenProvider = vi
      .fn()
      .mockRejectedValueOnce(new Error("expired"))
      .mockResolvedValue("token");
    const onStatusChange = vi.fn();
    const client = new CollaborationClient({
      url: "ws://canvas.test",
      roomId: "room",
      organizationId: "org",
      tokenProvider,
      document: createYDocument(),
      clientId: "one",
      color: "red",
      persistence: new MemoryPersistence(),
      onStatusChange,
    });
    client.connect();
    await flush();
    expect(onStatusChange).toHaveBeenLastCalledWith("error");
    expect(FakeWebSocket.instances).toHaveLength(0);
    client.connect();
    await flush();
    expect(FakeWebSocket.instances).toHaveLength(1);
    client.dispose();
  });

  it("retains an unacknowledged update when the connection times out", async () => {
    vi.useFakeTimers();
    const persistence = new MemoryPersistence();
    const document = createYDocument();
    const client = new CollaborationClient({
      url: "ws://canvas.test",
      roomId: "room",
      organizationId: "org",
      tokenProvider: async () => "token",
      document,
      clientId: "one",
      color: "red",
      persistence,
    });
    executeYjsCommand(document, { type: "add", shape: rectangle });
    client.connect();
    await vi.advanceTimersByTimeAsync(0);
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.message(JSON.stringify({ type: "sync-ready" }));
    await vi.advanceTimersByTimeAsync(10000);
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
    expect(persistence.state?.pending).toHaveLength(1);
    client.dispose();
  });
});
