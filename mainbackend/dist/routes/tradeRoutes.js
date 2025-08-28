"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ioredis_1 = __importDefault(require("ioredis"));
const all_1 = require("../types/all");
const all_2 = require("../types/all");
const tradeRouter = express_1.default.Router();
const redis = new ioredis_1.default();
const lastPrices = {};
redis.subscribe("trades");
redis.on("message", (channel, message) => {
    if (channel == "trades") {
        try {
            const { symbol, bid, ask } = JSON.parse(message);
            lastPrices[symbol.toUpperCase()] = {
                bid: parseFloat(bid),
                ask: parseFloat(ask),
            };
        }
        catch (error) {
            console.log(error);
        }
    }
});
const openOrders = [];
tradeRouter.post("/order/:type", (req, res) => {
    const { type } = req.params;
    const { id, asset, quantity } = req.body;
    const user = all_1.users.find((f) => f.id === id);
    const userIndex = all_1.users.findIndex((f) => f.id === id);
    if (!user) {
        console.log("No user");
        return res.status(400).json({ message: "No user no balance" });
    }
    const balance = user.balance.amount;
    if (type == "long") {
        const currentPrice = lastPrices[asset.toUpperCase()].ask;
        const buyingCost = currentPrice * quantity;
        if (balance < buyingCost) {
            return res.status(400).json({ message: "Insufficient funds" });
        }
        // const newBalance = balance - buyingCost;
        // users[userIndex] = {
        //   ...user,
        //   balance: {
        //     ...user.balance,
        //     amount: newBalance,
        //   },
        // };
        const newOrder = {
            orderId: openOrders.length + 1,
            id: id,
            type: all_2.Trade.LONG,
            asset: asset.toUpperCase(),
            buy: currentPrice,
            quantity: quantity,
        };
        openOrders.push(newOrder);
        return res.status(200).json({
            message: "Order Placed",
            buyPrice: currentPrice,
            quantity,
            balance: all_1.users[userIndex].balance.amount,
        });
    }
    else {
    }
});
tradeRouter.post("/close/:type", (req, res) => {
    const { type } = req.params;
    const { id, orderId } = req.body;
    const userIndex = all_1.users.findIndex((u) => u.id === id);
    const orderIndex = openOrders.findIndex((o) => o.orderId === orderId && o.id === id);
    const order = openOrders[orderIndex];
    const lastPrice = lastPrices[order.asset];
    if (!lastPrice) {
        return res.status(400).json({ message: "Price data not available" });
    }
    let pnl = 0;
    if (type === "long") {
        pnl = (lastPrice.bid - order.buy) * order.quantity;
    }
    else if (type === "short") {
        pnl = (order.buy - lastPrice.ask) * order.quantity;
    }
    else {
        return res.status(400).json({ message: "Invalid type" });
    }
    all_1.users[userIndex].balance.amount += pnl;
    openOrders.splice(orderIndex, 1);
    return res.status(200).json({
        message: "Order closed",
        balance: all_1.users[userIndex].balance.amount,
        pnl,
        closedOrder: order,
    });
});
tradeRouter.get("/orders/:userId", (req, res) => {
    const { userId } = req.params;
    const userOrders = openOrders.filter((order) => order.id === Number(userId));
    return res.status(200).json(userOrders);
});
exports.default = tradeRouter;
