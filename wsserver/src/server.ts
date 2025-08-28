import { WebSocketServer } from "ws";
import Redis from "ioredis";

const wss = new WebSocketServer({ port: 4000 });
const redis = new Redis();

redis.subscribe("trades", (err) => {
  if (err) {
    console.log(err);
  } else {
    console.log("Successfully subscribed");
  }
});
redis.on("message", (channel, message) => {
  if (channel == "trades") {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        console.log(message);
      }
    });
  }
});
