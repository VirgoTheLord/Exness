import express from "express";
import Redis from "ioredis";
import { orders, LastPrices, users } from "../types/all";
import { Trade } from "../types/all";

const tradeRouter = express.Router();
const redis = new Redis();
const lastPrices: Record<string, LastPrices> = {};

// In-memory store (for demonstration)
const openOrders: orders[] = [];

redis.subscribe("trades");
redis.on("message", (channel, message) => {
  if (channel == "trades") {
    try {
      const { symbol, bid, ask } = JSON.parse(message);
      lastPrices[symbol.toUpperCase()] = {
        bid: parseFloat(bid),
        ask: parseFloat(ask),
      };

      // Liquidation Check
      for (let idx = openOrders.length - 1; idx >= 0; idx--) {
        const order = openOrders[idx];
        if (order.asset !== symbol.toUpperCase()) continue;

        let shouldLiquidate = false;
        if (order.type === Trade.LONG && bid <= order.liquidationPrice!) {
          shouldLiquidate = true;
        } else if (
          order.type === Trade.SHORT &&
          ask >= order.liquidationPrice!
        ) {
          shouldLiquidate = true;
        }

        if (shouldLiquidate) {
          // The user's margin for this trade is lost. Since we already deducted
          // it from their balance when they opened the trade, we just need to
          // remove the order. No further balance update is needed here.
          openOrders.splice(idx, 1);
          console.log(
            `Order:${order.orderId} for user ${order.id} has been liquidated.`
          );
        }
      }
    } catch (error) {
      console.log("Error in Redis message handler:", error);
    }
  }
});

tradeRouter.post("/order/:type", (req, res) => {
  const { type } = req.params; // 'long' or 'short'
  const { id, asset, quantity, leverage } = req.body;

  const userIndex = users.findIndex((f) => f.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ message: "User not found" });
  }

  const user = users[userIndex];
  const balance = user.balance.amount;
  const upperCaseAsset = asset.toUpperCase();
  const currentPriceData = lastPrices[upperCaseAsset];

  if (!currentPriceData) {
    return res
      .status(400)
      .json({ message: "Price data not available for this asset." });
  }

  let entryPrice: number;
  let liquidationPrice: number;
  let orderType: Trade;

  if (type === "long") {
    entryPrice = currentPriceData.ask; // Buyers buy at the ask price
    orderType = Trade.LONG;
    // FIX: Correct liquidation price formula for a long
    liquidationPrice = entryPrice * (1 - 1 / leverage);
  } else if (type === "short") {
    entryPrice = currentPriceData.bid; // Sellers sell at the bid price
    orderType = Trade.SHORT;
    // FIX: Correct liquidation price formula for a short
    liquidationPrice = entryPrice * (1 + 1 / leverage);
  } else {
    return res.status(400).json({ message: "Invalid order type" });
  }

  const notionalValue = entryPrice * quantity; // Total value of the position
  const tradeMargin = notionalValue / leverage; // User's collateral

  if (balance < tradeMargin) {
    return res
      .status(400)
      .json({ message: "Insufficient funds to cover margin" });
  }

  // FIX: Deduct the margin from the user's balance
  users[userIndex].balance.amount -= tradeMargin;

  const newOrder: orders = {
    orderId: Date.now() + Math.random(), // Use a more robust ID in production
    id: id,
    type: orderType,
    asset: upperCaseAsset,
    buy: entryPrice, // Renaming to entryPrice would be clearer, but keeping 'buy' for consistency
    margin: tradeMargin,
    quantity: quantity,
    leverage: leverage,
    liquidationPrice: liquidationPrice,
  };
  openOrders.push(newOrder);

  // FIX: Return the newly created order object
  return res.status(200).json({
    message: "Order placed successfully",
    order: newOrder,
    newBalance: users[userIndex].balance.amount,
  });
});

tradeRouter.post("/close/:type", (req, res) => {
  const { type } = req.params;
  const { id, orderId } = req.body;

  const userIndex = users.findIndex((u) => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ message: "User not found" });
  }

  const orderIndex = openOrders.findIndex(
    (o) => o.orderId === orderId && o.id === id
  );
  if (orderIndex === -1) {
    return res.status(404).json({ message: "Order not found" });
  }

  const order = openOrders[orderIndex];
  const lastPrice = lastPrices[order.asset];
  if (!lastPrice) {
    return res
      .status(400)
      .json({ message: "Price data not available to close order" });
  }

  let pnl = 0;
  // FIX: Correct PnL calculation - DO NOT multiply by leverage here.
  if (type === "long") {
    // To close a long, you sell at the current BID price
    pnl = (lastPrice.bid - order.buy) * order.quantity;
  } else if (type === "short") {
    // To close a short, you buy back at the current ASK price
    pnl = (order.buy - lastPrice.ask) * order.quantity;
  }

  // Add back the initial margin + the calculated PnL
  users[userIndex].balance.amount += (order.margin || 0) + pnl;

  // Remove the order from the open positions
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
