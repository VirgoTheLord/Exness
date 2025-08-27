import { WebSocket, WebSocketServer } from "ws";
import Redis from "ioredis";
const wss = new WebSocketServer({ port: 4000 });
const redis = new Redis();

wss.on("connection", (ws) => {
  console.log("Wesocket connection established.");

  ws.on("open", () => {
    console.log("Websocket opened");
  });

  ws.on("close", () => {
    console.log("Client Disconnected");
  });
});

redis.subscribe("trades", (error) => {
  if (error) {
    console.log(error);
  } else {
    console.log("Successfully signed into trades channel");
  }
});
redis.on("message", (channel, message) => {
  if (channel === "trades") {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
});
