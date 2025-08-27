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
}

export const userBalances: Balance = {
  user1: 10000,
};

const userHoldings: Record<string, Holding[]> = {};

const latestPrices: Record<string, number> = {};

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
    } catch {}
  }
});

tradeRouter.post("/buy", (req, res) => {
  const { user, symbol, quantity } = req.body;

  const price = latestPrices[symbol.toUpperCase()];
  if (!price) {
    return res.status(400).json({ error: "No price available for " + symbol });
  }

  const cost = price * quantity;
  if (userBalances[user] === undefined) {
    userBalances[user] = 10000;
  }

  if (userBalances[user] < cost) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  userBalances[user] -= cost;

  if (!userHoldings[user]) userHoldings[user] = [];
  userHoldings[user].push({
    symbol,
    qty: quantity,
    type: "buy",
    startBalance: userBalances[user],
  });

  return res.json({
    user,
    symbol,
    quantity,
    price,
    remainingBalance: userBalances[user],
  });
});

tradeRouter.post("/close", (req, res) => {
  const { user, symbol } = req.body;

  if (!userHoldings[user] || userHoldings[user].length === 0) {
    return res.status(400).json({ error: "No active holdings found" });
  }

  const holdingIndex = userHoldings[user].findIndex(
    (h) => h.symbol.toUpperCase() === symbol.toUpperCase()
  );

  if (holdingIndex === -1) {
    return res.status(400).json({ error: "No active holding for " + symbol });
  }

  const holding = userHoldings[user][holdingIndex];
  const currentPrice = latestPrices[symbol.toUpperCase()];

  if (!currentPrice) {
    return res.status(400).json({ error: "No current price for " + symbol });
  }

  let finalBalance = holding.startBalance + holding.qty * currentPrice;

  userBalances[user] = finalBalance;

  userHoldings[user].splice(holdingIndex, 1);

  return res.json({
    user,
    symbol,
    qty: holding.qty,
    finalBalance,
    price: currentPrice,
  });
});

export default tradeRouter;
