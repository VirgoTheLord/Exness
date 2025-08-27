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
// latest ask/bid prices from stream
const latestAsk = {};
const latestBid = {};
redis.subscribe("trades");
redis.on("message", (channel, message) => {
    if (channel === "trades") {
        try {
            const trade = JSON.parse(message);
            const symbol = trade.s.toUpperCase();
            const ask = parseFloat(trade.ask); // buy price
            const bid = parseFloat(trade.bid); // sell price
            if (symbol && !isNaN(ask) && !isNaN(bid)) {
                latestAsk[symbol] = ask;
                latestBid[symbol] = bid;
            }
        }
        catch (err) {
            console.error("Error parsing trade message:", err);
        }
    }
});
// BUY route
tradeRouter.post("/buy", (req, res) => {
    const { user, symbol, quantity } = req.body;
    const sym = symbol.toUpperCase();
    const askPrice = latestAsk[sym];
    if (!askPrice) {
        return res.status(400).json({ error: "No ask price available for " + sym });
    }
    if (exports.userBalances[user] === undefined) {
        exports.userBalances[user] = 10000;
    }
    const cost = askPrice * quantity;
    if (exports.userBalances[user] < cost) {
        return res.status(400).json({ error: "Insufficient balance" });
    }
    exports.userBalances[user] -= cost;
    if (!userHoldings[user])
        userHoldings[user] = [];
    userHoldings[user].push({
        symbol: sym,
        qty: quantity,
        type: "buy",
        startBalance: exports.userBalances[user],
        buyPrice: askPrice,
    });
    return res.json({
        user,
        symbol: sym,
        quantity,
        buyPrice: askPrice,
        remainingBalance: exports.userBalances[user],
    });
});
// CLOSE route
tradeRouter.post("/close", (req, res) => {
    const { user, symbol } = req.body;
    const sym = symbol.toUpperCase();
    if (!userHoldings[user] || userHoldings[user].length === 0) {
        return res.status(400).json({ error: "No active holdings found" });
    }
    const holdingIndex = userHoldings[user].findIndex((h) => h.symbol === sym);
    if (holdingIndex === -1) {
        return res.status(400).json({ error: "No active holding for " + sym });
    }
    const holding = userHoldings[user][holdingIndex];
    const bidPrice = latestBid[sym];
    if (!bidPrice) {
        return res.status(400).json({ error: "No bid price available for " + sym });
    }
    const finalBalance = exports.userBalances[user] + bidPrice * holding.qty;
    exports.userBalances[user] = finalBalance;
    userHoldings[user].splice(holdingIndex, 1);
    return res.json({
        user,
        symbol: sym,
        qty: holding.qty,
        buyPrice: holding.buyPrice,
        sellPrice: bidPrice,
        finalBalance,
    });
});
exports.default = tradeRouter;
