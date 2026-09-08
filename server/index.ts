import { createServer } from "node:http";
import { WebSocketServer, type RawData } from "ws";
import { verifyToken } from "@clerk/backend";
import { CollaborationRooms } from "../lib/collaboration";

const port = Number(process.env.PORT ?? 8080);
const rooms = new CollaborationRooms({ requireAuthentication: true });
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
websocketServer.on("connection", async (socket, request) => {
  const identity = await authenticateRequest(request.url);
  if (!identity) {
    socket.close(1008, "Authentication required");
    return;
  }
  rooms.connect(socket);
  rooms.authenticate(socket, identity);
  socket.on("message", (data, isBinary) => {
    rooms.receive(socket, isBinary ? rawDataToUpdate(data) : data.toString());
  });
  socket.on("close", () => rooms.disconnect(socket));
});

async function authenticateRequest(requestUrl: string | undefined): Promise<{
  userId: string;
  organizationId: string;
  organizationRole: string;
} | null> {
  if (!process.env.CLERK_SECRET_KEY || !requestUrl) return null;
  const token = new URL(requestUrl, "http://localhost").searchParams.get(
    "token",
  );
  if (!token) return null;
  try {
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    if (
      typeof claims.sub !== "string" ||
      typeof claims.org_id !== "string" ||
      typeof claims.org_role !== "string"
    )
      return null;
    return {
      userId: claims.sub,
      organizationId: claims.org_id,
      organizationRole: claims.org_role,
    };
  } catch {
    return null;
  }
}

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Collaboration server listening on port ${port}`);
});

function rawDataToUpdate(data: RawData): Uint8Array {
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data);
}
