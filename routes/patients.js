// routes/patients.js
import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* ===================================================
   Utility: Safe ObjectId check
=================================================== */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/* ===================================================
   UNIVERSAL USER LOOKUP (Doctor OR Patient)
   Route: GET /api/users/:id
=================================================== */
router.get("/../users/:id", auth(), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(404).json({ message: "User not found" });
    }

    // Try doctor first
    const doctor = await Doctor.findById(id).select("name email specialty");
    if (doctor) {
      return res.json({
        _id: doctor._id,
        name: doctor.name,
        role: "Doctor",
        specialty: doctor.specialty,
        avatar: null,
      });
    }

    // Try patient
    const patient = await Patient.findById(id).select("name email gender age");
    if (patient) {
      return res.json({
        _id: patient._id,
        name: patient.name,
        role: "Patient",
        avatar: null,
      });
    }

    return res.status(404).json({ message: "User not found" });
  } catch (err) {
    console.error("User lookup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================================================
   GET ALL PATIENTS
=================================================== */
router.get("/", async (req, res) => {
  try {
    const patients = await Patient.find().select("-password");
    res.json(patients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

/* ===================================================
   CREATE PATIENT
=================================================== */
router.post("/", async (req, res) => {
  try {
    const { name, email, password, age, gender, contact } = req.body;

    if (!name || !email || !password || !age || !gender || !contact) {
      return res.status(400).json({ message: "All fields required" });
    }

    const exists = await Patient.findOne({ email });
    if (exists) return res.status(400).json({ message: "Patient already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const patient = new Patient({
      name,
      email,
      password: hashed,
      age,
      gender,
      contact,
    });

    await patient.save();
    return res.status(201).json({ message: "Patient created", patient });
  } catch (err) {
    console.error("Create patient error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ===================================================
   GET SINGLE PATIENT
=================================================== */
router.get("/:id", auth(), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const patient = await Patient.findById(id).select("-password");
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    res.json(patient);
  } catch (err) {
    console.error("Get patient error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===================================================
   UPDATE PATIENT
=================================================== */
router.put("/:id", auth(), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!isValidObjectId(id)) {
      return res.status(404).json({ msg: "Patient not found" });
    }

    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const patient = await Patient.findByIdAndUpdate(id, updates, {
      new: true,
    }).select("-password");

    if (!patient) return res.status(404).json({ msg: "Patient not found" });

    res.json({ patient });
  } catch (err) {
    console.error("Update patient error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;
