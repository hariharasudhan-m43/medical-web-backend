// backend/models/Doctor.js
import mongoose from "mongoose";

const WorkingHoursSchema = new mongoose.Schema(
  {
    start: { type: String, default: "09:00" }, // "HH:MM"
    end: { type: String, default: "17:00" }, // "HH:MM"
    slotMinutes: { type: Number, default: 30 }, // slot length
  },
  { _id: false }
);

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address"],
  },
  password: { type: String, required: true },

  // Use single canonical field 'specialty'
  specialty: { type: String, trim: true },

  experience: { type: Number, default: 0 },
  phone: { type: String, trim: true, default: "" },
  hospital: { type: String, trim: true, default: "General Hospital" },

  // patients explicitly assigned by admin or via some workflow
  patients: [{ type: mongoose.Schema.Types.ObjectId, ref: "Patient" }],

  workingHours: { type: WorkingHoursSchema, default: () => ({}) },
  workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },

  createdAt: { type: Date, default: Date.now },
});

// keep specialty in sync if older code wrote specialization (defensive)
doctorSchema.pre("save", function (next) {
  if (!this.specialty && this.specialization) {
    this.specialty = this.specialization;
  }
  next();
});

export default mongoose.model("Doctor", doctorSchema);
