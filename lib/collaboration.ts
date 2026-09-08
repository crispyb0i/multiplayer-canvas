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
  private readonly rooms = new Map<string, Room>();
  private readonly clientRooms = new Map<CollaborationClient, string>();
  private readonly identities = new Map<
    CollaborationClient,
    CollaborationIdentity
  >();
  private readonly loadingRooms = new Map<string, Promise<Room | null>>();

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
    const update = Y.encodeStateAsUpdate(room.document);
    room.version += 1;
    for (const peer of room.clients) if (peer !== client) peer.send(update);
    const organizationId = room.organizationId;
    if (this.options.persistence && organizationId) {
      const snapshot: SnapshotRecord = {
        organizationId,
        documentId: room.documentId,
        snapshot: update,
        version: room.version,
      };
      void this.options.persistence.saveSnapshot(snapshot).catch((error) => {
        // Keep serving the in-memory CRDT, but surface persistence failure so
        // operations can alert/retry instead of pretending data was durable.
        console.error("Failed to persist collaboration snapshot", error);
      });
    }
  }

  disconnect(client: CollaborationClient): void {
    const roomId = this.clientRooms.get(client);
    if (!roomId) return;
    this.clientRooms.delete(client);
    this.identities.delete(client);
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
    this.disconnect(client);
    if (this.options.persistence && organizationId) {
      void this.joinPersisted(client, roomId, organizationId);
      return;
    }
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        document: new Y.Doc(),
        documentId: roomId,
        clients: new Set(),
        presence: new Map(),
        version: 0,
      };
      this.rooms.set(roomId, room);
    }
    room.clients.add(client);
    this.clientRooms.set(client, roomId);
    client.send(Y.encodeStateAsUpdate(room.document));
    for (const presence of room.presence.values())
      client.send(JSON.stringify({ type: PRESENCE_MESSAGE, presence }));
  }

  private async joinPersisted(
    client: CollaborationClient,
    roomId: string,
    organizationId: string,
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
    if (!room || this.identities.get(client)?.organizationId !== organizationId)
      return;
    room.clients.add(client);
    this.clientRooms.set(client, roomKey);
    client.send(Y.encodeStateAsUpdate(room.document));
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
    } catch (error) {
      console.error("Failed to restore collaboration room", error);
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
