// backend/models/Patient.js
import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
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
    age: { type: Number, required: true, min: 0, max: 130 },
    gender: { type: String, required: true },
    contact: { type: String, trim: true }, // phone/contact number
    weight: Number,
    bloodSugar: Number,
    heartRate: Number,
    bp: { type: String, trim: true }, // e.g., "120/80"
    diseases: { type: [String], default: [] },
    medications: { type: [String], default: [] },

    // assigned primary doctor (optional)
    primaryDoctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
  },
  { timestamps: true }
);

const Patient = mongoose.model("Patient", patientSchema);
export default Patient;
