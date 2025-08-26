"use client";

import { useEffect, useState } from "react";

interface Candle {
  timestamp: string;
  asset: string;
  open_price: string;
  close_price: string;
  high_price: string;
  low_price: string;
}

interface ApiTrade {
  e: string;
  E: number;
  s: string;
  t: number;
  p: string;
  q: string;
  T: number;
  m: boolean;
  M: boolean;
}

interface Trade {
  symbol: string;
  tradeId: number;
  price: number;
  quantity: number;
  tradeTime: number;
  isBuyerMaker: boolean;
}

export default function Home() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [interval, setIntervalState] = useState<"1m" | "5m" | "10m" | "30m">(
    "1m"
  );

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000");

    ws.onmessage = (event) => {
      try {
        const apiData: ApiTrade = JSON.parse(event.data);

        const newTrade: Trade = {
          symbol: apiData.s,
          tradeId: apiData.t,
          price: parseFloat(apiData.p),
          quantity: parseFloat(apiData.q),
          tradeTime: apiData.T,
          isBuyerMaker: apiData.m,
        };

        setTrades((prev) => [newTrade, ...prev]);
      } catch {}
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    const fetchCandles = async () => {
      try {
        const res = await fetch(`http://localhost:2000/candles/${interval}`);
        const data: Candle[] = await res.json();
        setCandles(data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchCandles();
    const id = setInterval(fetchCandles, 10000);
    return () => clearInterval(id);
  }, [interval]);

  return (
    <div className="flex flex-col md:flex-row justify-center items-start min-h-screen bg-gray-100 p-6 gap-6">
      <div className="bg-white rounded-xl shadow p-6 w-full md:w-1/2 flex flex-col">
        <div className="border-b pb-4 mb-4">
          <h2 className="text-center text-xl font-semibold">
            {trades[0]?.symbol || "SOLUSDT"} - Live Trades
          </h2>
        </div>
        <div className="overflow-y-auto max-h-[60vh]">
          <table className="w-full border-collapse">
            <thead className="bg-white sticky top-0">
              <tr>
                <th className="border-b-2 border-gray-300 px-3 py-2 text-left text-sm font-semibold uppercase text-gray-700">
                  Time
                </th>
                <th className="border-b-2 border-gray-300 px-3 py-2 text-left text-sm font-semibold uppercase text-gray-700">
                  Price
                </th>
                <th className="border-b-2 border-gray-300 px-3 py-2 text-left text-sm font-semibold uppercase text-gray-700">
                  Quantity
                </th>
                <th className="border-b-2 border-gray-300 px-3 py-2 text-left text-sm font-semibold uppercase text-gray-700">
                  Trade ID
                </th>
              </tr>
            </thead>
            <tbody>
              {trades.length > 0 ? (
                trades.map((trade, idx) => (
                  <tr
                    key={trade.tradeId}
                    className={idx % 2 === 0 ? "bg-gray-100" : ""}
                  >
                    <td className="border-b border-gray-300 px-3 py-2 font-mono text-sm">
                      {new Date(trade.tradeTime).toLocaleTimeString()}
                    </td>
                    <td className="border-b border-gray-300 px-3 py-2 font-mono text-sm">
                      {trade.price.toFixed(4)}
                    </td>
                    <td className="border-b border-gray-300 px-3 py-2 font-mono text-sm">
                      {trade.quantity.toFixed(5)}
                    </td>
                    <td className="border-b border-gray-300 px-3 py-2 font-mono text-sm">
                      {trade.tradeId}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center text-gray-500 py-4">
                    Waiting for trade data...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 w-full md:w-1/2 flex flex-col">
        <div className="border-b pb-4 mb-4 flex flex-col gap-2">
          <h2 className="text-center text-xl font-semibold">
            {candles[0]?.asset || "SOLUSDT"} - Candles ({interval})
          </h2>
          <select
            className="border rounded px-3 py-1 text-sm"
            value={interval}
            onChange={(e) =>
              setIntervalState(e.target.value as "1m" | "5m" | "10m" | "30m")
            }
          >
            <option value="1m">1 Minute</option>
            <option value="5m">5 Minutes</option>
            <option value="10m">10 Minutes</option>
            <option value="30m">30 Minutes</option>
          </select>
        </div>
        <div className="overflow-y-auto max-h-[60vh]">
          <table className="w-full border-collapse">
            <thead className="bg-white sticky top-0">
              <tr>
                <th className="border-b-2 border-gray-300 px-3 py-2 text-left text-sm font-semibold uppercase text-gray-700">
                  Time
                </th>
                <th className="border-b-2 border-gray-300 px-3 py-2 text-left text-sm font-semibold uppercase text-gray-700">
                  Open
                </th>
                <th className="border-b-2 border-gray-300 px-3 py-2 text-left text-sm font-semibold uppercase text-gray-700">
                  Close
                </th>
                <th className="border-b-2 border-gray-300 px-3 py-2 text-left text-sm font-semibold uppercase text-gray-700">
                  High
                </th>
                <th className="border-b-2 border-gray-300 px-3 py-2 text-left text-sm font-semibold uppercase text-gray-700">
                  Low
                </th>
              </tr>
            </thead>
            <tbody>
              {candles.length > 0 ? (
                candles.map((c, idx) => (
                  <tr
                    key={c.timestamp}
                    className={idx % 2 === 0 ? "bg-gray-100" : ""}
                  >
                    <td className="border-b border-gray-300 px-3 py-2 font-mono text-sm">
                      {new Date(c.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="border-b border-gray-300 px-3 py-2 font-mono text-sm">
                      {parseFloat(c.open_price).toFixed(4)}
                    </td>
                    <td className="border-b border-gray-300 px-3 py-2 font-mono text-sm">
                      {parseFloat(c.close_price).toFixed(4)}
                    </td>
                    <td className="border-b border-gray-300 px-3 py-2 font-mono text-sm">
                      {parseFloat(c.high_price).toFixed(4)}
                    </td>
                    <td className="border-b border-gray-300 px-3 py-2 font-mono text-sm">
                      {parseFloat(c.low_price).toFixed(4)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500 py-4">
                    Waiting for candle data...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
