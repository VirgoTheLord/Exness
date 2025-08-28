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
  const user = {
    id: 1,
    name: "Admin User",
    email: "admin@example.com",
    password: "password123",
  };
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
  const [balance, setBalance] = useState(0);
  const [positions, setPositions] = useState<Order[]>([]);
  const [pnlPositions, setPnlPositions] = useState<(Order & { pnl: number })[]>(
    []
  );

  useEffect(() => {
    const fetchBalance = async () => {
      const response = await axios.get(
        `http://localhost:9000/user/balance/${user.id}`
      );
      setBalance(response.data.balance.amount);
    };
    fetchBalance();
  }, []);

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
  }, []);

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

  useEffect(() => {
    const calculatePnL = (positions: Order[], prices: Prices[]) =>
      positions.map((pos) => {
        const current = prices.find((p) => p.symbol === pos.asset);
        const currentBid = current?.bid ?? 0;
        return { ...pos, pnl: (currentBid - pos.buy) * pos.quantity };
      });
    setPnlPositions(calculatePnL(positions, prices));
  }, [positions, prices]);
  const totalPnL = pnlPositions.reduce((sum, pos) => sum + pos.pnl, 0);
  const displayBalance = balance + totalPnL;

  const handleLong = async (quantity: number, asset: string, type: string) => {
    try {
      const response = await axios.post(
        `http://localhost:9000/trade/order/${type}`,
        { quantity, asset, id: user.id }
      );
      setPositions((prev) => [
        ...prev,
        {
          orderId: prev.length + 1,
          id: user.id,
          type: type === "long" ? Trade.LONG : Trade.SHORT,
          asset: asset.toUpperCase(),
          buy: response.data.buyPrice,
          quantity,
        },
      ]);
    } catch (error: any) {
      if (error.response?.status === 400) alert(error.response.data.message);
    }
  };
  const handleClose = async (orderId: number, type: string) => {
    try {
      const response = await axios.post(
        `http://localhost:9000/trade/close/${type}`,
        {
          id: user.id,
          orderId,
        }
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
      <Navbar balance={displayBalance} />

      <div className="flex flex-1 gap-4 p-4 min-h-[90vh] flex-wrap">
        <div className="relative flex-1 min-w-0">
          <CandleChart candles={candles} />
          <div className="absolute top-4 right-4 z-10 flex gap-4 flex-wrap">
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
          </div>
        </div>

        <div className="w-full md:w-1/4 overflow-y-auto flex-shrink-0 min-w-0">
          <PriceTable prices={prices} />
          <div className="mt-4 flex flex-col gap-2">
            <h1>Enter a quantity to perform trade:</h1>
            <h2>Buy: {market} at</h2>
            <input
              type="number"
              placeholder="Enter quantity"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="border p-2 rounded w-full"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleLong(quantity, market, "long")}
                className="bg-green-500 text-white px-4 py-2 rounded flex-1"
              >
                Long
              </button>
              <button
                onClick={() => handleLong(quantity, market, "short")}
                className="bg-red-500 text-white px-4 py-2 rounded flex-1"
              >
                Short
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full bg-white border-t border-gray-200 p-4 overflow-x-auto">
        <Orders positions={positions} prices={prices} onClose={handleClose} />
      </div>
    </div>
  );
};

export default Page;
