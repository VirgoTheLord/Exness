export type Balance = {
  amount: number;
};

export type User = {
  id: number;
  name: string;
  email: string;
  password: string;
  balance: Balance;
};
export const users: User[] = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@example.com",
    password: "password123",
    balance: { amount: 10000 },
  },
];

export enum Trade {
  LONG = "long",
  SHORT = "short",
}
export type orders = {
  orderId: number;
  id: number;
  type: Trade;
  asset: string;
  buy: number;
  quantity: number;
};

export type LastPrices = {
  ask: number;
  bid: number;
};
