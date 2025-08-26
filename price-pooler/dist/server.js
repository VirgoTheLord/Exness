"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const pg_1 = __importDefault(require("pg"));
const ioredis_1 = __importDefault(require("ioredis"));
//client from pg
const { Client } = pg_1.default;
//binance url
const url = "wss://stream.binance.com:9443/ws/solusdt@trade";
//test dw
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
//ws
// const wss = new WebSocketServer({ port: 2000 });
//redis
const redis = new ioredis_1.default();
const client = new Client({
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "alwin",
    database: "mydb",
});
//this function is to create initial postgres table and populate and create the hypertable also checks if exists for reusabliltiy.
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
//actual worker function that sends the data to the database with the ws
async function start() {
    await setup();
    // wss.on("connection", (ws) => {
    //   console.log("Client Connected");
    //   ws.on("close", () => {
    //     console.log("Client Closed");
    //   });
    // });
    const binanceWs = new ws_1.WebSocket(url);
    let pendingUpdates = [];
    const query = `
    INSERT INTO trades (time, trade_id, price, quantity, is_buyer_maker)
    VALUES (to_timestamp($1 / 1000.0), $2, $3, $4, $5)
  `;
    //batching updated for 10sc then sending afterwards
    setInterval(async () => {
        console.log(pendingUpdates.length);
        while (pendingUpdates.length > 0) {
            const currentTrade = pendingUpdates.shift();
            await client.query(query, [
                currentTrade.T,
                currentTrade.t,
                currentTrade.p,
                currentTrade.q,
                currentTrade.m,
            ]);
            redis.publish("trades", JSON.stringify(currentTrade));
        }
        pendingUpdates = [];
    }, 10000);
    binanceWs.onmessage = (event) => {
        const trade = JSON.parse(event.data.toString());
        pendingUpdates.push(trade);
    };
}
start().catch((err) => {
    console.log(err);
});
//In here is just a code to split up stuff
// app.get("/timechunks/:interval", async (req, res) => {
//   try {
//     const { interval } = req.params;
//     const result = await client.query(
//       `
//       SELECT
//         time_bucket($1, time) AS bucket,
//         first(price::numeric, time) AS open,
//         MAX(price::numeric) AS high,
//         MIN(price::numeric) AS low,
//         last(price::numeric, time) AS close,
//         SUM(quantity::numeric) AS volume
//       FROM trades
//       GROUP BY bucket
//       ORDER BY bucket DESC
//       LIMIT 50;
//       `,
//       [interval]
//     );
//     res.json(result.rows);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Error fetching timechunks" });
//   }
// });
