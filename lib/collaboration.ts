import * as Y from "yjs";

export const JOIN_MESSAGE = "join";

export type CollaborationClient = {
  send(data: string | Uint8Array): void;
};

type Room = { document: Y.Doc; clients: Set<CollaborationClient> };

// This room hub owns only ephemeral room state. Keeping the transport-neutral
// core separate from WebSocket lets tests exercise collaboration without
// opening ports and leaves persistence for a later milestone.
export class CollaborationRooms {
  private readonly rooms = new Map<string, Room>();
  private readonly clientRooms = new Map<CollaborationClient, string>();

  connect(client: CollaborationClient): void {
    // A reused socket must start without stale room membership.
    this.disconnect(client);
  }

  receive(client: CollaborationClient, data: string | Uint8Array): void {
    if (typeof data === "string") {
      this.handleControlMessage(client, data);
      return;
    }

    const roomId = this.clientRooms.get(client);
    const room = roomId ? this.rooms.get(roomId) : undefined;
    if (!room) return;

    // Yjs validates update structure while applying it. A malformed client
    // update is ignored so one bad message cannot take down the room server.
    try {
      Y.applyUpdate(room.document, data);
    } catch {
      return;
    }

    const update = Y.encodeStateAsUpdate(room.document);
    for (const peer of room.clients) {
      if (peer !== client) peer.send(update);
    }
  }

  disconnect(client: CollaborationClient): void {
    const roomId = this.clientRooms.get(client);
    if (!roomId) return;
    this.clientRooms.delete(client);

    const room = this.rooms.get(roomId);
    if (!room) return;
    room.clients.delete(client);
    // Keep the document while no sockets are connected so a reconnect can
    // recover the room. M8 can replace this process-local lifetime with
    // persistence and an explicit room-retention policy.
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

    if (
      !isRecord(message) ||
      message.type !== JOIN_MESSAGE ||
      typeof message.roomId !== "string" ||
      message.roomId.length === 0
    ) {
      return;
    }
    this.join(client, message.roomId);
  }

  private join(client: CollaborationClient, roomId: string): void {
    this.disconnect(client);
    let room = this.rooms.get(roomId);
    if (!room) {
      room = { document: new Y.Doc(), clients: new Set() };
      this.rooms.set(roomId, room);
    }

    room.clients.add(client);
    this.clientRooms.set(client, roomId);
    // A reconnect receives current room state before future updates.
    client.send(Y.encodeStateAsUpdate(room.document));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
