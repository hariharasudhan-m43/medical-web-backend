// backend/routes/admin.js
import express from "express";
import bcrypt from "bcryptjs";
import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import Appointment from "../models/Appointment.js";
import { requireRole } from "../middleware/auth.js";
import { createAccountLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

/* ===========================
   HELPERS (validation)
   =========================== */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isStrongPassword(pw) {
  // minimal: 8 chars, upper, lower, number (adjust as needed)
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(pw);
}

/* ===========================
   CREATE DOCTOR (ADMIN only)
   =========================== */
router.post("/create-doctor", requireRole("Admin"), createAccountLimiter, async (req, res) => {
  try {
    const { name, email, password, specialty, experience, phone, hospital } = req.body;

    if (!name || !email || !password || !specialty) {
      return res.status(400).json({ message: "Name, email, password and specialty required" });
    }

    if (!isValidEmail(email)) return res.status(400).json({ message: "Invalid email format" });
    if (!isStrongPassword(password))
      return res.status(400).json({ message: "Password too weak. Use minimum 8 chars with upper/lower/number." });

    const exists = await Doctor.findOne({ email });
    if (exists) return res.status(400).json({ message: "Doctor already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const doctor = await Doctor.create({
      name,
      email,
      password: hashed,
      specialty,
      experience: experience || 0,
      phone: phone || "",
      hospital: hospital || "General Hospital",
    });

    res.status(201).json({ message: "Doctor created", doctorId: doctor._id });
  } catch (err) {
    console.error("Create doctor error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/* ===========================
   CREATE PATIENT (ADMIN only)
   =========================== */
router.post("/create-patient", requireRole("Admin"), createAccountLimiter, async (req, res) => {
  try {
    const { name, email, password, age, gender, contact } = req.body;

    if (!name || !email || !password || !age || !gender || !contact)
      return res.status(400).json({ message: "All fields required" });

    if (!isValidEmail(email)) return res.status(400).json({ message: "Invalid email format" });
    if (!isStrongPassword(password))
      return res.status(400).json({ message: "Password too weak. Use minimum 8 chars with upper/lower/number." });

    const exists = await Patient.findOne({ email });
    if (exists) return res.status(400).json({ message: "Patient already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const patient = await Patient.create({
      name,
      email,
      password: hashed,
      age,
      gender,
      contact,
    });

    res.status(201).json({ message: "Patient created", patientId: patient._id });
  } catch (err) {
    console.error("Create patient error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/* ===========================
   ASSIGN / UNASSIGN PATIENT
   - Admin only
   =========================== */

router.post("/assign-patient", requireRole("Admin"), async (req, res) => {
  try {
    const { doctorId, patientId } = req.body;
    if (!doctorId || !patientId) return res.status(400).json({ message: "doctorId and patientId required" });

    const doctor = await Doctor.findById(doctorId);
    const patient = await Patient.findById(patientId);
    if (!doctor || !patient) return res.status(404).json({ message: "Doctor or patient not found" });

    // add patient to doctor's list if not present
    if (!doctor.patients.map(String).includes(String(patientId))) {
      doctor.patients.push(patientId);
      await doctor.save();
    }

    // set patient's primaryDoctor (optional — admin-assigned)
    patient.primaryDoctor = doctorId;
    await patient.save();

    res.json({ message: "Patient assigned to doctor", doctorId, patientId });
  } catch (err) {
    console.error("Assign patient error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/unassign-patient", requireRole("Admin"), async (req, res) => {
  try {
    const { doctorId, patientId } = req.body;
    if (!doctorId || !patientId) return res.status(400).json({ message: "doctorId and patientId required" });

    const doctor = await Doctor.findById(doctorId);
    const patient = await Patient.findById(patientId);
    if (!doctor || !patient) return res.status(404).json({ message: "Doctor or patient not found" });

    doctor.patients = doctor.patients.filter((p) => String(p) !== String(patientId));
    await doctor.save();

    if (String(patient.primaryDoctor) === String(doctorId)) {
      patient.primaryDoctor = null;
      await patient.save();
    }

    res.json({ message: "Patient unassigned from doctor", doctorId, patientId });
  } catch (err) {
    console.error("Unassign patient error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   EXISTING READ/DELETE ROUTES
   (unchanged but kept here)
   =========================== */

router.get("/doctors", requireRole("Admin"), async (req, res) => {
  try {
    const doctors = await Doctor.find().select("-password");
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/patients", requireRole("Admin"), async (req, res) => {
  try {
    const patients = await Patient.find().select("-password");
    res.json(patients);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/doctors/:id", requireRole("Admin"), async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndDelete(req.params.id);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    res.json({ message: "Doctor deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/patients/:id", requireRole("Admin"), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json({ message: "Patient deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
