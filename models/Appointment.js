// backend/models/Appointment.js
import mongoose from "mongoose";

const AppointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },

  // primary datetime
  date: { type: Date, required: true },

  // free text reason
  reason: { type: String },

  // new, non-breaking fields
  type: { type: String, default: "Consultation" }, // Consultation, Follow-up, etc.
  duration: { type: Number, default: 30 }, // in minutes
  status: { type: String, default: "Scheduled" }, // Scheduled | Completed | Cancelled | Pending
  notes: { type: String, default: "" },
  time: { type: String, default: "" }, // human-friendly time like "09:00 AM"

  createdAt: { type: Date, default: Date.now }
});

// Optional index for faster doctor+date lookups (not unique to avoid accidental strict collisions)
AppointmentSchema.index({ doctorId: 1, date: 1 });

export default mongoose.model("Appointment", AppointmentSchema);
