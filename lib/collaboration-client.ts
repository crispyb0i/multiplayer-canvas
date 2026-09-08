import * as Y from "yjs";
import { applyYjsUpdate, encodeYjsState } from "./yjs-document";

export type CollaborationStatus = "connecting" | "connected" | "disconnected";

type CollaborationClientOptions = {
  url: string;
  roomId: string;
  document: Y.Doc;
  onStatusChange?: (status: CollaborationStatus) => void;
  onRemoteUpdate?: () => void;
};

// This browser client owns only the WebSocket lifecycle. Yjs remains the
// source of merge semantics, which keeps reconnect and transport concerns out
// of the editor component.
export class CollaborationClient {
  private readonly options: CollaborationClientOptions;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(options: CollaborationClientOptions) {
    this.options = options;
    options.document.on("update", this.onLocalUpdate);
  }

  connect(): void {
    if (this.disposed || this.socket) return;
    this.options.onStatusChange?.("connecting");
    const socket = new WebSocket(this.options.url);
    socket.binaryType = "arraybuffer";
    socket.addEventListener("open", this.onOpen);
    socket.addEventListener("message", this.onMessage);
    socket.addEventListener("close", this.onClose);
    socket.addEventListener("error", this.onError);
    this.socket = socket;
  }

  dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.options.document.off("update", this.onLocalUpdate);
    this.socket?.close();
    this.socket = null;
  }

  private readonly onOpen = (): void => {
    this.options.onStatusChange?.("connected");
    this.socket?.send(
      JSON.stringify({ type: "join", roomId: this.options.roomId }),
    );
    // Send local edits made while disconnected so the room can merge them.
    this.socket?.send(encodeYjsState(this.options.document));
  };

  private readonly onMessage = (event: MessageEvent<ArrayBuffer>): void => {
    const update =
      event.data instanceof ArrayBuffer
        ? new Uint8Array(event.data)
        : new Uint8Array(event.data as unknown as ArrayBuffer);
    applyYjsUpdate(this.options.document, update);
    this.options.onRemoteUpdate?.();
  };

  private readonly onLocalUpdate = (
    update: Uint8Array,
    origin: unknown,
  ): void => {
    if (origin === this || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(update);
  };

  private readonly onClose = (): void => {
    this.socket = null;
    if (this.disposed) return;
    this.options.onStatusChange?.("disconnected");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1000);
  };

  private readonly onError = (): void => {
    this.socket?.close();
  };
}
