import cors from "cors";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";

import { initSocket } from "./socket.js";
import rbacRoutes from "./routes/rbac.js";
import chatbotRoutes from "./routes/chatBot.js";
import authRoutes from "./routes/authRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import draftRoutes from "./routes/draftRoutes.js";
import docketRoutes from "./routes/docketRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import priorArtRoutes from "./routes/priorArtRoutes.js";
import deadlineRoutes from "./routes/deadlineRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import foreignRoutes from "./routes/Foreignassociates.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import bankDetailsRouter from "./routes/bankRoutes.js";
import serviceFeeRoutes from "./routes/serviceFeeRoutes.js";
import { startReminderCron } from "./jobs/deadlineReminderCron.js";
import clearBlacklistedTokenScheduler from "./utils/clearBlacklistedTokenScheduler.js";

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* -----------------------------
   1. PREPARE CORS ORIGINS
----------------------------- */
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "http://localhost:5173"];

/* -----------------------------
   2. MIDDLEWARES
----------------------------- */
app.use(
  cors({
    origin: allowedOrigins, // Pass the array here
    credentials: true,
  }),
);

/* -----------------------------
   3. HTTP SERVER & SOCKET SETUP
   (Must be done before routes if passing io to routes)
----------------------------- */
const server = http.createServer(app);

// Initialize Socket ONCE here
const io = initSocket(server);

// Optional: Make 'io' available in your Express routes via req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

/* -----------------------------
   Routes
----------------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/rbac", rbacRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/drafts", draftRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/dockets", docketRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/prior-art", priorArtRoutes);
app.use("/api/deadlines", deadlineRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/foreign-associates", foreignRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/bank-details", bankDetailsRouter);
app.use("/api/service-fees", serviceFeeRoutes);
/* -----------------------------
   Default Route / Frontend Serving
----------------------------- */
if (process.env.NODE_ENV !== "development") {
  const frontendPath = path.join(__dirname, "public");
  app.use(express.static(frontendPath));

  app.get("/{*any}", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("Welcome to the Docket Dots Server!");
  });
}

/* -----------------------------
   Global Error Handler
----------------------------- */
app.use((err, req, res, next) => {
  console.error("Global Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Something went wrong",
  });
});

// Scheduler
clearBlacklistedTokenScheduler;

/* -----------------------------
   DB CONNECT & SERVER START
----------------------------- */
const PORT = process.env.PORT || 8080;

const dbConnect = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

dbConnect().then(() => {
  // Listen on the SERVER, not app
  server.listen(PORT, "0.0.0.0", () => {
    // Start Cron jobs passing the ALREADY INITIALIZED 'io'
    startReminderCron(io);

    console.log(
      `Server running on port ${PORT} in ${process.env.NODE_ENV} mode`,
    );
  });
});
