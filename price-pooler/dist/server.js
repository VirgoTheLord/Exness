"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const pg_1 = __importDefault(require("pg"));
const ioredis_1 = __importDefault(require("ioredis"));
const { Pool } = pg_1.default;
const redis = new ioredis_1.default();
const markets = ["SOLUSDT", "ETHUSDT", "BTCUSDT"];
const stream = markets.map((m) => `${m.toLowerCase()}@trade`).join("/");
const url = `wss://stream.binance.com:9443/stream?streams=${stream}`;
const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "alwin",
    database: "mydb",
});
const tradeWs = new ws_1.WebSocket(url);
const query = `
    INSERT INTO trades (time, price, quantity, is_buyer_maker, symbol)
    VALUES (to_timestamp($1 / 1000.0), $2, $3, $4, $5)
  `;
tradeWs.onopen = () => {
    console.log("Trade Websocket has been connected to");
};
const updates = [];
setInterval(async () => {
    const batch = updates.splice(0, updates.length);
    console.log(batch.length);
    for (const update of batch) {
        const { trade } = update;
        try {
            await pool.query(query, [
                trade.T,
                trade.p,
                trade.q,
                trade.m,
                trade.symbol,
            ]);
        }
        catch (error) {
            console.log("Error populating db");
        }
    }
}, 10000);
tradeWs.onmessage = (incoming) => {
    const message = JSON.parse(incoming.data.toString());
    //stream to say which market and data the actual trade data
    if (message.data && message.stream) {
        const symbol = message.stream.split("@")[0].toUpperCase();
        const trade = message.data;
        const price = parseFloat(trade.p);
        const spread = 0.025;
        const ask = price * (1 + spread / 2);
        const bid = price * (1 - spread / 2);
        const spreadTrade = { ...trade, symbol, ask, bid };
        updates.push({ trade: spreadTrade });
        redis.publish("trades", JSON.stringify(spreadTrade));
    }
};
tradeWs.onclose = () => {
    console.log("Trade Websocket has been disconnected from");
};
