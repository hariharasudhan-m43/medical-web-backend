// routes/health.js
import express from "express";
import auth from "../middleware/auth.js";
import OpenAI from "openai";
import HealthHistory from "../models/HealthHistory.js";

const router = express.Router();

const client = new OpenAI({
  apiKey: process.env.HF_TOKEN,
  baseURL: "https://router.huggingface.co/v1"
});

const MODEL = "meta-llama/Llama-3.1-8B-Instruct";

router.post("/predict", auth(), async (req, res) => {
  try {
    // NEW FIELDS ADDED
    const { age, weight, bloodSugar, heartRate, bp, symptoms } = req.body;

    // Validation
    if (!age || !weight || !bloodSugar || !heartRate || !bp || !symptoms) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // AI prompt updated to include new fields
    const prompt = `
You are a medical risk assessment assistant.
Create a professional, clinical-style health risk report based on the input data.

INPUT DATA:
- Age: ${age}
- Weight: ${weight} kg
- Blood Sugar: ${bloodSugar} mg/dL
- Heart Rate: ${heartRate} bpm
- Blood Pressure: ${bp}
- Symptoms: ${symptoms}

Provide:
1. Key risk indicators
2. Possible medical implications
3. Suggested actions
4. Whether urgent medical care is recommended
    `;

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0.4
    });

    const result = response.choices?.[0]?.message?.content;
    if (!result) {
      return res.status(500).json({ message: "Model returned no output" });
    }

    // Save to history with new fields
    await HealthHistory.create({
      userId: req.user.id,
      age,
      weight,
      bloodSugar,
      heartRate,
      bp,
      symptoms,
      result
    });

    res.json({ message: result });

  } catch (err) {
    console.error("Health predictor error:", err.response?.data || err.message);
    res.status(500).json({ message: "Prediction failed" });
  }
});

// Get history
router.get("/history", auth(), async (req, res) => {
  const history = await HealthHistory.find({ userId: req.user.id }).sort({ createdAt: -1 });
  res.json(history);
});

// Delete single history item
router.delete("/history/:id", auth(), async (req, res) => {
  const { id } = req.params;
  await HealthHistory.findByIdAndDelete(id);
  res.json({ msg: "Deleted" });
});

export default router;
