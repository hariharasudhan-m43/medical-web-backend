// backend/models/Message.js
import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true },

    from: { type: mongoose.Schema.Types.ObjectId, required: true },
    fromModel: { type: String, required: true, enum: ["Doctor", "Patient"] },

    to: { type: mongoose.Schema.Types.ObjectId, required: true },
    toModel: { type: String, required: true, enum: ["Doctor", "Patient"] },

    text: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Message", MessageSchema);
