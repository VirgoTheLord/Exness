import React from "react";
import { Prices } from "@/types/Prices";

const PriceTable = ({ prices }: { prices: Prices[] }) => {
  return (
    <div className="w-full bg-white rounded-lg shadow p-4 overflow-x-auto">
      <h2 className="text-lg font-semibold mb-3">Live Prices</h2>
      <div className="min-w-[300px]">
        <table className="w-full border-collapse">
          <tbody>
            {prices.map((p) => {
              const askClass =
                p.status === "up"
                  ? "text-green-600"
                  : p.status === "down"
                  ? "text-red-600"
                  : "text-gray-800";
              const bidClass =
                p.status === "up"
                  ? "text-green-600"
                  : p.status === "down"
                  ? "text-red-600"
                  : "text-gray-800";

              return (
                <tr
                  key={p.symbol}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="py-2 px-3 font-medium">{p.symbol}</td>
                  <td className={`py-2 px-3 ${askClass}`}>
                    {p.ask.toFixed(2)}
                  </td>
                  <td className={`py-2 px-3 ${bidClass}`}>
                    {p.bid.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PriceTable;
