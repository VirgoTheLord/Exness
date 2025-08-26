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
const url = "wss://stream.binance.com:9443/ws/solusdt@trade";
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
      trade_id BIGINT,
      price NUMERIC,
      quantity NUMERIC,
      is_buyer_maker BOOLEAN,
      asset TEXT
    );
  `);
    await client.query(`
    SELECT create_hypertable('trades', 'time', if_not_exists => TRUE);
  `);
    await client.query(`
    CREATE MATERIALIZED VIEW trades_1m WITH (timescaledb.continuous) AS 
    SELECT time_bucket('1 minute', time) AS timestamp,
           asset,
           FIRST(price, time) AS open_price, 
           LAST(price, time) AS close_price, 
           MAX(price) AS high_price, 
           MIN(price) AS low_price 
    FROM trades 
    GROUP BY timestamp, asset;
  `);
    await client.query(`
    SELECT add_continuous_aggregate_policy(
      'trades_1m',
      start_offset => INTERVAL '1 day',
      end_offset   => INTERVAL '1 minute',
      schedule_interval => INTERVAL '1 minute'
    );
  `);
    await client.query(`
    CREATE MATERIALIZED VIEW trades_5m WITH (timescaledb.continuous) AS 
    SELECT time_bucket('5 minute', time) AS timestamp,
           asset,
           FIRST(price, time) AS open_price, 
           LAST(price, time) AS close_price, 
           MAX(price) AS high_price, 
           MIN(price) AS low_price 
    FROM trades 
    GROUP BY timestamp, asset;
  `);
    await client.query(`
    SELECT add_continuous_aggregate_policy(
      'trades_5m',
      start_offset => INTERVAL '1 day',
      end_offset   => INTERVAL '1 minute',
      schedule_interval => INTERVAL '1 minute'
    );
  `);
    await client.query(`
    CREATE MATERIALIZED VIEW trades_10m WITH (timescaledb.continuous) AS 
    SELECT time_bucket('10 minute', time) AS timestamp,
           asset,
           FIRST(price, time) AS open_price, 
           LAST(price, time) AS close_price, 
           MAX(price) AS high_price, 
           MIN(price) AS low_price 
    FROM trades 
    GROUP BY timestamp, asset;
  `);
    await client.query(`
    SELECT add_continuous_aggregate_policy(
      'trades_10m',
      start_offset => INTERVAL '1 day',
      end_offset   => INTERVAL '1 minute',
      schedule_interval => INTERVAL '1 minute'
    );
  `);
    await client.query(`
    CREATE MATERIALIZED VIEW trades_30m WITH (timescaledb.continuous) AS 
    SELECT time_bucket('30 minute', time) AS timestamp,
           asset,
           FIRST(price, time) AS open_price, 
           LAST(price, time) AS close_price, 
           MAX(price) AS high_price, 
           MIN(price) AS low_price 
    FROM trades 
    GROUP BY timestamp, asset;
  `);
    await client.query(`
    SELECT add_continuous_aggregate_policy(
      'trades_30m',
      start_offset => INTERVAL '1 day',
      end_offset   => INTERVAL '1 minute',
      schedule_interval => INTERVAL '1 minute'
    );
  `);
    console.log("Table Ready");
}
async function start() {
    await setup();
    const binanceWs = new ws_1.WebSocket(url);
    let pendingUpdates = [];
    const query = `
    INSERT INTO trades (time, trade_id, price, quantity, is_buyer_maker,asset)
    VALUES (to_timestamp($1 / 1000.0), $2, $3, $4, $5,$6)
  `;
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
                "SOLUSDT",
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
app.get("/candles/:interval", async (req, res) => {
    const { interval } = req.params;
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
            .json({ error: "Invalid interval. Use 1m, 5m, 10m, 30m" });
    }
    try {
        const result = await client.query(`SELECT timestamp, asset, open_price, close_price, high_price, low_price
       FROM ${view}
       WHERE asset = 'SOLUSDT'
       ORDER BY timestamp DESC
       LIMIT 100`);
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
