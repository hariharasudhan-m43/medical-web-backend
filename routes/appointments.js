// backend/routes/appointments.js
import express from "express";
import auth from "../middleware/auth.js";
import Appointment from "../models/Appointment.js";
import Message from "../models/Message.js";
import { getIO } from "../socketServer.js";

const router = express.Router();

const conversationIdFor = (a, b) => {
  const [x, y] = [String(a), String(b)].sort();
  return `${x}:${y}`;
};

const ACTIVE_STATUSES = ["Scheduled", "Pending", "Tentative", "Waitlist"];

router.post("/", auth(), async (req, res) => {
  try {
    const role = req.user.role;

    const patientId = role === "Doctor" || role === "Admin" ? req.body.patientId : req.user.id;

    const { doctorId, date, reason, type, duration, status, notes, time } = req.body;

    if (!doctorId || !date || !patientId) return res.status(400).json({ msg: "Doctor, date, and patient are required" });

    const slotDate = new Date(date);
    if (isNaN(slotDate.getTime())) return res.status(400).json({ msg: "Invalid date format" });

    if (slotDate < new Date()) return res.status(400).json({ msg: "Cannot book past date/time" });

    const exists = await Appointment.findOne({ doctorId, date: slotDate });
    if (exists) return res.status(409).json({ msg: "Slot already booked" });

    const appt = await Appointment.create({
      doctorId,
      patientId,
      date: slotDate,
      reason,
      type,
      duration,
      status,
      notes,
      time,
    });

    const populated = await Appointment.findById(appt._id)
      .populate("doctorId", "name")
      .populate("patientId", "name email");

    // Auto-create system/chat message so conversation appears
    try {
      const convId = conversationIdFor(patientId, doctorId);

      const dateLabel = slotDate.toLocaleDateString();
      const timeLabel = time || slotDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const summary = [
        `Appointment booked`,
        `Date: ${dateLabel}`,
        `Time: ${timeLabel}`,
        type ? `Type: ${type}` : "",
        reason ? `Reason: ${reason}` : ""
      ].filter(Boolean).join(" | ");

      const senderId = req.user.id;
      const senderModel = req.user.role === "Doctor" ? "Doctor" : "Patient";
      const receiverId = String(senderId) === String(patientId) ? doctorId : patientId;
      const receiverModel = senderModel === "Doctor" ? "Patient" : "Doctor";

      const msg = await Message.create({
        conversationId: convId,
        from: senderId,
        fromModel: senderModel,
        to: receiverId,
        toModel: receiverModel,
        text: summary,
        read: false,
      });

      const io = getIO();
      if (io) {
        io.to(`conversation:${convId}`).emit("message", msg);
        io.to(`user:${patientId}`).emit("message:notice", { conversationId: convId, message: msg });
        io.to(`user:${doctorId}`).emit("message:notice", { conversationId: convId, message: msg });
      }
    } catch (msgErr) {
      console.error("Failed to generate system chat message:", msgErr);
    }

    return res.status(201).json({ appointment: populated });
  } catch (err) {
    console.error("Create appointment error:", err);
    res.status(500).json({ msg: "Failed to create appointment" });
  }
});

// ... (rest of appointment endpoints unchanged, keep your existing handlers for history, delete, doctor/patient queries)
router.get("/history", auth(), async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user.id })
      .populate("doctorId", "name specialty specialization")
      .sort({ date: -1 });

    res.json(appointments);
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ msg: "Failed to load history" });
  }
});

router.delete("/:id", auth(), async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ msg: "Not found" });
    if (String(appt.patientId) !== req.user.id) return res.status(403).json({ msg: "Forbidden" });
    await Appointment.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
  } catch (err) {
    console.error("Delete appointment error:", err);
    res.status(500).json({ msg: "Failed to delete" });
  }
});

router.get("/doctor/:doctorId", async (req, res) => {
  try {
    const data = await Appointment.find({ doctorId: req.params.doctorId })
      .populate("patientId", "name email age gender contact")
      .populate("doctorId", "name specialty specialization")
      .sort({ date: 1 });

    res.json(data);
  } catch (err) {
    console.error("Doctor appointments fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/patient/:patientId", async (req, res) => {
  try {
    const data = await Appointment.find({ patientId: req.params.patientId })
      .populate("doctorId", "name specialty specialization")
      .populate("patientId", "name email")
      .sort({ date: -1 });

    res.json(data);
  } catch (err) {
    console.error("Patient appointments fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id/status", auth(), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ msg: "status required" });

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ msg: "Not found" });

    appt.status = status;
    await appt.save();

    const populated = await Appointment.findById(appt._id)
      .populate("doctorId", "name")
      .populate("patientId", "name email");

    res.json(populated);
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ msg: "Failed to update status" });
  }
});

router.get("/", async (req, res) => {
  try {
    const data = await Appointment.find()
      .populate("patientId", "name email age gender contact")
      .populate("doctorId", "name specialty specialization")
      .sort({ date: 1 });

    res.json(data);
  } catch (err) {
    console.error("All appointments fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
