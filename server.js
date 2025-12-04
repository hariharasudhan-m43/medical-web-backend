// backend/server.js (socket portion + setIO)
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";

import connectDB from "./config/db.js";

import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import patientRoutes from "./routes/patients.js";
import doctorRoutes from "./routes/doctors.js";
import appointmentRoutes from "./routes/appointments.js";
import chatbotRoutes from "./routes/chatbot.js";
import healthRoutes from "./routes/health.js";
import messageRoutes from "./routes/messages.js";

import { setIO } from "./socketServer.js";

// Models
import Message from "./models/Message.js";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

try {
  await connectDB(process.env.MONGO_URI);
  console.log("✓ MongoDB connected");
} catch (err) {
  console.error("✗ MongoDB Error:", err);
  process.exit(1);
}

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/messages", messageRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("🔥 SERVER ERROR:", err);
  res.status(500).json({
    message: "Internal Server Error",
    error: err.message,
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

setIO(io);

const onlineUsers = new Map();

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    next(new Error("Authentication failed"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.user.id;
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socket.id);

  socket.join(`user:${userId}`);

  socket.on("joinConversation", (convId) => {
    socket.join(`conversation:${convId}`);
  });

  socket.on("leaveConversation", (convId) => {
    socket.leave(`conversation:${convId}`);
  });

  // PRIVATE MESSAGE via socket
  socket.on("privateMessage", async ({ to, text }) => {
    if (!to || !text) return;
    const from = userId;
    const convId = [String(from), String(to)].sort().join(":");
    try {
      const fromModel = socket.user.role === "Doctor" ? "Doctor" : "Patient";
      const toModel = fromModel === "Doctor" ? "Patient" : "Doctor";

      const msg = await Message.create({
        conversationId: convId,
        from,
        fromModel,
        to,
        toModel,
        text,
        read: false,
      });

      const full = await Message.findById(msg._id).lean();

      io.to(`conversation:${convId}`).emit("message", full);
      io.to(`user:${to}`).emit("message:notice", { conversationId: convId, message: full });
    } catch (err) {
      console.error("Message save error:", err);
    }
  });

  socket.on("disconnect", () => {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) onlineUsers.delete(userId);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
