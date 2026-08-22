import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db.js";
import authRouter from "./src/routes/auth.js";
import registryRouter from "./src/routes/registry.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "QPM Registry Backend",
    database: "MongoDB",
    storage: "Google Drive API",
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/registry", registryRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`🚀 QPM Backend Server running on http://localhost:${PORT}`);
  console.log(`📦 Registry API available at http://localhost:${PORT}/api/registry`);
  console.log(`🔑 Auth API available at http://localhost:${PORT}/api/auth`);
});
