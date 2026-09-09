import * as Y from "yjs";
import type { Presence } from "./collaboration";
import { PRESENCE_MESSAGE, PRESENCE_REMOVE_MESSAGE } from "./collaboration";
import {
  createIndexedDbPersistence,
  type OfflinePersistence,
} from "./offline-persistence";
import { applyYjsUpdate, encodeYjsState, REMOTE_ORIGIN } from "./yjs-document";

export type CollaborationStatus =
  "connecting" | "syncing" | "connected" | "disconnected" | "error";

type CollaborationClientOptions = {
  url: string;
  roomId: string;
  document: Y.Doc;
  onStatusChange?: (status: CollaborationStatus) => void;
  onRemoteUpdate?: () => void;
  clientId: string;
  color: string;
  onPresenceChange?: (presence: Presence[]) => void;
  onPendingChange?: (count: number) => void;
  organizationId: string;
  tokenProvider: () => Promise<string | null>;
  persistence?: OfflinePersistence;
};

// The browser client owns durability and transport lifecycle. Yjs remains the
// source of merge semantics, so retries never require a second conflict model.
export class CollaborationClient {
  private readonly options: CollaborationClientOptions;
  private readonly persistence: OfflinePersistence;
  private readonly ready: Promise<void>;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private connecting = false;
  private syncReady = false;
  private draining = false;
  private persistenceWork = Promise.resolve();
  private acknowledgement: ((accepted: boolean) => void) | null = null;
  private reconnectDelay = 1000;
  private readonly presences = new Map<string, Presence>();

  constructor(options: CollaborationClientOptions) {
    this.options = options;
    this.persistence =
      options.persistence ??
      createIndexedDbPersistence(options.organizationId, options.roomId);
    this.ready = this.restoreLocalState();
    options.document.on("update", this.onLocalUpdate);
  }

  connect(): void {
    if (this.disposed || this.socket || this.connecting) return;
    this.connecting = true;
    void this.ready.then(() => this.connectWithToken());
  }

  dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.options.document.off("update", this.onLocalUpdate);
    this.socket?.close();
    this.socket = null;
  }

  async clearLocalState(): Promise<void> {
    await this.persistence.clear();
    this.options.onPendingChange?.(0);
  }

  sendPresence(update: Pick<Presence, "cursor" | "selectedId">): void {
    const presence: Presence = {
      clientId: this.options.clientId,
      color: this.options.color,
      ...update,
    };
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: PRESENCE_MESSAGE, presence }));
    }
  }

  private async restoreLocalState(): Promise<void> {
    try {
      const state = await this.persistence.load();
      if (!state) return;
      // Restored bytes are already local history; do not enqueue them again.
      applyYjsUpdate(this.options.document, state.document, REMOTE_ORIGIN);
      this.options.onPendingChange?.(state.pending.length);
    } catch {
      this.options.onStatusChange?.("error");
    }
  }

  private async connectWithToken(): Promise<void> {
    const token = await this.options.tokenProvider();
    this.connecting = false;
    if (this.disposed || !token) {
      this.options.onStatusChange?.("disconnected");
      return;
    }
    this.options.onStatusChange?.("connecting");
    const url = new URL(this.options.url);
    url.searchParams.set("token", token);
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    socket.addEventListener("open", this.onOpen);
    socket.addEventListener("message", this.onMessage);
    socket.addEventListener("close", this.onClose);
    socket.addEventListener("error", this.onError);
    this.socket = socket;
  }

  private readonly onOpen = (): void => {
    this.reconnectDelay = 1000;
    this.syncReady = false;
    this.options.onStatusChange?.("syncing");
    this.socket?.send(
      JSON.stringify({
        type: "join",
        roomId: this.options.roomId,
        organizationId: this.options.organizationId,
      }),
    );
  };

  private readonly onMessage = (event: MessageEvent<ArrayBuffer>): void => {
    if (typeof event.data === "string") {
      this.onControlMessage(event.data);
      return;
    }
    const update =
      event.data instanceof ArrayBuffer
        ? new Uint8Array(event.data)
        : new Uint8Array(event.data as unknown as ArrayBuffer);
    applyYjsUpdate(this.options.document, update, REMOTE_ORIGIN);
    this.options.onRemoteUpdate?.();
  };

  private readonly onControlMessage = (serialized: string): void => {
    let message: unknown;
    try {
      message = JSON.parse(serialized);
    } catch {
      return;
    }
    if (!message || typeof message !== "object") return;
    const record = message as Record<string, unknown>;
    if (record.type === "sync-ready") {
      this.syncReady = true;
      void this.drainQueue();
      return;
    }
    if (record.type === "sync-ack") {
      this.acknowledgement?.(true);
      return;
    }
    if (record.type === PRESENCE_MESSAGE && record.presence) {
      const presence = record.presence as Presence;
      this.presences.set(presence.clientId, presence);
    } else if (
      record.type === PRESENCE_REMOVE_MESSAGE &&
      typeof record.clientId === "string"
    ) {
      this.presences.delete(record.clientId);
    } else return;
    this.options.onPresenceChange?.([...this.presences.values()]);
  };

  private readonly onLocalUpdate = (
    update: Uint8Array,
    origin: unknown,
  ): void => {
    // IndexedDB transactions are serialized here so rapid pointer moves cannot
    // read the same old queue and overwrite one another's pending updates.
    this.persistenceWork = this.persistenceWork.then(() =>
      this.persistLocalUpdate(update, origin === REMOTE_ORIGIN),
    );
  };

  private async persistLocalUpdate(
    update: Uint8Array,
    remote: boolean,
  ): Promise<void> {
    try {
      await this.persistence.persist(
        encodeYjsState(this.options.document),
        remote ? undefined : update,
      );
      const state = await this.persistence.load();
      this.options.onPendingChange?.(state?.pending.length ?? 0);
      if (!remote) void this.drainQueue();
    } catch {
      this.options.onStatusChange?.("error");
    }
  }

  private async drainQueue(): Promise<void> {
    if (
      this.draining ||
      !this.syncReady ||
      this.socket?.readyState !== WebSocket.OPEN
    )
      return;
    this.draining = true;
    try {
      const state = await this.persistence.load();
      for (const entry of state?.pending ?? []) {
        if (!this.syncReady || this.socket?.readyState !== WebSocket.OPEN)
          break;
        this.socket.send(entry.update);
        const accepted = await new Promise<boolean>((resolve) => {
          this.acknowledgement = (wasAccepted) => {
            this.acknowledgement = null;
            resolve(wasAccepted);
          };
        });
        if (!accepted || this.socket?.readyState !== WebSocket.OPEN) break;
        await this.persistence.acknowledge(entry.id);
      }
      const remaining = await this.persistence.load();
      this.options.onPendingChange?.(remaining?.pending.length ?? 0);
      if (!remaining?.pending.length)
        this.options.onStatusChange?.("connected");
    } catch {
      this.options.onStatusChange?.("error");
    } finally {
      this.draining = false;
    }
  }

  private readonly onClose = (): void => {
    this.socket = null;
    this.syncReady = false;
    this.draining = false;
    this.acknowledgement?.(false);
    this.acknowledgement = null;
    if (this.disposed) return;
    this.options.onStatusChange?.("disconnected");
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  };

  private readonly onError = (): void => {
    this.socket?.close();
  };
}
