import express from "express";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";

const router = express.Router();

router.get("/:doctorId", async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    const doctor = await Doctor.findById(doctorId).select("-password");
    if (!doctor)
      return res.status(404).json({ message: "Doctor not found" });

    const totalAppointments = await Appointment.countDocuments({ doctorId });
    const upcomingAppointments = await Appointment.countDocuments({
      doctorId,
      date: { $gte: new Date() },
    });

    const totalPatients = (
      await Appointment.distinct("patientId", { doctorId })
    ).length;

    const recent = await Appointment.find({ doctorId })
      .sort({ date: -1 })
      .limit(5)
      .populate("patientId", "name");

    res.json({
      stats: { totalAppointments, upcomingAppointments, totalPatients },
      recent,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
