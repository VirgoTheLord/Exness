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
const { Client } = pg_1.default;
const markets = ["btcusdt", "ethusdt", "solusdt"];
const streams = markets.map((m) => `${m}@trade`).join("/");
const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
const redis = new ioredis_1.default();
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
      symbol TEXT NOT NULL,
      trade_id BIGINT,
      price NUMERIC,
      quantity NUMERIC,
      is_buyer_maker BOOLEAN
    );
  `);
    await client.query(`SELECT create_hypertable('trades', 'time', if_not_exists => TRUE);`);
    const intervals = ["1m", "5m", "10m", "30m"];
    for (const interval of intervals) {
        await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS trades_${interval} WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('${interval.replace("m", " minute")}', time) AS timestamp,
        symbol,
        FIRST(price, time) AS open_price,
        LAST(price, time) AS close_price,
        MAX(price) AS high_price,
        MIN(price) AS low_price
      FROM trades
      GROUP BY timestamp, symbol;
    `);
        await client.query(`
      SELECT add_continuous_aggregate_policy(
        'trades_${interval}',
        start_offset => INTERVAL '1 day',
        end_offset   => INTERVAL '1 minute',
        schedule_interval => INTERVAL '1 minute'
      );
    `);
    }
}
async function start() {
    await setup();
    const binanceWs = new ws_1.WebSocket(url);
    let pendingUpdates = [];
    const query = `
    INSERT INTO trades (time, trade_id, price, quantity, is_buyer_maker, symbol)
    VALUES (to_timestamp($1 / 1000.0), $2, $3, $4, $5, $6)
  `;
    setInterval(async () => {
        const batch = pendingUpdates.splice(0, pendingUpdates.length);
        for (const update of batch) {
            const { trade, symbol } = update;
            try {
                await client.query(query, [
                    trade.T,
                    trade.t,
                    trade.p,
                    trade.q,
                    trade.m,
                    symbol,
                ]);
            }
            catch (err) {
                console.error("Error inserting trade:", err);
            }
        }
    }, 10000);
    binanceWs.onmessage = (event) => {
        const message = JSON.parse(event.data.toString());
        if (message.stream && message.data) {
            const symbol = message.stream.split("@")[0].toUpperCase();
            const trade = message.data;
            pendingUpdates.push({ trade, symbol });
            redis.publish("trades", JSON.stringify({ ...trade, symbol }));
        }
    };
    binanceWs.on("open", () => {
        console.log("Connected to Binance WebSocket for:", markets.join(", "));
    });
    binanceWs.on("error", (err) => {
        console.error("WebSocket error:", err);
    });
}
start().catch((err) => {
    console.log(err);
});
app.get("/candles/:symbol/:interval", async (req, res) => {
    const { symbol, interval } = req.params;
    const viewMap = {
        "1m": "trades_1m",
        "5m": "trades_5m",
        "10m": "trades_10m",
        "30m": "trades_30m",
    };
    const view = viewMap[interval];
    if (!view) {
        return res
            .status(400)
            .json({ error: "Invalid interval. Use 1m, 5m, 10m, or 30m" });
    }
    try {
        const result = await client.query(`SELECT timestamp, symbol, open_price, close_price, high_price, low_price
       FROM ${view}
       WHERE symbol = $1
       ORDER BY timestamp DESC
       LIMIT 100`, [symbol.toUpperCase()]);
        res.json(result.rows.reverse());
    }
    catch (err) {
        console.error("Error fetching candles:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
const PORT = 2000;
app.listen(PORT, () => {
    console.log(`HTTP server running on port ${PORT}`);
});
