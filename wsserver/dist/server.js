"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const ioredis_1 = __importDefault(require("ioredis"));
const wss = new ws_1.WebSocketServer({ port: 4000 });
const redis = new ioredis_1.default();
redis.subscribe("trades", (err) => {
    if (err) {
        console.log(err);
    }
    else {
        console.log("Successfully subscribed");
    }
});
redis.on("message", (channel, message) => {
    if (channel == "trades") {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
});
