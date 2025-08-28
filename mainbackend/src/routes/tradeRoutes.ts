import express from "express";
import Redis from "ioredis";
import { orders, LastPrices, users } from "../types/all";
import { Trade } from "../types/all";

const tradeRouter = express.Router();
const redis = new Redis();
const lastPrices: Record<string, LastPrices> = {};

redis.subscribe("trades");
redis.on("message", (channel, message) => {
  if (channel == "trades") {
    try {
      const { symbol, bid, ask } = JSON.parse(message);
      lastPrices[symbol.toUpperCase()] = {
        bid: parseFloat(bid),
        ask: parseFloat(ask),
      };
    } catch (error) {
      console.log(error);
    }
  }
});

const openOrders: orders[] = [];

tradeRouter.post("/order/:type", (req, res) => {
  const { type } = req.params;
  const { id, asset, quantity } = req.body;
  const user = users.find((f) => f.id === id);
  const userIndex = users.findIndex((f) => f.id === id);
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

    const newOrder: orders = {
      orderId: openOrders.length + 1,
      id: id,
      type: Trade.LONG,
      asset: asset.toUpperCase(),
      buy: currentPrice,
      quantity: quantity,
    };
    openOrders.push(newOrder);

    return res.status(200).json({
      message: "Order Placed",
      buyPrice: currentPrice,
      quantity,
      balance: users[userIndex].balance.amount,
    });
  } else {
  }
});

tradeRouter.post("/close/:type", (req, res) => {
  const { type } = req.params;
  const { id, orderId } = req.body;

  const userIndex = users.findIndex((u) => u.id === id);

  const orderIndex = openOrders.findIndex(
    (o) => o.orderId === orderId && o.id === id
  );

  const order = openOrders[orderIndex];
  const lastPrice = lastPrices[order.asset];
  if (!lastPrice) {
    return res.status(400).json({ message: "Price data not available" });
  }

  let pnl = 0;
  if (type === "long") {
    pnl = (lastPrice.bid - order.buy) * order.quantity;
  } else if (type === "short") {
    pnl = (order.buy - lastPrice.ask) * order.quantity;
  } else {
    return res.status(400).json({ message: "Invalid type" });
  }

  users[userIndex].balance.amount += pnl;

  openOrders.splice(orderIndex, 1);

  return res.status(200).json({
    message: "Order closed",
    balance: users[userIndex].balance.amount,
    pnl,
    closedOrder: order,
  });
});

tradeRouter.get("/orders/:userId", (req, res) => {
  const { userId } = req.params;

  const userOrders = openOrders.filter((order) => order.id === Number(userId));

  return res.status(200).json(userOrders);
});

export default tradeRouter;
