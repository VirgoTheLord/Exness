"use client";
import React, { useMemo } from "react";
import Chart from "react-apexcharts";
import { candle } from "@/types/Charts";

type Props = { candles: candle[] };

const CandleChart: React.FC<Props> = ({ candles }) => {
  const series = useMemo(
    () => [
      {
        data: candles.map((c) => ({
          x: new Date(c.timestamp).getTime(),
          y: [
            parseFloat(c.open_price),
            parseFloat(c.high_price),
            parseFloat(c.low_price),
            parseFloat(c.close_price),
          ],
        })),
      },
    ],
    [candles]
  );

  const options = useMemo(
    () => ({
      chart: {
        type: "candlestick" as const,
        toolbar: { show: false },
        animations: { enabled: true },
      },
      xaxis: { type: "datetime" as const },
      yaxis: { tooltip: { enabled: true } },
      plotOptions: {
        candlestick: {
          colors: {
            upward: "#0ECB81",
            downward: "#FF4D4D",
          },
        },
      },
      grid: { padding: { left: 0, right: 0 } }, // avoid horizontal padding
      tooltip: { shared: false, intersect: true },
    }),
    []
  );

  return (
    <div className="h-full w-full min-w-0">
      <Chart
        options={options}
        series={series}
        type="candlestick"
        height="100%"
      />
    </div>
  );
};

export default CandleChart;
