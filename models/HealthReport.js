// backend/models/HealthReport.js
import mongoose from "mongoose";

const HealthReportSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  output: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("HealthReport", HealthReportSchema);
