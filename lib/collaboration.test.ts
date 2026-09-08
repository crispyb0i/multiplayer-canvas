import { describe, expect, it } from "vitest";
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
    expect(first.messages).toEqual([]);
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
});
