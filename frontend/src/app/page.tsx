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
  prevPrice: number | null;
}

const CandlePage = () => {
  const [candles, setCandles] = useState<
    { x: Date; y: [number, number, number, number] }[]
  >([]);
  const [selectedSymbol, setSelectedSymbol] = useState("SOLUSDT");
  const [selectedInterval, setSelectedInterval] = useState("1m");
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({
    SOLUSDT: { lastPrice: null, prevPrice: null },
    BTCUSDT: { lastPrice: null, prevPrice: null },
    ETHUSDT: { lastPrice: null, prevPrice: null },
  });

  const markets = ["SOLUSDT", "BTCUSDT", "ETHUSDT"];
  const intervals = ["1m", "5m", "10m", "30m"];

  useEffect(() => {
    const fetchCandles = async () => {
      try {
        const res = await fetch(
          `http://localhost:2000/candles/${selectedSymbol}/${selectedInterval}`
        );
        const data: Candle[] = await res.json();

        if (Array.isArray(data) && data.length > 0) {
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
          const lastCandle = formatted[formatted.length - 1];
          const closePrice = lastCandle.y[3];
          setMarketData((prevData) => ({
            ...prevData,
            [selectedSymbol]: {
              lastPrice: closePrice,
              prevPrice: prevData[selectedSymbol]?.lastPrice || closePrice,
            },
          }));
        } else {
          setCandles([]);
        }
      } catch (err) {
        console.error("Failed to fetch candles:", err);
        setCandles([]);
      }
    };

    fetchCandles();
    const intervalId = setInterval(fetchCandles, 60000);
    return () => clearInterval(intervalId);
  }, [selectedSymbol, selectedInterval]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:4000");

    ws.onmessage = (event) => {
      const trade = JSON.parse(event.data);
      const newPrice = parseFloat(trade.p);
      const symbol = trade.symbol;

      if (symbol in marketData) {
        setMarketData((prevData) => ({
          ...prevData,
          [symbol]: {
            lastPrice: newPrice,
            prevPrice: prevData[symbol].lastPrice,
          },
        }));
      }
    };

    return () => ws.close();
  }, []);

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
        <div className="flex-1 bg-black p-5 rounded-md">
          <div className="flex justify-end mb-4 items-center">
            <div>
              <label className="text-white mr-2" htmlFor="interval-select">
                Interval:
              </label>
              <select
                id="interval-select"
                className="bg-gray-700 text-white px-3 py-1 rounded"
                value={selectedInterval}
                onChange={(e) => setSelectedInterval(e.target.value)}
              >
                {intervals.map((intv) => (
                  <option key={intv} value={intv}>
                    {intv}
                  </option>
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

        <div className="w-64 bg-black p-4 rounded text-white flex flex-col space-y-3">
          <h3 className="text-lg font-semibold border-b border-neutral-800 pb-2">
            Markets
          </h3>
          {markets.map((symbol) => {
            const data = marketData[symbol];
            const lastPrice = data.lastPrice;
            const prevPrice = data.prevPrice;

            const priceColor =
              prevPrice !== null && lastPrice !== null
                ? lastPrice > prevPrice
                  ? "text-green-500"
                  : "text-red-500"
                : "text-neutral-400";

            const bidPrice = lastPrice ? (lastPrice * 0.975).toFixed(2) : "-";
            const askPrice = lastPrice ? (lastPrice * 1.025).toFixed(2) : "-";

            return (
              <div
                key={symbol}
                onClick={() => setSelectedSymbol(symbol)}
                className={`p-3 rounded-md cursor-pointer transition-all duration-200 ${
                  selectedSymbol === symbol
                    ? "bg-blue-600/20 border border-blue-500"
                    : "bg-neutral-800/50 hover:bg-neutral-700/50 border border-transparent"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">{symbol}</span>
                  <span className={`text-xl font-mono ${priceColor}`}>
                    {lastPrice !== null ? lastPrice.toFixed(2) : "..."}
                  </span>
                </div>
                <div className="text-xs text-neutral-400 mt-2 flex justify-between">
                  <span>Bid: {bidPrice}</span>
                  <span>Ask: {askPrice}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CandlePage;
