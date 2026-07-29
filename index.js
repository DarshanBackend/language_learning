import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import cors from "cors";
import logger from "morgan";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "./DB/connectdb.js";
import IndexRoute from "./routes/index.routes.js";
import registerLiveSpeakingSocket from "./sockets/liveSpeaking.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io with loose CORS for mobile integrations
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Express middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable to prevent blocking websocket connections
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger("dev"));
app.use("/public", express.static("public"));

// Connect to MongoDB
const DB_URL =
  process.env.DB_URL ||
  "mongodb+srv://mehulkalathiyainfotech:euMEtsN4B8ZfmXCk@cluster0.lhctupx.mongodb.net/language_learning";
connectDB(DB_URL);

// Home route
app.get("/", async (req, res) => {
  return res.send("<h1>Lnaguage_Learning AI Voice Tutor API is working!</h1>");
});

// Health check endpoint
app.get("/health", async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus =
    dbState === 1
      ? "connected"
      : dbState === 2
        ? "connecting"
        : dbState === 3
          ? "disconnecting"
          : "disconnected";

  res.json({
    server: "running",
    database: dbStatus,
    timestamp: new Date(),
  });
});

// Mount consolidated API routes under /api
app.use("/api", IndexRoute);

// Initialize Live Speaking Socket.io namespace
registerLiveSpeakingSocket(io);

// Server startup
const PORT = process.env.PORT || 9000;
httpServer.listen(PORT, () => {
  console.log(`✅ Lnaguage_Learning Server is running on port : ${PORT}`);
});