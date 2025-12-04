// backend/routes/doctors.js
import express from "express";
import bcrypt from "bcryptjs";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";

const router = express.Router();

/* ----------------------------- ALL DOCTORS LIST ----------------------------- */
router.get("/", async (req, res) => {
  try {
    const doctors = await Doctor.find().select("-password").lean();
    res.json(doctors);
  } catch (err) {
    console.error("Doctors List Error:", err);
    res.status(500).json({ message: "Server error fetching doctors" });
  }
});

/* -------------------------- GET AVAILABLE SLOTS ---------------------------- */
/**
 * GET /api/doctors/:doctorId/slots?date=YYYY-MM-DD
 * Returns list of slots for the requested date with `available: true/false`.
 */
router.get("/:doctorId/slots", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query; // required e.g. "2025-11-20"
    if (!date) return res.status(400).json({ message: "date query required (YYYY-MM-DD)" });

    const doctor = await Doctor.findById(doctorId).lean();
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    // check workingDays
    const requested = new Date(date + "T00:00:00");
    const day = requested.getDay(); // 0..6
    if (doctor.workingDays && doctor.workingDays.length && !doctor.workingDays.includes(day)) {
      return res.json({ slots: [] });
    }

    // determine working hours & slot length
    const wh = doctor.workingHours || { start: "09:00", end: "17:00", slotMinutes: 30 };
    const [startHour, startMin] = wh.start.split(":").map(Number);
    const [endHour, endMin] = wh.end.split(":").map(Number);
    const slotMinutes = wh.slotMinutes || 30;

    // build slot datetimes for that date in local time (ISO)
    const slots = [];
    let cursor = new Date(date + "T00:00:00");
    cursor.setHours(startHour, startMin, 0, 0);
    const endDT = new Date(date + "T00:00:00");
    endDT.setHours(endHour, endMin, 0, 0);

    while (cursor < endDT) {
      const slotStart = new Date(cursor);
      const slotISO = slotStart.toISOString(); // use full datetime as slot id
      slots.push({
        start: slotISO,
        label: slotStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      cursor = new Date(cursor.getTime() + slotMinutes * 60000);
    }

    // load appointments for that doctor on that date (range)
    const dayStart = new Date(date + "T00:00:00");
    const dayEnd = new Date(date + "T23:59:59.999");

    const booked = await Appointment.find({
      doctorId,
      date: { $gte: dayStart, $lte: dayEnd }
    }).select("date").lean();

    // map booked times to ISO for quick check (normalize)
    const bookedSet = new Set(booked.map(b => new Date(b.date).toISOString()));

    const result = slots.map(s => ({
      start: s.start,
      label: s.label,
      available: !bookedSet.has(s.start)
    }));

    res.json({ slots: result });
  } catch (err) {
    console.error("Slots error:", err);
    res.status(500).json({ message: "Failed to build slots" });
  }
});


/* -------------------------------- PROFILE -------------------------------- */
router.get("/profile/:id", async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select("-password").lean();
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    res.json(doctor);
  } catch (err) {
    console.error("Profile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------------------- UPDATE PROFILE ------------------------------ */
router.put("/profile/:id", async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const doctor = await Doctor.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    }).select("-password").lean();

    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    res.json({ message: "Profile updated", doctor });
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ----------------------------- APPOINTMENTS ------------------------------- */
/**
 * GET /api/doctors/appointments/:doctorId
 * Returns appointments for a doctor, populates patientId and returns both
 * patientId and patient (frontend compatibility).
 */
router.get("/appointments/:doctorId", async (req, res) => {
  try {
    const appointments = await Appointment.find({
      doctorId: req.params.doctorId,
    })
      .populate({ path: "patientId", select: "name age gender email contact", model: "Patient" })
      .populate({ path: "doctorId", select: "name specialty phone hospital", model: "Doctor" })
      .sort({ date: 1 });

    // Defensive: ensure patientId exists and expose both shapes (patient + patientId)
    const formatted = appointments.map(a => {
      const obj = a.toObject ? a.toObject() : { ...a };
      return {
        ...obj,
        patient: obj.patientId || null,
        doctor: obj.doctorId || null,
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error("Appointment Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------ PATIENT LIST ------------------------------ */
router.get("/patients/:doctorId", async (req, res) => {
  try {
    const appointments = await Appointment.find({
      doctorId: req.params.doctorId,
    })
      .populate("patientId", "name age gender email contact medicalHistory")
      .lean();

    // Map to patient objects, filter out nulls (defensive)
    const patientsRaw = appointments.map((a) => a.patientId).filter(Boolean);

    // dedupe by _id safely
    const uniquePatients = [
      ...new Map(patientsRaw.map((p) => [String(p._id), p])).values(),
    ];

    res.json(uniquePatients);
  } catch (err) {
    console.error("Patient Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------------- DASHBOARD -------------------------------- */
router.get("/dashboard/:doctorId", async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    const totalAppointments = await Appointment.countDocuments({ doctorId });
    const upcomingAppointments = await Appointment.countDocuments({
      doctorId,
      date: { $gte: new Date() },
    });
    const totalPatients = (
      await Appointment.distinct("patientId", { doctorId })
    ).filter(Boolean).length;

    res.json({
      totalAppointments,
      upcomingAppointments,
      totalPatients,
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
