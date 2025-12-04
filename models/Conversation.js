import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema({
  participants: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      role: {
        type: String,
        enum: ["Doctor", "Patient"],
        required: true
      }
    }
  ],

  lastMessage: { type: String, default: "" },
  lastAt: { type: Date, default: Date.now }
});

ConversationSchema.index({ "participants.userId": 1 });

export default mongoose.model("Conversation", ConversationSchema);
