"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const pg_1 = __importDefault(require("pg"));
const { Client } = pg_1.default;
const url = "wss://stream.binance.com:9443/ws/solusdt@trade";
const wss = new ws_1.WebSocketServer({ port: 2000 });
const client = new Client({
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "alwin",
    database: "mydb",
});
async function setup() {
    await client.connect();
    console.log("Connected to TimeScaleDB");
    await client.query(`
    CREATE TABLE IF NOT EXISTS trades (
      time TIMESTAMPTZ NOT NULL,
      trade_id BIGINT,
      price NUMERIC,
      quantity NUMERIC,
      is_buyer_maker BOOLEAN
    );
  `);
    await client.query(`
    SELECT create_hypertable('trades', 'time', if_not_exists => TRUE);
  `);
    console.log("Table Ready");
}
async function start() {
    await setup();
    wss.on("connection", (ws) => {
        console.log("Client Connected");
        ws.on("close", () => {
            console.log("Client Closed");
        });
    });
    const binanceWs = new ws_1.WebSocket(url);
    let pendingUpdates = [];
    const query = `
    INSERT INTO trades (time, trade_id, price, quantity, is_buyer_maker)
    VALUES (to_timestamp($1 / 1000.0), $2, $3, $4, $5)
  `;
    setInterval(async () => {
        console.log(pendingUpdates.length);
        while (pendingUpdates.length > 0) {
            const trade = pendingUpdates.shift();
            await client.query(query, [trade.T, trade.t, trade.p, trade.q, trade.m]);
        }
        pendingUpdates = [];
    }, 10000);
    binanceWs.on("message", async (msg) => {
        const trade = JSON.parse(msg.toString());
        pendingUpdates.push(trade);
        wss.clients.forEach((c) => {
            if (c.readyState === ws_1.WebSocket.OPEN) {
                c.send(JSON.stringify(trade));
            }
        });
    });
}
start().catch((err) => {
    console.log(err);
});
