import { createServer } from "node:http";
import { WebSocketServer, type RawData } from "ws";
import { CollaborationRooms } from "../lib/collaboration";

const port = Number(process.env.PORT ?? 8080);
const rooms = new CollaborationRooms();
const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  response.writeHead(404);
  response.end();
});
const websocketServer = new WebSocketServer({ server: httpServer });

// Railway needs one long-lived process for WebSockets; the HTTP health route
// gives its deploy platform a cheap readiness check without involving rooms.
websocketServer.on("connection", (socket) => {
  rooms.connect(socket);
  socket.on("message", (data, isBinary) => {
    rooms.receive(socket, isBinary ? rawDataToUpdate(data) : data.toString());
  });
  socket.on("close", () => rooms.disconnect(socket));
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Collaboration server listening on port ${port}`);
});

function rawDataToUpdate(data: RawData): Uint8Array {
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data);
}
