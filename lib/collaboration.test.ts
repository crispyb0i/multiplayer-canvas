import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { CollaborationRooms } from "./collaboration";
import { createDocument, type RectangleShape } from "./document";
import {
  createYDocument,
  encodeYjsState,
  executeYjsCommand,
  yDocumentToDocument,
} from "./yjs-document";

const rectangle: RectangleShape = {
  id: "box-1",
  type: "rectangle",
  x: 10,
  y: 20,
  width: 120,
  height: 80,
  fill: "#2563eb",
};

class FakeClient {
  readonly messages: Array<string | Uint8Array> = [];
  send(data: string | Uint8Array): void {
    this.messages.push(data);
  }
}

describe("collaboration room transport", () => {
  it("relays Yjs updates between clients in the same room", () => {
    const rooms = new CollaborationRooms();
    const first = new FakeClient();
    const second = new FakeClient();
    const firstDocument = createYDocument();
    const secondDocument = createYDocument();

    rooms.connect(first);
    rooms.connect(second);
    rooms.receive(first, JSON.stringify({ type: "join", roomId: "canvas-1" }));
    rooms.receive(second, JSON.stringify({ type: "join", roomId: "canvas-1" }));
    first.messages.length = 0;
    second.messages.length = 0;

    executeYjsCommand(firstDocument, { type: "add", shape: rectangle });
    rooms.receive(first, encodeYjsState(firstDocument));
    const update = second.messages[0];
    expect(update).toBeInstanceOf(Uint8Array);
    Y.applyUpdate(secondDocument, update as Uint8Array);

    expect(yDocumentToDocument(secondDocument).shapes).toEqual([rectangle]);
    expect(first.messages).toEqual([JSON.stringify({ type: "sync-ack" })]);
  });

  it("sends current room state to a reconnecting client", () => {
    const rooms = new CollaborationRooms();
    const first = new FakeClient();
    const reconnecting = new FakeClient();
    const document = createYDocument();

    rooms.connect(first);
    rooms.receive(first, JSON.stringify({ type: "join", roomId: "canvas-1" }));
    executeYjsCommand(document, { type: "add", shape: rectangle });
    rooms.receive(first, encodeYjsState(document));
    rooms.disconnect(first);

    rooms.connect(reconnecting);
    rooms.receive(
      reconnecting,
      JSON.stringify({ type: "join", roomId: "canvas-1" }),
    );
    const recovered = createYDocument(createDocument());
    Y.applyUpdate(recovered, reconnecting.messages[0] as Uint8Array);

    expect(yDocumentToDocument(recovered).shapes).toEqual([rectangle]);
  });

  it("does not relay updates across rooms", () => {
    const rooms = new CollaborationRooms();
    const first = new FakeClient();
    const other = new FakeClient();
    const document = createYDocument();

    rooms.connect(first);
    rooms.connect(other);
    rooms.receive(first, JSON.stringify({ type: "join", roomId: "one" }));
    rooms.receive(other, JSON.stringify({ type: "join", roomId: "two" }));
    first.messages.length = 0;
    other.messages.length = 0;

    executeYjsCommand(document, { type: "add", shape: rectangle });
    rooms.receive(first, encodeYjsState(document));
    expect(other.messages).toEqual([]);
  });

  it("relays ephemeral presence and removes it on disconnect", () => {
    const rooms = new CollaborationRooms();
    const first = new FakeClient();
    const second = new FakeClient();
    const presence = {
      clientId: "second",
      color: "#8ee6c5",
      cursor: { x: 12, y: 34 },
      selectedId: "box-1",
    };
    rooms.connect(first);
    rooms.connect(second);
    rooms.receive(first, JSON.stringify({ type: "join", roomId: "one" }));
    rooms.receive(second, JSON.stringify({ type: "join", roomId: "one" }));
    first.messages.length = 0;
    second.messages.length = 0;
    rooms.receive(second, JSON.stringify({ type: "presence", presence }));
    expect(first.messages).toEqual([
      JSON.stringify({ type: "presence", presence }),
    ]);
    first.messages.length = 0;
    rooms.disconnect(second);
    expect(first.messages).toEqual([
      JSON.stringify({ type: "presence-remove", clientId: "second" }),
    ]);
  });

  it("keeps presence isolated between rooms", () => {
    const rooms = new CollaborationRooms();
    const first = new FakeClient();
    const other = new FakeClient();
    rooms.connect(first);
    rooms.connect(other);
    rooms.receive(first, JSON.stringify({ type: "join", roomId: "one" }));
    rooms.receive(other, JSON.stringify({ type: "join", roomId: "two" }));
    first.messages.length = 0;
    other.messages.length = 0;
    rooms.receive(
      first,
      JSON.stringify({
        type: "presence",
        presence: {
          clientId: "first",
          color: "#8ee6c5",
          cursor: null,
          selectedId: null,
        },
      }),
    );
    expect(other.messages).toEqual([]);
  });

  it("rejects unauthenticated and cross-workspace joins in secure mode", () => {
    const rooms = new CollaborationRooms({ requireAuthentication: true });
    const unauthenticated = new FakeClient();
    const member = new FakeClient();
    rooms.connect(unauthenticated);
    rooms.receive(
      unauthenticated,
      JSON.stringify({ type: "join", roomId: "one", organizationId: "org-1" }),
    );
    expect(unauthenticated.messages).toEqual([]);

    rooms.connect(member);
    rooms.authenticate(member, {
      userId: "user-1",
      organizationId: "org-1",
      organizationRole: "org:member",
    });
    rooms.receive(
      member,
      JSON.stringify({ type: "join", roomId: "one", organizationId: "org-2" }),
    );
    expect(member.messages).toEqual([]);
  });

  it("restores a snapshot before joining and persists later updates", async () => {
    const restoredDocument = createYDocument();
    executeYjsCommand(restoredDocument, { type: "add", shape: rectangle });
    const persistence = {
      upsertWorkspace: vi.fn(async () => undefined),
      loadSnapshot: vi.fn(async () => ({
        organizationId: "org-1",
        documentId: "canvas-1",
        snapshot: encodeYjsState(restoredDocument),
        version: 4,
      })),
      saveSnapshot: vi.fn(async () => undefined),
    };
    const rooms = new CollaborationRooms({
      requireAuthentication: true,
      persistence,
    });
    const client = new FakeClient();
    rooms.connect(client);
    rooms.authenticate(client, {
      userId: "user-1",
      organizationId: "org-1",
      organizationRole: "org:member",
    });
    rooms.receive(
      client,
      JSON.stringify({
        type: "join",
        roomId: "canvas-1",
        organizationId: "org-1",
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(persistence.loadSnapshot).toHaveBeenCalledWith("org-1", "canvas-1");
    expect(client.messages[0]).toBeInstanceOf(Uint8Array);

    rooms.receive(client, encodeYjsState(createYDocument()));
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(persistence.saveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        documentId: "canvas-1",
        version: 5,
      }),
    );
  });
  it("preserves authorization across room changes and isolates organizations without persistence", () => {
    const rooms = new CollaborationRooms({ requireAuthentication: true });
    const member = new FakeClient();
    const other = new FakeClient();
    for (const [client, organizationId] of [
      [member, "org-1"],
      [other, "org-2"],
    ] as const) {
      rooms.connect(client);
      rooms.authenticate(client, {
        userId: "user",
        organizationId,
        organizationRole: "org:member",
      });
      rooms.receive(
        client,
        JSON.stringify({ type: "join", roomId: "same", organizationId }),
      );
    }
    other.messages.length = 0;
    rooms.receive(
      member,
      encodeYjsState(createYDocument(createDocument([rectangle]))),
    );
    expect(other.messages).toEqual([]);
    rooms.receive(
      member,
      JSON.stringify({
        type: "join",
        roomId: "another",
        organizationId: "org-1",
      }),
    );
    member.messages.length = 0;
    rooms.receive(member, encodeYjsState(createYDocument()));
    expect(member.messages).toEqual([JSON.stringify({ type: "sync-ack" })]);
  });

  it("does not resurrect a client disconnected during snapshot loading", async () => {
    let finish!: (value: null) => void;
    const persistence = {
      upsertWorkspace: vi.fn(async () => {}),
      loadSnapshot: vi.fn(
        () =>
          new Promise<null>((resolve) => {
            finish = resolve;
          }),
      ),
      saveSnapshot: vi.fn(async () => {}),
    };
    const rooms = new CollaborationRooms({
      requireAuthentication: true,
      persistence,
    });
    const client = new FakeClient();
    rooms.connect(client);
    rooms.authenticate(client, {
      userId: "user",
      organizationId: "org",
      organizationRole: "org:member",
    });
    rooms.receive(
      client,
      JSON.stringify({ type: "join", roomId: "one", organizationId: "org" }),
    );
    await Promise.resolve();
    rooms.disconnect(client);
    finish(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.messages).toEqual([]);
  });

  it("relays incremental bytes instead of the full accumulated snapshot", () => {
    const rooms = new CollaborationRooms();
    const first = new FakeClient();
    const peer = new FakeClient();
    for (const client of [first, peer])
      rooms.receive(client, JSON.stringify({ type: "join", roomId: "one" }));
    const document = createYDocument(createDocument([rectangle]));
    rooms.receive(first, encodeYjsState(document));
    peer.messages.length = 0;
    let delta!: Uint8Array;
    document.on("update", (update: Uint8Array) => {
      delta = update;
    });
    executeYjsCommand(document, {
      type: "update",
      id: rectangle.id,
      changes: { x: 77 },
    });
    rooms.receive(first, delta);
    expect(peer.messages).toEqual([delta]);
    expect(delta.byteLength).toBeLessThan(encodeYjsState(document).byteLength);
  });

  it("reports snapshot restoration failures instead of hanging silently", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const rooms = new CollaborationRooms({
      requireAuthentication: true,
      persistence: {
        upsertWorkspace: async () => {
          throw new Error("unavailable");
        },
        loadSnapshot: async () => null,
        saveSnapshot: async () => {},
      },
    });
    const client = new FakeClient();
    rooms.authenticate(client, {
      userId: "user",
      organizationId: "org",
      organizationRole: "org:member",
    });
    rooms.receive(
      client,
      JSON.stringify({ type: "join", roomId: "one", organizationId: "org" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.messages).toEqual([JSON.stringify({ type: "sync-error" })]);
    logger.mockRestore();
  });
});
