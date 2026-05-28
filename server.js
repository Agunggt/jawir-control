// ============================================================
//  JAWIR LIGHTING — WebSocket Relay Server
//  ws://68.183.229.97:8080
//  Node.js + Express + ws
// ============================================================

const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ── Room registry  { roomId: Set<ws> } ──
const rooms = {};

// ── Helpers ──
function joinRoom(roomId, ws) {
  if (!rooms[roomId]) rooms[roomId] = new Set();
  rooms[roomId].add(ws);
}

function leaveRoom(ws) {
  for (const roomId of Object.keys(rooms)) {
    rooms[roomId].delete(ws);
    // Hapus room jika sudah kosong
    if (rooms[roomId].size === 0) {
      delete rooms[roomId];
      console.log(`[JWWS] Room ${roomId} deleted (empty)`);
    }
  }
}

function broadcast(roomId, message, senderWs) {
  const room = rooms[roomId];
  if (!room) return;
  room.forEach(client => {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ── WebSocket handler ──
wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress || "unknown";
  console.log(`[JWWS] DEVICE CONNECT  ip=${ip}  total=${wss.clients.size}`);

  ws._roomId = null;

  ws.on("message", (rawMsg) => {
    try {
      const message = rawMsg.toString();
      const data = JSON.parse(message);
      const roomId = data.room;

      if (!roomId) return; // abaikan pesan tanpa room

      // Daftarkan ke room jika belum
      if (ws._roomId !== roomId) {
        if (ws._roomId) leaveRoom(ws); // keluar dari room lama
        ws._roomId = roomId;
        joinRoom(roomId, ws);
        const size = rooms[roomId] ? rooms[roomId].size : 0;
        console.log(`[JWWS] Room ${roomId}  members=${size}  type=${data.type || "?"}`);
      }

      // Relay ke semua member lain di room yang sama
      broadcast(roomId, message, ws);

    } catch (err) {
      console.warn("[JWWS] Parse error:", err.message);
    }
  });

  ws.on("close", (code, reason) => {
    const roomId = ws._roomId;
    console.log(`[JWWS] DEVICE DISCONNECT  room=${roomId || "none"}  code=${code}`);
    leaveRoom(ws);
  });

  ws.on("error", (err) => {
    console.warn("[JWWS] Socket error:", err.message);
  });
});

// ── HTTP status endpoint ──
app.get("/", (req, res) => {
  const roomList = Object.entries(rooms).map(([id, set]) => `${id}(${set.size})`).join(", ");
  res.send(`
    <pre style="font-family:monospace;background:#111;color:#0f0;padding:20px">
JAWIR WS RELAY — ONLINE
=======================
Clients  : ${wss.clients.size}
Rooms    : ${Object.keys(rooms).length}  [${roomList || "none"}]
Uptime   : ${Math.floor(process.uptime())}s
Node     : ${process.version}
    </pre>
  `);
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    clients: wss.clients.size,
    rooms: Object.keys(rooms).length,
    uptime: Math.floor(process.uptime())
  });
});

// ── Start ──
const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[JWWS] JAWIR WebSocket Relay RUNNING on port ${PORT}`);
  console.log(`[JWWS] HTTP status → http://localhost:${PORT}/`);
});

// ── Graceful shutdown ──
process.on("SIGTERM", () => {
  console.log("[JWWS] SIGTERM — closing server");
  wss.clients.forEach(ws => ws.close());
  server.close(() => process.exit(0));
});
