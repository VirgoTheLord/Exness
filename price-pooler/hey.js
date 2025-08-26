const { WebSocket } = require("ws");

const ws = new WebSocket("ws://localhost:2000");

ws.on("open", () => console.log("Connected to local WS"));
ws.on("message", (data) => {
  console.log("Trade update:", JSON.parse(data));
});
