// backend/models/ChatMessage.js
import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  message: { type: String, required: true },
  reply: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("ChatMessage", ChatMessageSchema);
