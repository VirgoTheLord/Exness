import { WebSocket } from "ws";
import pkg from "pg";
import Redis from "ioredis";

const { Pool } = pkg;
const redis = new Redis();

const markets = ["SOLUSDT", "ETHUSDT", "BTCUSDT"];
const stream = markets.map((m) => `${m}@trade`).join("/");
const url = `wss://stream.binance.com:9443/stream?streams=${stream}`;

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "alwin",
  database: "mydb",
});

const tradeWs = new WebSocket(url);

const query = `
    INSERT INTO trades (time, price, quantity, is_buyer_maker, symbol)
    VALUES (to_timestamp($1 / 1000.0), $2, $3, $4, $5)
  `;

tradeWs.onopen = () => {
  console.log("Trade Websocket has been connected to");
};

const updates: { trade: any }[] = [];

setInterval(async () => {
  const batch = updates.splice(0, updates.length);
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
    } catch (error) {
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
