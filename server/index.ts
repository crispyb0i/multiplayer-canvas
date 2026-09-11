import { createServer } from "node:http";
import { WebSocketServer, type RawData } from "ws";
import { loadEnvConfig } from "@next/env";
import { verifyToken } from "@clerk/backend";
import { CollaborationRooms } from "../lib/collaboration";
import {
  loadSnapshot,
  saveSnapshot,
  upsertWorkspace,
} from "../lib/persistence";

// The standalone WebSocket process does not pass through Next's runtime, so it
// must load the same local environment file before reading Clerk and database
// configuration.
loadEnvConfig(process.cwd());

const port = Number(process.env.PORT ?? 8080);
const rooms = new CollaborationRooms({
  requireAuthentication: true,
  persistence: { loadSnapshot, saveSnapshot, upsertWorkspace },
});
const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        status: "ok",
        service: "multiplayer-canvas-collaboration",
        uptimeSeconds: Math.floor(process.uptime()),
      }),
    );
    return;
  }
  response.writeHead(404);
  response.end();
});
const websocketServer = new WebSocketServer({
  server: httpServer,
  maxPayload: 2 * 1024 * 1024,
});

// Railway needs one long-lived process for WebSockets; the HTTP health route
// gives its deploy platform a cheap readiness check without involving rooms.
websocketServer.on("connection", async (socket, request) => {
  const pendingMessages: Array<string | Uint8Array> = [];
  let authenticated = false;
  let pendingBytes = 0;
  // Register cleanup before awaiting authentication: closed sockets must never
  // be added to a room by a late verification result.
  socket.on("close", () => rooms.disconnect(socket));
  socket.on("error", () => socket.close());

  // The browser sends `join` immediately after its socket opens. Buffering
  // messages while Clerk verification is in flight avoids losing that first
  // packet because authentication is asynchronous.
  socket.on("message", (data, isBinary) => {
    const message = isBinary ? rawDataToUpdate(data) : data.toString();
    if (!authenticated) {
      pendingBytes +=
        typeof message === "string"
          ? Buffer.byteLength(message)
          : message.byteLength;
      if (pendingMessages.length >= 16 || pendingBytes > 2 * 1024 * 1024) {
        socket.close(1009, "Authentication buffer exceeded");
        return;
      }
      pendingMessages.push(message);
      return;
    }
    rooms.receive(socket, message);
  });

  const identity = await authenticateRequest(request.url);
  if (socket.readyState !== socket.OPEN) return;
  if (!identity) {
    socket.close(1008, "Authentication required");
    return;
  }
  rooms.connect(socket);
  rooms.authenticate(socket, identity);
  authenticated = true;
  for (const message of pendingMessages) rooms.receive(socket, message);
});

async function authenticateRequest(requestUrl: string | undefined): Promise<{
  userId: string;
  organizationId: string;
  organizationRole: string;
} | null> {
  if (!process.env.CLERK_SECRET_KEY || !requestUrl) {
    return null;
  }
  const token = new URL(requestUrl, "http://localhost").searchParams.get(
    "token",
  );
  if (!token) {
    return null;
  }
  try {
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const organizationClaims =
      typeof claims.o === "object" && claims.o !== null
        ? (claims.o as Record<string, unknown>)
        : null;
    const organizationId =
      typeof claims.org_id === "string"
        ? claims.org_id
        : typeof organizationClaims?.id === "string"
          ? organizationClaims.id
          : null;
    const organizationRole =
      typeof claims.org_role === "string"
        ? claims.org_role
        : typeof organizationClaims?.rol === "string"
          ? organizationClaims.rol
          : null;
    const normalizedOrganizationRole =
      organizationRole === "admin"
        ? "org:admin"
        : organizationRole === "member"
          ? "org:member"
          : organizationRole;
    if (
      typeof claims.sub !== "string" ||
      !organizationId ||
      !normalizedOrganizationRole
    ) {
      return null;
    }
    return {
      userId: claims.sub,
      organizationId,
      organizationRole: normalizedOrganizationRole,
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
