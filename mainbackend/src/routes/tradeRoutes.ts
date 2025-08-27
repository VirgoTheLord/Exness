import express from "express";
import Redis from "ioredis";

const tradeRouter = express.Router();
const redis = new Redis();

interface Balance {
  [username: string]: number;
}

interface Holding {
  symbol: string;
  qty: number;
  type: "buy" | "sell";
  startBalance: number;
  buyPrice: number; // store ask price at buy
}

export const userBalances: Balance = {
  user1: 10000,
};

const userHoldings: Record<string, Holding[]> = {};

// latest ask/bid prices from stream
const latestAsk: Record<string, number> = {};
const latestBid: Record<string, number> = {};

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
    } catch (err) {
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

  if (userBalances[user] === undefined) {
    userBalances[user] = 10000;
  }

  const cost = askPrice * quantity;
  if (userBalances[user] < cost) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  userBalances[user] -= cost;

  if (!userHoldings[user]) userHoldings[user] = [];
  userHoldings[user].push({
    symbol: sym,
    qty: quantity,
    type: "buy",
    startBalance: userBalances[user],
    buyPrice: askPrice,
  });

  return res.json({
    user,
    symbol: sym,
    quantity,
    buyPrice: askPrice,
    remainingBalance: userBalances[user],
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

  const finalBalance = userBalances[user] + bidPrice * holding.qty;

  userBalances[user] = finalBalance;
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
// SELL route — user wants to sell a quantity of an existing holding
tradeRouter.post("/sell", (req, res) => {
  const { user, symbol, quantity } = req.body;
  const sym = symbol.toUpperCase();

  if (!userHoldings[user] || userHoldings[user].length === 0) {
    return res.status(400).json({ error: "No active holdings found" });
  }

  // Find the user's holding for this symbol
  const holdingIndex = userHoldings[user].findIndex(
    (h) => h.symbol === sym && h.type === "buy"
  );

  if (holdingIndex === -1) {
    return res.status(400).json({ error: "No active holding for " + sym });
  }

  const holding = userHoldings[user][holdingIndex];

  if (quantity > holding.qty) {
    return res.status(400).json({ error: "Sell quantity exceeds holding" });
  }

  const bidPrice = latestBid[sym];
  if (!bidPrice) {
    return res.status(400).json({ error: "No bid price available for " + sym });
  }

  // Calculate proceeds from sale at bid
  const saleProceeds = bidPrice * quantity;

  // Update user balance
  userBalances[user] += saleProceeds;

  // Reduce or remove holding
  if (quantity === holding.qty) {
    // sold entire holding
    userHoldings[user].splice(holdingIndex, 1);
  } else {
    // partial sale
    userHoldings[user][holdingIndex].qty -= quantity;
  }

  return res.json({
    user,
    symbol: sym,
    soldQty: quantity,
    sellPrice: bidPrice,
    remainingQty: userHoldings[user][holdingIndex]?.qty ?? 0,
    updatedBalance: userBalances[user],
  });
});

tradeRouter.get("/balance", (req, res) => {
  const user = req.query.user as string;
  if (!user) {
    return res.status(400).json({ message: "User Required" });
  }
  if (userBalances[user] === undefined) {
    userBalances[user] = 10000;
  }
  return res.json({ user, balance: userBalances[user] });
});

export default tradeRouter;
