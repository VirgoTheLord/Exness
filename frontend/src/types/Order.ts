export enum Trade {
  LONG = "LONG",
  SHORT = "SHORT",
}

export interface Order {
  orderId: number;
  id: number; // User ID
  type: Trade;
  asset: string;
  buy: number; // Entry Price
  margin?: number;
  quantity: number;
  leverage?: number;
  liquidationPrice?: number;
}
