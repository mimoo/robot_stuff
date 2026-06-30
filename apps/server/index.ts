import { RoomManager, type SocketData } from "./rooms";

const PORT = Number(process.env.PORT ?? 3001);
const manager = new RoomManager();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

const server = Bun.serve<SocketData, {}>({
  port: PORT,
  idleTimeout: 120,

  async fetch(req, server) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    // Create a room and return its id.
    if (url.pathname === "/api/rooms" && req.method === "POST") {
      let name = "Robot Room";
      try {
        const body = (await req.json()) as { name?: string };
        if (body?.name) name = String(body.name);
      } catch {
        /* empty body is fine */
      }
      const roomId = manager.createRoom(name);
      return json({ roomId });
    }

    // Check a room exists (lets the client show a friendly error).
    if (url.pathname.startsWith("/api/rooms/") && req.method === "GET") {
      const id = url.pathname.slice("/api/rooms/".length);
      return json({ exists: manager.hasRoom(id) });
    }

    // WebSocket upgrade: /ws?room=..&pid=..&name=..
    if (url.pathname === "/ws") {
      const roomId = url.searchParams.get("room") ?? "";
      const playerId = url.searchParams.get("pid") ?? "";
      const name = url.searchParams.get("name") ?? "Player";
      if (!roomId || !playerId) {
        return new Response("missing room or pid", { status: 400, headers: CORS });
      }
      const ok = server.upgrade(req, {
        data: { roomId, playerId, name } satisfies SocketData,
      });
      if (ok) return undefined;
      return new Response("upgrade failed", { status: 400, headers: CORS });
    }

    return new Response("not found", { status: 404, headers: CORS });
  },

  websocket: {
    open(ws) {
      manager.onOpen(ws);
    },
    message(ws, message) {
      manager.onMessage(ws, typeof message === "string" ? message : message.toString());
    },
    close(ws) {
      manager.onClose(ws);
    },
  },
});

manager.server = server;
console.log(`🤖 robot-server listening on http://localhost:${server.port}`);
