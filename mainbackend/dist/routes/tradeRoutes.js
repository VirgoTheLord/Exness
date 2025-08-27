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
const latestPrices = {};
redis.subscribe("trades");
redis.on("message", (channel, message) => {
    if (channel === "trades") {
        try {
            const trade = JSON.parse(message);
            const symbol = trade.s;
            const price = parseFloat(trade.p);
            if (symbol && price) {
                latestPrices[symbol.toUpperCase()] = price;
            }
        }
        catch { }
    }
});
tradeRouter.post("/buy", (req, res) => {
    const { user, symbol, quantity } = req.body;
    const price = latestPrices[symbol.toUpperCase()];
    if (!price) {
        return res.status(400).json({ error: "No price available for " + symbol });
    }
    const cost = price * quantity;
    if (exports.userBalances[user] === undefined) {
        exports.userBalances[user] = 10000;
    }
    if (exports.userBalances[user] < cost) {
        return res.status(400).json({ error: "Insufficient balance" });
    }
    exports.userBalances[user] -= cost;
    if (!userHoldings[user])
        userHoldings[user] = [];
    userHoldings[user].push({
        symbol,
        qty: quantity,
        type: "buy",
        startBalance: exports.userBalances[user],
    });
    return res.json({
        user,
        symbol,
        quantity,
        price,
        remainingBalance: exports.userBalances[user],
    });
});
tradeRouter.post("/close", (req, res) => {
    const { user, symbol } = req.body;
    if (!userHoldings[user] || userHoldings[user].length === 0) {
        return res.status(400).json({ error: "No active holdings found" });
    }
    const holdingIndex = userHoldings[user].findIndex((h) => h.symbol.toUpperCase() === symbol.toUpperCase());
    if (holdingIndex === -1) {
        return res.status(400).json({ error: "No active holding for " + symbol });
    }
    const holding = userHoldings[user][holdingIndex];
    const currentPrice = latestPrices[symbol.toUpperCase()];
    if (!currentPrice) {
        return res.status(400).json({ error: "No current price for " + symbol });
    }
    let finalBalance = holding.startBalance + holding.qty * currentPrice;
    exports.userBalances[user] = finalBalance;
    userHoldings[user].splice(holdingIndex, 1);
    return res.json({
        user,
        symbol,
        qty: holding.qty,
        finalBalance,
        price: currentPrice,
    });
});
exports.default = tradeRouter;
