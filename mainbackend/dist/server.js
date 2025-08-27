"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const tradeRoutes_1 = __importDefault(require("./routes/tradeRoutes"));
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.use("/user", userRoutes_1.default);
app.use("/trade", tradeRoutes_1.default);
const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "alwin",
    database: "mydb",
});
app.get("/candles/:symbol/:interval", async (req, res) => {
    const { symbol, interval } = req.params;
    const viewMap = {
        "1m": "trades_1m",
        "5m": "trades_5m",
        "10m": "trades_10m",
        "30m": "trades_30m",
    };
    const intervalKey = interval;
    const view = viewMap[intervalKey];
    if (!view) {
        return res.status(400).json({ error: "Invalid interval" });
    }
    try {
        const result = await pool.query(`SELECT timestamp, symbol, open_price, close_price, high_price, low_price
       FROM ${view}
       WHERE symbol = $1
       ORDER BY timestamp DESC
       LIMIT 100`, [symbol.toUpperCase()]);
        res.json(result.rows.reverse());
    }
    catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});
const PORT = 9000;
app.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
});
