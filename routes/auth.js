import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";

dotenv.config();
const router = express.Router();

// Hardcoded admin credentials
const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "admin123";

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("Missing JWT_SECRET");
      return res.status(500).json({ msg: "Server misconfiguration" });
    }

    // ADMIN LOGIN
    if (role.toLowerCase() === "admin") {
      if (
        email.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
        password === ADMIN_PASSWORD
      ) {
        const token = jwt.sign({ id: "admin-id", role: "Admin" }, process.env.JWT_SECRET, {
          expiresIn: "7d",
        });

        return res.json({
          token,
          role: "Admin",
          user: { _id: "admin-id", name: "Admin", email: ADMIN_EMAIL },
        });
      } else {
        return res.status(401).json({ msg: "Invalid admin credentials" });
      }
    }

    // DOCTOR OR PATIENT LOGIN
    const Model = role === "Doctor" ? Doctor : Patient;

    const user = await Model.findOne({ email }).select("+password");
    if (!user) return res.status(404).json({ msg: `${role} not found` });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      role,
      user: { _id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error: " + err.message });
  }
});

export default router;
