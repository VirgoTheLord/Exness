"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";

const ApexCharts = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Candle {
  timestamp: string;
  open_price: string;
  high_price: string;
  low_price: string;
  close_price: string;
}

interface MarketData {
  lastPrice: number | null;
  ask?: number;
  bid?: number;
  prevAsk?: number;
  prevBid?: number;
}

const CandlePage = () => {
  const [candles, setCandles] = useState<
    { x: Date; y: [number, number, number, number] }[]
  >([]);
  const [selectedSymbol, setSelectedSymbol] = useState("SOLUSDT");
  const [selectedInterval, setSelectedInterval] = useState("1m");
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({
    SOLUSDT: { lastPrice: null },
    BTCUSDT: { lastPrice: null },
    ETHUSDT: { lastPrice: null },
  });
  const [quantity, setQuantity] = useState(0);
  const [balance, setBalance] = useState(0);
  const [liveBalance, setLiveBalance] = useState(0);
  const [holdings, setHoldings] = useState<{
    symbol: string;
    qty: number;
  } | null>(null);

  const markets = ["SOLUSDT", "BTCUSDT", "ETHUSDT"];
  const intervals = ["1m", "5m", "10m", "30m"];

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch(
          "http://localhost:9000/user/balance?user=user1"
        );
        const data = await res.json();
        if (res.ok) {
          setBalance(data.balance);
          setLiveBalance(data.balance);
        } else {
          console.error("Failed to fetch balance:", data.error);
        }
      } catch (err) {
        console.error("Balance fetch error:", err);
      }
    };

    fetchBalance();
  }, []);

  const handleBuy = async () => {
    if (quantity <= 0) return;
    try {
      const res = await fetch("http://localhost:9000/trade/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: "user1",
          symbol: selectedSymbol,
          quantity,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setBalance(data.remainingBalance);
        setHoldings({ symbol: selectedSymbol, qty: quantity });
        setQuantity(0);
      } else {
        alert(data.error || "Failed to buy");
      }
    } catch (err) {
      console.error("Buy error:", err);
    }
  };

  const handleCloseOrder = async () => {
    if (!holdings) return;

    try {
      const res = await fetch("http://localhost:9000/trade/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: "user1",
          symbol: holdings.symbol,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setBalance(data.finalBalance);
        setLiveBalance(data.finalBalance);
        setHoldings(null);
      } else {
        alert(data.error || "Failed to close order");
      }
    } catch (err) {
      console.error("Close order error:", err);
    }
  };

  useEffect(() => {
    const fetchCandles = async () => {
      try {
        const res = await fetch(
          `http://localhost:9000/candles/${selectedSymbol}/${selectedInterval}`
        );
        const data: Candle[] = await res.json();

        if (data.length > 0) {
          const formatted = data.map((c) => ({
            x: new Date(c.timestamp),
            y: [
              parseFloat(c.open_price),
              parseFloat(c.high_price),
              parseFloat(c.low_price),
              parseFloat(c.close_price),
            ] as [number, number, number, number],
          }));
          setCandles(formatted);
        } else {
          setCandles([]);
        }
      } catch {
        setCandles([]);
      }
    };

    fetchCandles();
    const intervalId = setInterval(fetchCandles, 60000);
    return () => clearInterval(intervalId);
  }, [selectedSymbol, selectedInterval]);

  // WebSocket for live ask/bid directly from stream
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:4000");

    ws.onmessage = (event) => {
      const trade = JSON.parse(event.data);
      const symbol = trade.s;
      const ask = parseFloat(trade.ask);
      const bid = parseFloat(trade.bid);

      setMarketData((prev) => ({
        ...prev,
        [symbol]: {
          lastPrice: parseFloat(trade.p),
          prevAsk: prev[symbol]?.ask ?? ask,
          prevBid: prev[symbol]?.bid ?? bid,
          ask,
          bid,
        },
      }));

      if (holdings && holdings.symbol === symbol && bid) {
        setLiveBalance(balance + holdings.qty * bid);
      }
    };

    return () => ws.close();
  }, [holdings, balance]);

  const options = {
    chart: {
      type: "candlestick" as const,
      height: 350,
      toolbar: { show: false },
    },
    xaxis: { type: "datetime" as const },
    yaxis: { tooltip: { enabled: true } },
  };

  return (
    <div className="bg-neutral-900 w-screen h-screen">
      <Navbar />
      <div className="p-4 flex gap-4">
        {/* Candlestick chart */}
        <div className="flex-1 bg-black p-5 rounded-md">
          <div className="flex justify-end mb-4 items-center">
            <div>
              <label className="text-white mr-2">Interval:</label>
              <select
                className="bg-gray-700 text-white px-3 py-1 rounded"
                value={selectedInterval}
                onChange={(e) => setSelectedInterval(e.target.value)}
              >
                {intervals.map((intv) => (
                  <option key={intv}>{intv}</option>
                ))}
              </select>
            </div>
          </div>

          {candles.length > 0 ? (
            <ApexCharts
              options={options}
              series={[{ data: candles }]}
              type="candlestick"
              height={400}
            />
          ) : (
            <div className="text-white text-center py-16 h-[400px] flex items-center justify-center">
              Loading candle data for {selectedSymbol}...
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 bg-black p-4 rounded text-white flex flex-col space-y-4">
          <h3 className="text-lg font-semibold border-b border-neutral-800 pb-2">
            Balance: ${liveBalance.toFixed(2)}
          </h3>

          {/* Buy Section */}
          <div className="space-y-2">
            <label className="block text-sm">Quantity:</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full px-3 py-1 bg-neutral-800 text-white rounded"
            />
            <button
              onClick={handleBuy}
              className="w-full bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded"
            >
              Buy {selectedSymbol}
            </button>
          </div>

          {/* Holdings Section */}
          {holdings && (
            <div className="mt-4 border-t border-neutral-700 pt-3">
              <p>
                Holding: {holdings.qty} {holdings.symbol}
              </p>
              <button
                onClick={handleCloseOrder}
                className="mt-2 w-full bg-red-600 hover:bg-red-700 px-3 py-2 rounded"
              >
                Close Order
              </button>
            </div>
          )}

          {/* Markets Table */}
          <h3 className="text-lg font-semibold border-b border-neutral-800 pb-2">
            Markets
          </h3>
          <div className="space-y-2">
            {markets.map((symbol) => {
              const data = marketData[symbol];
              const ask = data.ask;
              const bid = data.bid;
              const prevAsk = data.prevAsk;
              const prevBid = data.prevBid;

              const askColor =
                ask && prevAsk
                  ? ask > prevAsk
                    ? "text-green-500"
                    : "text-red-500"
                  : "text-neutral-400";
              const bidColor =
                bid && prevBid
                  ? bid > prevBid
                    ? "text-green-500"
                    : "text-red-500"
                  : "text-neutral-400";

              return (
                <div
                  key={symbol}
                  onClick={() => setSelectedSymbol(symbol)}
                  className={`p-2 rounded-md cursor-pointer border border-neutral-700 hover:bg-neutral-800/50`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold">{symbol}</span>
                    <span className="text-sm font-mono">
                      Last: {data.lastPrice?.toFixed(2) ?? "..."}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-mono">
                    <span className={askColor}>
                      Ask: {ask?.toFixed(2) ?? "..."}
                    </span>
                    <span className={bidColor}>
                      Bid: {bid?.toFixed(2) ?? "..."}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandlePage;
