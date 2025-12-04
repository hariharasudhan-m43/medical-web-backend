import mongoose from "mongoose";

const ChatbotHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  reply: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("ChatbotHistory", ChatbotHistorySchema);
