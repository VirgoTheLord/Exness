import React from "react";
import { Order } from "@/types/Order";
import { Prices } from "@/types/Prices";
import axios from "axios";

interface OrdersProps {
  positions: Order[];
  prices: Prices[];
  onClose: (orderId: number, type: string) => void;
}

const Orders = ({ positions, prices, onClose }: OrdersProps) => {
  const calculatePnL = (positions: Order[], prices: Prices[]) =>
    positions.map((pos) => {
      const current = prices.find((p) => p.symbol === pos.asset);
      const currentBid = current?.bid ?? 0;
      return { ...pos, pnl: (currentBid - pos.buy) * pos.quantity };
    });

  const pnlOrders = calculatePnL(positions, prices);

  if (pnlOrders.length === 0) return <p>No orders found.</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Your Orders</h1>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Order ID</th>
            <th className="border p-2">Asset</th>
            <th className="border p-2">Type</th>
            <th className="border p-2">Quantity</th>
            <th className="border p-2">Buy Price</th>
            <th className="border p-2">PnL</th>
            <th className="border p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {pnlOrders.map((order) => (
            <tr key={order.orderId} className="text-center">
              <td className="border p-2">{order.orderId}</td>
              <td className="border p-2">{order.asset}</td>
              <td className="border p-2">{order.type}</td>
              <td className="border p-2">{order.quantity}</td>
              <td className="border p-2">{order.buy.toFixed(2)}</td>
              <td
                className={`border p-2 ${
                  order.pnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {order.pnl.toFixed(2)}
              </td>
              <td className="border p-2">
                <button
                  className="bg-blue-500 text-white px-2 py-1 rounded"
                  onClick={() =>
                    onClose(order.orderId, order.type.toLowerCase())
                  }
                >
                  Close
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Orders;
