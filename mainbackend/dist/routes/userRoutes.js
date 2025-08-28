"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const all_1 = require("../types/all");
const userRouter = express_1.default.Router();
userRouter.post("/signup", (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: "All fields required" });
    }
    const exists = all_1.users.find((u) => u.email === email);
    if (exists) {
        return res.status(400).json({ message: "User already exists" });
    }
    const newUser = {
        id: all_1.users.length + 1,
        name,
        email,
        password,
        balance: { amount: 0 },
    };
    all_1.users.push(newUser);
    return res.json({ message: "Signup successful", userId: newUser.id });
});
userRouter.post("/signin", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
    }
    const user = all_1.users.find((u) => u.email === email && u.password === password);
    if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
    }
    return res.json({ message: "Signin successful", userId: user.id });
});
userRouter.get("/balance/:userId", (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    const user = all_1.users.find((u) => u.id === userId);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    return res.json({ balance: user.balance });
});
exports.default = userRouter;
