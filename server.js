const express = require("express");
const https = require("https");
const fs = require("fs");
const WebSocket = require("ws");

const app = express();

const server = https.createServer({
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem")
}, app);

const wss = new WebSocket.Server({ server });
const rooms = {};

wss.on("connection", (ws, req) => {
  console.log("DEVICE CONNECT");
  ws._roomId = null;

  ws.on("message", (rawMsg) => {
    try {
      const data = JSON.parse(rawMsg.toString());
      const roomId = data.room;
      if (!roomId) return;
      if (ws._roomId !== roomId) {
        if (ws._roomId && rooms[ws._roomId]) {
          rooms[ws._roomId].delete(ws);
        }
        ws._roomId = roomId;
        if (!rooms[roomId]) rooms[roomId] = new Set();
        rooms[roomId].add(ws);
      }
      rooms[roomId].forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(rawMsg.toString());
        }
      });
    } catch(err) {
      console.log(err);
    }
  });

  ws.on("close", () => {
    if (ws._roomId && rooms[ws._roomId]) {
      rooms[ws._roomId].delete(ws);
    }
  });
});

app.get("/", (req, res) => {
  res.send("JAWIR WSS ONLINE");
});

server.listen(8443, "0.0.0.0", () => {
  console.log("RUNNING WSS 8443");
});
