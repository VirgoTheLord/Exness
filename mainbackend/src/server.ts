import express from "express";
import cors from "cors";
import userRouter from "./routes/userRoutes";
import tradeRouter from "./routes/tradeRoutes";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
app.use(express.json());
app.use(cors());
app.use("/user", userRouter);
app.use("/trade", tradeRouter);

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "alwin",
  database: "mydb",
});

app.get("/candles/:symbol/:interval", async (req, res) => {
  const { symbol, interval } = req.params;
  const viewMap: Record<"1m" | "5m" | "10m" | "30m", string> = {
    "1m": "trades_1m",
    "5m": "trades_5m",
    "10m": "trades_10m",
    "30m": "trades_30m",
  };
  const intervalKey = interval as "1m" | "5m" | "10m" | "30m";
  const view = viewMap[intervalKey];
  if (!view) {
    return res.status(400).json({ error: "Invalid interval" });
  }
  try {
    const result = await pool.query(
      `SELECT timestamp, symbol, open_price, close_price, high_price, low_price
       FROM ${view}
       WHERE symbol = $1
       ORDER BY timestamp DESC
       LIMIT 100`,
      [symbol.toUpperCase()]
    );
    res.json(result.rows.reverse());
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = 9000;
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
