import express from "express";
import cors from "cors";
const app = express();
app.use(express.json());
app.use(cors());
const PORT = 6000;

app.get("candles/:interval/:market", (req, res) => {
  const { interval, market } = req.params;
});
app.listen(PORT, () => {
  console.log("Server Created");
});
