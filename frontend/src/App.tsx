import { useEffect, useState } from "react";

interface TradeData {
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

function App() {
  const [trade, setTrade] = useState<TradeData | null>(null);

  useEffect(() => {
    const wss = new WebSocket("ws://localhost:3000");

    wss.onmessage = (event) => {
      try {
        const data: TradeData = JSON.parse(event.data);
        setTrade(data);
      } catch {
        // silently ignore invalid messages
      }
    };

    return () => {
      wss.close();
    };
  }, []);

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#f3f4f6",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "20px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          minWidth: "500px",
        }}
      >
        <h2 style={{ marginBottom: "15px", textAlign: "center" }}>
          {trade?.s || "Waiting for trades..."}
        </h2>
        {trade ? (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <tbody>
              <tr>
                <th style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                  Price
                </th>
                <td style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                  ${parseFloat(trade.p).toFixed(2)}
                </td>
              </tr>
              <tr>
                <th style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                  Quantity
                </th>
                <td style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                  {trade.q}
                </td>
              </tr>
              <tr>
                <th style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                  Trade ID
                </th>
                <td style={{ borderBottom: "1px solid #ddd", padding: "8px" }}>
                  {trade.t}
                </td>
              </tr>
              <tr>
                <th style={{ padding: "8px" }}>Time</th>
                <td style={{ padding: "8px" }}>
                  {new Date(trade.T).toLocaleTimeString()}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p style={{ color: "#888", textAlign: "center" }}>
            No trade data yet...
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
