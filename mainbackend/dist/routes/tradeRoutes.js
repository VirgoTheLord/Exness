"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userBalances = void 0;
const express_1 = __importDefault(require("express"));
const ioredis_1 = __importDefault(require("ioredis"));
const tradeRouter = express_1.default.Router();
const redis = new ioredis_1.default();
exports.userBalances = {
    user1: 10000,
};
const userHoldings = {};
const latestAsk = {};
const latestBid = {};
redis.subscribe("trades");
redis.on("message", (channel, message) => {
    if (channel === "trades") {
        try {
            const trade = JSON.parse(message);
            const symbol = trade.s.toUpperCase();
            const ask = parseFloat(trade.ask);
            const bid = parseFloat(trade.bid);
            if (symbol) {
                latestAsk[symbol] = ask;
                latestBid[symbol] = bid;
            }
        }
        catch (err) {
            console.error("Error parsing trade message:", err);
        }
    }
});
// ===== Buy (long) =====
tradeRouter.post("/buy", (req, res) => {
    const { user, symbol, quantity } = req.body;
    const sym = symbol.toUpperCase();
    const askPrice = latestAsk[sym];
    if (!askPrice)
        return res.status(400).json({ error: "No ask price available" });
    if (exports.userBalances[user] === undefined)
        exports.userBalances[user] = 10000;
    const cost = askPrice * quantity;
    if (exports.userBalances[user] < cost)
        return res.status(400).json({ error: "Insufficient balance" });
    exports.userBalances[user] -= cost;
    if (!userHoldings[user])
        userHoldings[user] = [];
    userHoldings[user].push({
        symbol: sym,
        qty: quantity,
        type: "buy",
        startBalance: exports.userBalances[user],
        price: askPrice,
    });
    return res.json({
        user,
        symbol: sym,
        qty: quantity,
        buyPrice: askPrice,
        remainingBalance: exports.userBalances[user],
    });
});
// ===== Close buy (long) =====
tradeRouter.post("/close-buy", (req, res) => {
    const { user, symbol } = req.body;
    const sym = symbol.toUpperCase();
    if (!userHoldings[user] || userHoldings[user].length === 0)
        return res.status(400).json({ error: "No active holdings" });
    const index = userHoldings[user].findIndex((h) => h.symbol === sym && h.type === "buy");
    if (index === -1)
        return res.status(400).json({ error: "No active long for " + sym });
    const holding = userHoldings[user][index];
    const bidPrice = latestBid[sym];
    if (!bidPrice)
        return res.status(400).json({ error: "No bid price available to close" });
    const pnl = holding.qty * (bidPrice - holding.price);
    exports.userBalances[user] += holding.qty * bidPrice;
    userHoldings[user].splice(index, 1);
    return res.json({
        user,
        symbol: sym,
        qty: holding.qty,
        buyPrice: holding.price,
        sellPrice: bidPrice,
        pnl,
        updatedBalance: exports.userBalances[user],
    });
});
// ===== Short-sell =====
tradeRouter.post("/sell", (req, res) => {
    const { user, symbol, quantity, margin } = req.body;
    const sym = symbol.toUpperCase();
    const bidPrice = latestBid[sym];
    if (!bidPrice)
        return res.status(400).json({ error: "No bid price available" });
    if (exports.userBalances[user] === undefined)
        exports.userBalances[user] = 10000;
    if (exports.userBalances[user] < margin)
        return res.status(400).json({ error: "Insufficient balance for margin" });
    exports.userBalances[user] -= margin;
    if (!userHoldings[user])
        userHoldings[user] = [];
    userHoldings[user].push({
        symbol: sym,
        qty: quantity,
        type: "short",
        startBalance: exports.userBalances[user],
        price: bidPrice, // sold at
        margin,
    });
    return res.json({
        user,
        symbol: sym,
        qty: quantity,
        sellPrice: bidPrice,
        margin,
        remainingBalance: exports.userBalances[user],
    });
});
// ===== Close short =====
tradeRouter.post("/close-short", (req, res) => {
    const { user, symbol } = req.body;
    const sym = symbol.toUpperCase();
    if (!userHoldings[user] || userHoldings[user].length === 0)
        return res.status(400).json({ error: "No active short positions" });
    const index = userHoldings[user].findIndex((h) => h.symbol === sym && h.type === "short");
    if (index === -1)
        return res.status(400).json({ error: "No active short for " + sym });
    const short = userHoldings[user][index];
    const askPrice = latestAsk[sym];
    if (!askPrice)
        return res
            .status(400)
            .json({ error: "No ask price available to close short" });
    const pnl = short.qty * (short.price - askPrice); // profit/loss
    exports.userBalances[user] += (short.margin ?? 0) + pnl;
    userHoldings[user].splice(index, 1);
    return res.json({
        user,
        symbol: sym,
        qty: short.qty,
        sellPrice: short.price,
        closingPrice: askPrice,
        pnl,
        updatedBalance: exports.userBalances[user],
    });
});
// ===== Balance =====
tradeRouter.get("/balance", (req, res) => {
    const user = req.query.user;
    if (!user)
        return res.status(400).json({ message: "User Required" });
    if (exports.userBalances[user] === undefined)
        exports.userBalances[user] = 10000;
    return res.json({ user, balance: exports.userBalances[user] });
});
exports.default = tradeRouter;
