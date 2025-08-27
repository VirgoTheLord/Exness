import express from "express";

const userRouter = express.Router();

interface user {
  name: string;
  password: string;
  email: string;
}
let users: user[] = [];

userRouter.post("/signup", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields required" });
  }

  const exists = users.find((u) => u.email === email);
  if (exists) {
    return res.status(400).json({ message: "User already exists" });
  }

  users.push({ name, email, password });
  return res.json({ message: "Signup successful" });
});

userRouter.post("/signin", (req, res) => {
  const { email, password } = req.body;

  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  return res.json({ message: "Signin successful" });
});

export default userRouter;
