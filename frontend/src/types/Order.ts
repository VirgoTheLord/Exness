export enum Trade {
  LONG = "long",
  SHORT = "short",
}

export interface Order {
  orderId: number;
  id: number;
  type: Trade;
  asset: string;
  buy: number;
  quantity: number;
}
