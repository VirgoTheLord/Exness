import express from "express";
import Redis from "ioredis";

const tradeRouter = express.Router();
const redis = new Redis();

type Balance = {
  amount: number;
};

type User = {
  id: number;
  name: string;
  email: string;
  password: string;
  balance: Balance;
};

const users: User[] = [];

enum Trade {
  LONG = "long",
  SHORT = "short",
}
type orders = {
  orderId: number;
  id: number;
  type: Trade;
  asset: string;
  buy: number;
  quantity: number;
};

const openOrders: orders[] = [];

tradeRouter.post("order/:type", (req, res) => {
  const { type } = req.params;
  const { id, asset, quantity } = req.body;
  if (type == "long") {
  } else {
  }
});

tradeRouter.get("/balance", (req, res) => {
  const { name } = req.query;
  let user = users.find((e) => e.name === name);
  if (!user) {
    return res.status(400).json({ message: "User does not exist" });
  }
  return res.status(200).json({ balance: user.balance.amount });
});

export default tradeRouter;
