"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const ioredis_1 = __importDefault(require("ioredis"));
const wss = new ws_1.WebSocketServer({ port: 4000 });
const redis = new ioredis_1.default();
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
    }
    else {
        console.log("Successfully signed into trades channel");
    }
});
redis.on("message", (channel, message) => {
    if (channel === "trades") {
        wss.clients.forEach((client) => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
});
