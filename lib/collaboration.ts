import * as Y from "yjs";
import {
  canAccessWorkspace,
  type CollaborationIdentity,
} from "./authorization";
import {
  loadSnapshot,
  saveSnapshot,
  upsertWorkspace,
  type SnapshotRecord,
} from "./persistence";

export const JOIN_MESSAGE = "join";
export const PRESENCE_MESSAGE = "presence";
export const PRESENCE_REMOVE_MESSAGE = "presence-remove";

export type Presence = {
  clientId: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedId: string | null;
};

export type CollaborationClient = { send(data: string | Uint8Array): void };

type Room = {
  document: Y.Doc;
  documentId: string;
  clients: Set<CollaborationClient>;
  presence: Map<CollaborationClient, Presence>;
  organizationId?: string;
  version: number;
};

type RoomPersistence = {
  upsertWorkspace: typeof upsertWorkspace;
  loadSnapshot: typeof loadSnapshot;
  saveSnapshot: typeof saveSnapshot;
};

// The room hub owns room semantics while persistence is injected, letting
// tests exercise collaboration without opening ports or contacting Neon.
export class CollaborationRooms {
  private readonly joinRequests = new WeakMap<CollaborationClient, object>();
  private readonly rooms = new Map<string, Room>();
  private readonly clientRooms = new Map<CollaborationClient, string>();
  private readonly identities = new Map<
    CollaborationClient,
    CollaborationIdentity
  >();
  private readonly loadingRooms = new Map<string, Promise<Room | null>>();
  private readonly snapshotTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly pendingSnapshots = new Map<string, SnapshotRecord>();
  private readonly snapshotWrites = new Map<string, Promise<void>>();

  constructor(
    private readonly options: {
      requireAuthentication?: boolean;
      persistence?: RoomPersistence;
    } = {},
  ) {}

  connect(client: CollaborationClient): void {
    this.disconnect(client);
  }

  // The WebSocket adapter verifies the token; the room hub enforces the
  // resulting identity on every room operation.
  authenticate(
    client: CollaborationClient,
    identity: CollaborationIdentity,
  ): void {
    this.identities.set(client, identity);
  }

  receive(client: CollaborationClient, data: string | Uint8Array): void {
    if (typeof data === "string") {
      this.handleControlMessage(client, data);
      return;
    }
    const roomId = this.clientRooms.get(client);
    if (!roomId) return;
    if (this.options.requireAuthentication && !this.identities.has(client))
      return;
    const room = roomId ? this.rooms.get(roomId) : undefined;
    if (!room) return;
    // Yjs validates update structure so one malformed client message cannot
    // take down the room server.
    try {
      Y.applyUpdate(room.document, data);
    } catch {
      return;
    }
    room.version += 1;
    client.send(JSON.stringify({ type: "sync-ack" }));
    for (const peer of room.clients) if (peer !== client) peer.send(data);
    const organizationId = room.organizationId;
    if (this.options.persistence && organizationId) {
      const snapshot: SnapshotRecord = {
        organizationId,
        documentId: room.documentId,
        snapshot: Y.encodeStateAsUpdate(room.document),
        version: room.version,
      };
      this.scheduleSnapshot(roomId, snapshot);
    }
  }

  disconnect(client: CollaborationClient): void {
    this.joinRequests.delete(client);
    this.identities.delete(client);
    this.leaveRoom(client);
  }

  // Leaving a room preserves verified identity; disconnecting revokes it even
  // if an asynchronous initial join has not finished yet.
  private leaveRoom(client: CollaborationClient): void {
    const roomId = this.clientRooms.get(client);
    if (!roomId) return;
    this.clientRooms.delete(client);
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.clients.delete(client);
    const presence = room.presence.get(client);
    room.presence.delete(client);
    if (presence)
      this.broadcast(room, client, {
        type: PRESENCE_REMOVE_MESSAGE,
        clientId: presence.clientId,
      });
    if (room.clients.size === 0) this.flushSnapshot(roomId);
  }

  private scheduleSnapshot(roomId: string, snapshot: SnapshotRecord): void {
    this.pendingSnapshots.set(roomId, snapshot);
    const existingTimer = this.snapshotTimers.get(roomId);
    if (existingTimer) clearTimeout(existingTimer);
    this.snapshotTimers.set(
      roomId,
      setTimeout(() => this.flushSnapshot(roomId), 500),
    );
  }

  private flushSnapshot(roomId: string): void {
    const timer = this.snapshotTimers.get(roomId);
    if (timer) clearTimeout(timer);
    this.snapshotTimers.delete(roomId);
    const snapshot = this.pendingSnapshots.get(roomId);
    if (!snapshot || !this.options.persistence) return;
    this.pendingSnapshots.delete(roomId);

    // Serialize writes per room: a slow request must not let an older
    // snapshot finish after a newer one and regress durable state.
    const previous = this.snapshotWrites.get(roomId) ?? Promise.resolve();
    const write = previous
      .catch(() => undefined)
      .then(() => this.options.persistence!.saveSnapshot(snapshot))
      .catch(() => {
        console.error("Failed to persist collaboration snapshot");
      });
    this.snapshotWrites.set(roomId, write);
  }

