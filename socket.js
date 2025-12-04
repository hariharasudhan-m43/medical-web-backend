import { Server } from "socket.io";

let io = null;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log("🔥 User connected:", socket.id);

    /* JOIN CONVERSATION ROOM */
    socket.on("join:conversation", ({ conversationId }) => {
      socket.join(conversationId);
    });

    /* LEAVE CONVERSATION ROOM */
    socket.on("leave:conversation", ({ conversationId }) => {
      socket.leave(conversationId);
    });

    /* SEND MESSAGE */
    socket.on("chat:message", (msg) => {
      if (!msg?.conversationId) return;
      io.to(msg.conversationId).emit("chat:message", msg);
    });

    /* TYPING INDICATOR */
    socket.on("typing", ({ conversationId, isTyping }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit("typing", { conversationId, isTyping });
    });

    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}
