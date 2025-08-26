"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

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
  id: string;
}

export default function Home() {
  // Core state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [interval, setIntervalState] = useState<"1m" | "5m" | "10m" | "30m">(
    "1m"
  );
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [currentPrice, setCurrentPrice] = useState<number>(157.2345);
  const [priceChange24h, setPriceChange24h] = useState<number>(2.45);
  const [volume24h, setVolume24h] = useState<number>(1234567.89);
  const [isClient, setIsClient] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentUTCDateTime, setCurrentUTCDateTime] = useState<string>("");
  const [hoveredTrade, setHoveredTrade] = useState<string | null>(null);

  // Performance refs
  const tradesRef = useRef<Trade[]>([]);
  const priceUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const tradeIdCounter = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // User info
  const userLogin = "VirgoTheLord";

  // Optimized hover handlers
  const handleTradeHover = useCallback((tradeId: string) => {
    setHoveredTrade(tradeId);
  }, []);

  const handleTradeLeave = useCallback(() => {
    setHoveredTrade(null);
  }, []);

  // Format UTC date time helper
  const formatUTCDateTime = useCallback(() => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hours = String(now.getUTCHours()).padStart(2, "0");
    const minutes = String(now.getUTCMinutes()).padStart(2, "0");
    const seconds = String(now.getUTCSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }, []);

  // Initialize client and time updates
  useEffect(() => {
    setIsClient(true);

    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour12: false }));
      setCurrentUTCDateTime(formatUTCDateTime());
    };

    updateTime(); // Set initial time immediately

    timeUpdateInterval.current = setInterval(updateTime, 1000);

    return () => {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }
    };
  }, [formatUTCDateTime]);

  // Mock data and price simulation
  useEffect(() => {
    if (!isClient) return;

    const now = Date.now();

    // Generate more realistic candle data
    const generateCandles = (count: number): Candle[] => {
      return Array.from({ length: count }, (_, i) => {
        const timestamp = new Date(now - (count - i - 1) * 60000).toISOString();
        const basePrice = 157 + (Math.random() - 0.5) * 5;
        const open = basePrice;
        const variation = (Math.random() - 0.5) * 2;
        const close = Math.max(open + variation, 100);
        const high = Math.max(open, close) + Math.random() * 1;
        const low = Math.min(open, close) - Math.random() * 1;

        return {
          timestamp,
          asset: "SOLUSDT",
          open_price: open.toFixed(4),
          close_price: close.toFixed(4),
          high_price: high.toFixed(4),
          low_price: low.toFixed(4),
        };
      });
    };

    const mockCandles = generateCandles(50); // More candles for better chart

    const initialMockTrades: Trade[] = Array.from({ length: 15 }, (_, i) => ({
      symbol: "SOLUSDT",
      tradeId: 12345 + i,
      price: 157 + (Math.random() - 0.5) * 2,
      quantity: Math.random() * 50 + 1,
      tradeTime: now - i * 500,
      isBuyerMaker: Math.random() > 0.5,
      id: `trade-${++tradeIdCounter.current}`,
    }));

    setCandles(mockCandles);
    setTrades(initialMockTrades);
    tradesRef.current = initialMockTrades;
    setConnectionStatus("connected");

    // Optimized price updates with controlled frequency
    priceUpdateInterval.current = setInterval(() => {
      const randomChange = (Math.random() - 0.5) * 0.6; // Reduced volatility

      setCurrentPrice((prev) => {
        const newPrice = Math.max(prev + randomChange, 100);

        // Create new trade with optimized ID generation
        const newTrade: Trade = {
          symbol: "SOLUSDT",
          tradeId: Date.now() + Math.floor(Math.random() * 1000),
          price: newPrice,
          quantity: Math.random() * 50 + 1,
          tradeTime: Date.now(),
          isBuyerMaker: Math.random() > 0.5,
          id: `trade-${++tradeIdCounter.current}`,
        };

        // Batch state updates for better performance
        setTrades((prevTrades) => {
          const updatedTrades = [newTrade, ...prevTrades.slice(0, 49)]; // Keep exactly 50
          tradesRef.current = updatedTrades;
          return updatedTrades;
        });

        return newPrice;
      });

      // Smaller, more realistic increments
      setPriceChange24h((prev) =>
        Math.max(-20, Math.min(20, prev + (Math.random() - 0.5) * 0.05))
      );
      setVolume24h((prev) => Math.max(0, prev + Math.random() * 500));
    }, 1500); // Optimized interval

    return () => {
      if (priceUpdateInterval.current) {
        clearInterval(priceUpdateInterval.current);
      }
    };
  }, [isClient]);

  // WebSocket connection with better error handling
  useEffect(() => {
    if (!isClient) return;

    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket("ws://localhost:3000");

        wsRef.current.onopen = () => {
          setConnectionStatus("connected");
          console.log("WebSocket connected");
        };

        wsRef.current.onclose = () => {
          setConnectionStatus("disconnected");
          console.log("WebSocket disconnected");
        };

        wsRef.current.onerror = (error) => {
          setConnectionStatus("disconnected");
          console.error("WebSocket error:", error);
        };

        wsRef.current.onmessage = (event) => {
          try {
            const apiData: ApiTrade = JSON.parse(event.data);
            const newTrade: Trade = {
              symbol: apiData.s,
              tradeId: apiData.t,
              price: parseFloat(apiData.p),
              quantity: parseFloat(apiData.q),
              tradeTime: apiData.T,
              isBuyerMaker: apiData.m,
              id: `ws-trade-${++tradeIdCounter.current}`,
            };

            setTrades((prev) => {
              const updated = [newTrade, ...prev.slice(0, 49)];
              tradesRef.current = updated;
              return updated;
            });

            setCurrentPrice(newTrade.price);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };
      } catch (error) {
        console.error("Failed to create WebSocket connection:", error);
        setConnectionStatus("disconnected");
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isClient]);

  // Optimized candles fetching
  useEffect(() => {
    if (!isClient) return;

    const fetchCandles = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const res = await fetch(`http://localhost:2000/candles/${interval}`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data: Candle[] = await res.json();
          setCandles(data);
        } else {
          console.warn(`Failed to fetch candles: ${res.status}`);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Failed to fetch candles:", err);
        }
      }
    };

    fetchCandles();
    fetchIntervalRef.current = setInterval(fetchCandles, 10000);

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
      }
    };
  }, [interval, isClient]);

  // Optimized chart data with memoization
  const chartData = useMemo(() => {
    return candles.map((candle) => ({
      x: new Date(candle.timestamp),
      y: [
        parseFloat(candle.open_price),
        parseFloat(candle.high_price),
        parseFloat(candle.low_price),
        parseFloat(candle.close_price),
      ],
    }));
  }, [candles]);

  // Optimized chart options
  const chartOptions = useMemo(
    () => ({
      chart: {
        type: "candlestick" as const,
        background: "transparent",
        toolbar: { show: false },
        zoom: { enabled: true, type: "x" as const },
        animations: { enabled: false },
        redrawOnParentResize: true,
        redrawOnWindowResize: true,
      },
      theme: { mode: "dark" as const },
      grid: {
        borderColor: "#374151",
        strokeDashArray: 0,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
      },
      xaxis: {
        type: "datetime" as const,
        labels: {
          style: { colors: "#9CA3AF", fontSize: "11px" },
          datetimeFormatter: {
            year: "yyyy",
            month: "MMM 'yy",
            day: "dd MMM",
            hour: "HH:mm",
            minute: "HH:mm",
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        tooltip: { enabled: true },
        labels: {
          style: { colors: "#9CA3AF", fontSize: "11px" },
          formatter: (value: number) => `$${value.toFixed(2)}`,
        },
        forceNiceScale: true,
      },
      plotOptions: {
        candlestick: {
          colors: {
            upward: "#10B981",
            downward: "#EF4444",
          },
          wick: {
            useFillColor: true,
          },
        },
      },
      tooltip: {
        theme: "dark" as const,
        y: {
          formatter: (value: number) => `$${value.toFixed(4)}`,
        },
      },
      responsive: [
        {
          breakpoint: 768,
          options: {
            chart: {
              height: 300,
            },
          },
        },
      ],
    }),
    []
  );

  // Virtualized trade list for better performance
  const tradesList = useMemo(() => {
    return trades.slice(0, 50).map((trade) => {
      // Ensure max 50 trades
      const isHovered = hoveredTrade === trade.id;

      return (
        <div
          key={trade.id}
          className={`px-4 py-2.5 transition-all duration-100 ease-out border-b border-gray-900/40 cursor-pointer select-none ${
            isHovered
              ? "bg-gray-800/60 transform scale-[1.01] shadow-lg backdrop-blur-sm"
              : "hover:bg-gray-900/30"
          }`}
          onMouseEnter={() => handleTradeHover(trade.id)}
          onMouseLeave={handleTradeLeave}
        >
          <div className="grid grid-cols-3 gap-3 items-center">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-1.5 h-1.5 rounded-full transition-all duration-150 flex-shrink-0 ${
                  trade.isBuyerMaker ? "bg-red-400" : "bg-green-400"
                } ${isHovered ? "w-2 h-2 shadow-sm" : ""}`}
              />
              <span
                className={`text-sm font-mono font-medium transition-all duration-150 truncate ${
                  trade.isBuyerMaker ? "text-red-400" : "text-green-400"
                } ${isHovered ? "font-bold" : ""}`}
              >
                ${trade.price.toFixed(4)}
              </span>
            </div>

            <div className="text-right min-w-0">
              <span
                className={`text-sm font-mono transition-all duration-150 truncate ${
                  isHovered ? "text-white font-medium" : "text-gray-300"
                }`}
              >
                {trade.quantity.toFixed(2)}
              </span>
            </div>

            <div className="text-right min-w-0">
              <span
                className={`text-xs font-mono transition-all duration-150 truncate ${
                  isHovered ? "text-gray-300" : "text-gray-500"
                }`}
              >
                {new Date(trade.tradeTime).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
      );
    });
  }, [trades, hoveredTrade, handleTradeHover, handleTradeLeave]);

  // Loading state
  if (!isClient) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-green-400 rounded-full animate-spin" />
          <p className="text-gray-400">Loading trading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Header */}
      <header className="border-b border-gray-800 px-4 sm:px-6 py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 sm:gap-8 min-w-0 flex-1">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold">◎</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-xl sm:text-2xl font-light truncate">
                    SOL/USDT
                  </span>
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      connectionStatus === "connected"
                        ? "bg-green-400 animate-pulse"
                        : connectionStatus === "connecting"
                        ? "bg-yellow-400 animate-pulse"
                        : "bg-red-400"
                    }`}
                  />
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wider truncate">
                  Binance • {connectionStatus}
                </div>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-4 lg:gap-6 pl-4 lg:pl-6 border-l border-gray-700 min-w-0">
              <div className="min-w-0">
                <div className="text-2xl lg:text-3xl font-mono font-medium text-white truncate">
                  ${currentPrice.toFixed(4)}
                </div>
                <div
                  className={`text-sm ${
                    priceChange24h >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {priceChange24h >= 0 ? "+" : ""}
                  {priceChange24h.toFixed(2)}% 24h
                </div>
              </div>
              <div className="text-right min-w-0">
                <div className="text-sm text-gray-400">24h Volume</div>
                <div className="text-lg font-mono truncate">
                  $
                  {volume24h.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 text-right flex-shrink-0">
            <div className="text-sm text-gray-400 font-mono">{currentTime}</div>
            <div className="text-xs text-gray-500 font-mono">
              UTC: {currentUTCDateTime}
            </div>
            <div className="text-xs text-gray-600">User: {userLogin}</div>
          </div>
        </div>

        {/* Mobile price display */}
        <div className="sm:hidden mt-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-mono font-medium text-white">
              ${currentPrice.toFixed(4)}
            </div>
            <div
              className={`text-sm ${
                priceChange24h >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {priceChange24h >= 0 ? "+" : ""}
              {priceChange24h.toFixed(2)}% 24h
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">24h Volume</div>
            <div className="text-lg font-mono">
              $
              {volume24h.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-97px)] sm:h-[calc(100vh-129px)] lg:h-[calc(100vh-97px)] overflow-hidden">
        {/* Chart Section */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-800 min-h-0">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-800 flex-shrink-0">
            <h2 className="text-lg font-light">Price Chart</h2>
            <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
              {(["1m", "5m", "10m", "30m"] as const).map((int) => (
                <button
                  key={int}
                  onClick={() => setIntervalState(int)}
                  className={`px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    interval === int
                      ? "bg-white text-black"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {int}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-2 sm:p-4 min-h-0 overflow-hidden">
            <Chart
              options={chartOptions}
              series={[{ data: chartData }]}
              type="candlestick"
              height="100%"
            />
          </div>
        </div>

        {/* Trades Section */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col min-h-0">
          <div className="p-4 sm:p-6 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-light">Live Trades</h3>
              <div className="text-sm text-gray-400">{trades.length}/50</div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden min-h-0">
            <div className="h-full overflow-y-auto scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
              <div className="px-4 py-2 border-b border-gray-800 grid grid-cols-3 gap-3 sm:gap-4 text-xs text-gray-400 uppercase tracking-wider font-medium sticky top-0 bg-black z-10 flex-shrink-0">
                <span>Price</span>
                <span className="text-right">Quantity</span>
                <span className="text-right">Time</span>
              </div>

              {trades.length > 0 ? (
                <div className="min-h-0">{tradesList}</div>
              ) : (
                <div className="flex items-center justify-center h-32 text-gray-500">
                  <div className="text-center">
                    <div className="w-6 h-6 border-2 border-gray-600 border-t-green-400 rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-sm">Loading trades...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
