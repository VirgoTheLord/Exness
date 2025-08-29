"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import CandleChart from "@/components/Charts";
import Navbar from "@/components/Navbar";
import PriceTable from "@/components/PriceTable";
import Orders from "@/components/Orders";

import { candle } from "@/types/Charts";
import { Prices } from "@/types/Prices";
import { Order, Trade } from "@/types/Order";

const Page = () => {
  const user = { id: 1 };
  const markets = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  const intervals = ["1m", "5m", "10m", "30m"];

  const [candles, setCandles] = useState<candle[]>([]);
  const [prices, setPrices] = useState<Prices[]>([
    { symbol: "BTCUSDT", ask: 0, bid: 0, status: "up" },
    { symbol: "ETHUSDT", ask: 0, bid: 0, status: "up" },
    { symbol: "SOLUSDT", ask: 0, bid: 0, status: "up" },
  ]);
  const [market, setMarket] = useState(markets[0]);
  const [selectedInterval, setSelectedInterval] = useState(intervals[0]);
  const [quantity, setQuantity] = useState(0);
  const [balance, setBalance] = useState(0); // This is the user's available (free) balance
  const [positions, setPositions] = useState<Order[]>([]);
  const [pnlPositions, setPnlPositions] = useState<(Order & { pnl: number })[]>(
    []
  );
  const [leverage, setLeverage] = useState(1);

  // Fetch initial balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await axios.get(
          `http://localhost:9000/user/balance/${user.id}`
        );
        setBalance(response.data.balance.amount);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
      }
    };
    fetchBalance();
  }, [user.id]);

  // Fetch open positions periodically
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const { data } = await axios.get<Order[]>(
          `http://localhost:9000/trade/orders/${user.id}`
        );
        setPositions(data);
      } catch (error) {
        console.error("Failed to fetch positions:", error);
      }
    };
    fetchPositions();
    const interval = setInterval(fetchPositions, 5000); // Poll for updates
    return () => clearInterval(interval);
  }, [user.id]);

  // Fetch candles periodically
  useEffect(() => {
    const fetchCandles = async (market: string, interval: string) => {
      try {
        const { data } = await axios.get<candle[]>(
          `http://localhost:9000/candles/${market}/${interval}`
        );
        setCandles(data);
      } catch (error) {
        console.log(error);
      }
    };
    fetchCandles(market, selectedInterval);
    const intervalId = setInterval(
      () => fetchCandles(market, selectedInterval),
      60000
    );
    return () => clearInterval(intervalId);
  }, [market, selectedInterval]);

  // Price updates via WebSocket
  useEffect(() => {
    const wss = new WebSocket("ws://localhost:4000");
    wss.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setPrices((prevPrices) =>
        prevPrices.map((p) =>
          p.symbol === message.symbol
            ? {
                ...p,
                ask: message.ask,
                bid: message.bid,
                status:
                  message.ask > p.ask
                    ? "up"
                    : message.ask < p.ask
                    ? "down"
                    : p.status,
              }
            : p
        )
      );
    };
    return () => wss.close();
  }, []);

  // FIX: Correct PnL calculation on the client-side for display.
  // The leverage effect is already in the `quantity`, so we don't multiply by it again.
  useEffect(() => {
    const calculatePnL = (openPositions: Order[], currentPrices: Prices[]) => {
      return openPositions.map((pos) => {
        const currentPrice = currentPrices.find((p) => p.symbol === pos.asset);
        if (!currentPrice || currentPrice.bid === 0) return { ...pos, pnl: 0 };

        let pnl = 0;
        if (pos.type === Trade.LONG) {
          // To calculate unrealized PnL for a long, you check against the current bid price (the price you could sell at).
          pnl = (currentPrice.bid - pos.buy) * pos.quantity;
        } else {
          // Trade.SHORT
          // To calculate unrealized PnL for a short, you check against the current ask price (the price you would need to buy back at).
          pnl = (pos.buy - currentPrice.ask) * pos.quantity;
        }
        return { ...pos, pnl };
      });
    };

    if (positions.length > 0) {
      setPnlPositions(calculatePnL(positions, prices));
    } else {
      setPnlPositions([]); // Clear PnL positions if there are no open trades
    }
  }, [positions, prices]);

  // CHANGE: Calculate total account equity for a more accurate display.
  const totalUnrealizedPnL = pnlPositions.reduce(
    (sum, pos) => sum + pos.pnl,
    0
  );
  const totalMarginUsed = positions.reduce(
    (sum, pos) => sum + (pos.margin || 0),
    0
  );
  const displayEquity = balance + totalMarginUsed + totalUnrealizedPnL;

  // FIX: Renamed to handleOpenTrade and corrected the logic to use the API response as the source of truth.
  const handleOpenTrade = async (
    quantity: number,
    asset: string,
    type: "long" | "short"
  ) => {
    if (quantity <= 0) {
      alert("Quantity must be greater than zero.");
      return;
    }
    try {
      const { data } = await axios.post(
        `http://localhost:9000/trade/order/${type}`,
        { quantity, asset, id: user.id, leverage }
      );

      // Add the new order directly from the API response
      setPositions((prev) => [...prev, data.order]);

      // Update the available balance from the API response
      setBalance(data.newBalance);

      alert(data.message || "Order placed successfully!");
    } catch (error: any) {
      alert(error.response?.data?.message || "An unknown error occurred.");
    }
  };

  // Close trade function (logic is sound)
  const handleClose = async (orderId: number, type: string) => {
    try {
      const response = await axios.post(
        `http://localhost:9000/trade/close/${type}`,
        { id: user.id, orderId }
      );

      setBalance(response.data.balance);
      setPositions((prev) => prev.filter((order) => order.orderId !== orderId));

      alert(
        `Order closed! PnL: ${response.data.pnl.toFixed(
          2
        )}, New Balance: ${response.data.balance.toFixed(2)}`
      );
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to close order");
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-gray-100 overflow-x-hidden">
      <Navbar balance={displayEquity} />

      <div className="flex flex-1 gap-4 p-4 min-h-[90vh] flex-wrap">
        <div className="relative flex-1 min-w-[300px] lg:min-w-0">
          <CandleChart candles={candles} />
          <div className="absolute top-4 right-4 z-10 flex gap-2 sm:gap-4 flex-wrap">
            {/* Market Selector */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Market
              </label>
              <select
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block p-2.5 shadow-sm"
              >
                {markets.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            {/* Interval Selector */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Interval
              </label>
              <select
                value={selectedInterval}
                onChange={(e) => setSelectedInterval(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block p-2.5 shadow-sm"
              >
                {intervals.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            {/* Leverage Input */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Leverage
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="w-20 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="w-full md:w-auto md:max-w-xs lg:max-w-sm flex flex-col gap-4">
          <PriceTable prices={prices} />
          <div className="flex flex-col gap-3 p-4 bg-white rounded-lg shadow">
            <h3 className="font-bold text-lg">New Order</h3>
            <p className="text-sm text-gray-600">
              Available Balance:{" "}
              <span className="font-medium text-gray-800">
                {balance.toFixed(2)} USDT
              </span>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity ({market.replace("USDT", "")})
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={quantity || ""}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="border p-2 rounded w-full"
              />
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => handleOpenTrade(quantity, market, "long")}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded flex-1 transition-colors"
              >
                Buy / Long
              </button>
              <button
                onClick={() => handleOpenTrade(quantity, market, "short")}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded flex-1 transition-colors"
              >
                Sell / Short
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full bg-white border-t border-gray-200 p-4">
        <Orders
          positions={pnlPositions}
          prices={prices}
          onClose={handleClose}
        />
      </div>
    </div>
  );
};

export default Page;
