import { WebSocket } from "ws";
import pkg from "pg";
import Redis from "ioredis";

const { Client } = pkg;

const markets = ["btcusdt", "ethusdt", "solusdt"];
const streams = markets.map((m) => `${m}@trade`).join("/");
const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

const redis = new Redis();

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

  await client.query(
    `SELECT create_hypertable('trades', 'time', if_not_exists => TRUE);`
  );

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

  const binanceWs = new WebSocket(url);

  let pendingUpdates: { trade: any; symbol: string }[] = [];

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
      } catch (err) {
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