  private handleControlMessage(
    client: CollaborationClient,
    serialized: string,
  ): void {
    let message: unknown;
    try {
      message = JSON.parse(serialized);
    } catch {
      return;
    }
    if (!isRecord(message)) return;
    if (
      message.type === JOIN_MESSAGE &&
      typeof message.roomId === "string" &&
      message.roomId.length > 0
    ) {
      const identity = this.identities.get(client);
      const organizationId = message.organizationId;
      if (
        !this.options.requireAuthentication ||
        (identity &&
          typeof organizationId === "string" &&
          canAccessWorkspace(identity, organizationId, "edit"))
      )
        this.join(
          client,
          message.roomId,
          typeof organizationId === "string" ? organizationId : undefined,
        );
      return;
    }
    if (message.type !== PRESENCE_MESSAGE) return;
    const roomId = this.clientRooms.get(client);
    const room = roomId ? this.rooms.get(roomId) : undefined;
    const presence = parsePresence(message.presence);
    if (!room || !presence) return;
    room.presence.set(client, presence);
    this.broadcast(room, client, { type: PRESENCE_MESSAGE, presence });
  }

  private join(
    client: CollaborationClient,
    roomId: string,
    organizationId?: string,
  ): void {
    this.leaveRoom(client);
    const request = {};
    this.joinRequests.set(client, request);
    if (this.options.persistence && organizationId) {
      void this.joinPersisted(client, roomId, organizationId, request);
      return;
    }
    const roomKey = organizationId ? `${organizationId}:${roomId}` : roomId;
    let room = this.rooms.get(roomKey);
    if (!room) {
      room = {
        document: new Y.Doc(),
        documentId: roomId,
        clients: new Set(),
        presence: new Map(),
        version: 0,
      };
      this.rooms.set(roomKey, room);
    }
    room.clients.add(client);
    this.clientRooms.set(client, roomKey);
    client.send(Y.encodeStateAsUpdate(room.document));
    client.send(JSON.stringify({ type: "sync-ready" }));
    for (const presence of room.presence.values())
      client.send(JSON.stringify({ type: PRESENCE_MESSAGE, presence }));
  }

  private async joinPersisted(
    client: CollaborationClient,
    roomId: string,
    organizationId: string,
    request: object,
  ): Promise<void> {
    const roomKey = `${organizationId}:${roomId}`;
    const pending = this.loadingRooms.get(roomKey);
    const existing = this.rooms.get(roomKey);
    const roomPromise =
      pending ??
      (existing
        ? Promise.resolve(existing)
        : this.loadPersistedRoom(roomId, organizationId));
    if (!pending) this.loadingRooms.set(roomKey, roomPromise);
    const room = await roomPromise;
    if (!pending) this.loadingRooms.delete(roomKey);
    // Ignore obsolete loads after a disconnect or a newer room selection.
    if (
      this.joinRequests.get(client) !== request ||
      this.identities.get(client)?.organizationId !== organizationId
    )
      return;
    if (!room) {
      client.send(JSON.stringify({ type: "sync-error" }));
      return;
    }
    room.clients.add(client);
    this.clientRooms.set(client, roomKey);
    client.send(Y.encodeStateAsUpdate(room.document));
    client.send(JSON.stringify({ type: "sync-ready" }));
    for (const presence of room.presence.values())
      client.send(JSON.stringify({ type: PRESENCE_MESSAGE, presence }));
  }

  private async loadPersistedRoom(
    roomId: string,
    organizationId: string,
  ): Promise<Room | null> {
    if (!this.options.persistence) return null;
    try {
      await this.options.persistence.upsertWorkspace({
        organizationId,
        name: organizationId,
      });
      const persisted = await this.options.persistence.loadSnapshot(
        organizationId,
        roomId,
      );
      const document = new Y.Doc();
      if (persisted) Y.applyUpdate(document, persisted.snapshot);
      const room: Room = {
        document,
        documentId: roomId,
        clients: new Set(),
        presence: new Map(),
        organizationId,
        version: persisted?.version ?? 0,
      };
      this.rooms.set(`${organizationId}:${roomId}`, room);
      return room;
    } catch {
      console.error("Failed to restore collaboration room");
      return null;
    }
  }

  private broadcast(
    room: Room,
    excluded: CollaborationClient,
    message: Record<string, unknown>,
  ): void {
    const serialized = JSON.stringify(message);
    for (const peer of room.clients)
      if (peer !== excluded) peer.send(serialized);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePresence(value: unknown): Presence | null {
  if (!isRecord(value)) return null;
  const cursor = value.cursor;
  const validCursor =
    cursor === null ||
    (isRecord(cursor) &&
      typeof cursor.x === "number" &&
      Number.isFinite(cursor.x) &&
      typeof cursor.y === "number" &&
      Number.isFinite(cursor.y));
  if (
    typeof value.clientId !== "string" ||
    typeof value.color !== "string" ||
    (typeof value.selectedId !== "string" && value.selectedId !== null) ||
    !validCursor
  )
    return null;
  return {
    clientId: value.clientId,
    color: value.color,
    cursor: cursor as Presence["cursor"],
    selectedId: value.selectedId as string | null,
  };
}
