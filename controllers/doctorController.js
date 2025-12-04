import Appointment from "../models/Appointment.js"; // <-- matches your file name

/* --------------------------- GET APPOINTMENTS --------------------------- */
export const getAppointmentsByDoctor = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    const appointments = await Appointment.find({ doctorId })
      .populate("patientId", "name age gender email");

    res.json(appointments);
  } catch (err) {
    console.error("Appointment Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ------------------------------ PATIENT LIST ------------------------------ */
export const getPatientsByDoctor = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    const appointments = await Appointment.find({ doctorId })
      .populate("patientId", "name age gender email");

    const patients = appointments.map(a => a.patientId);

    const uniquePatients = [
      ...new Map(patients.map((p) => [p._id.toString(), p])).values(),
    ];

    res.json(uniquePatients);
  } catch (err) {
    console.error("Patient Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ------------------------------- DASHBOARD -------------------------------- */
export const getDoctorDashboard = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    const totalAppointments = await Appointment.countDocuments({ doctorId });

    const upcomingAppointments = await Appointment.countDocuments({
      doctorId,
      date: { $gte: new Date() },
    });

    const totalPatients = (
      await Appointment.distinct("patientId", { doctorId })
    ).length;

    res.json({
      totalAppointments,
      upcomingAppointments,
      totalPatients,
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
