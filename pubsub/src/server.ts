import { WebSocket, WebSocketServer } from "ws";
import Redis from "ioredis";
const wss = new WebSocketServer({ port: 4000 });
const redis = new Redis();

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
