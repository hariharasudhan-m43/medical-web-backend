import mongoose from "mongoose";

const ChatSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  messages: [
    {
      sender: { type: String, enum: ["user", "bot"], required: true },
      text: { type: String, required: true }
    }
  ]
}, { timestamps: true });

export default mongoose.model("ChatSession", ChatSessionSchema);
