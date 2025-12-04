// models/HealthHistory.js
import mongoose from "mongoose";

const HealthHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  age: Number,
  weight: Number,
  bloodSugar: Number,
  heartRate: Number,

  bp: String,          // NEW
  symptoms: String,    // NEW

  result: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model("HealthHistory", HealthHistorySchema);
