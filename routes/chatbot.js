import express from "express";
import auth from "../middleware/auth.js";
import OpenAI from "openai";
import ChatSession from "../models/ChatSession.js";

const router = express.Router();

const client = new OpenAI({ apiKey: process.env.HF_TOKEN, baseURL: "https://router.huggingface.co/v1" });

router.post("/", auth(), async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ message: "Message is required" });

    const response = await client.chat.completions.create({
      model: "google/gemma-2-9b-it",
      messages: [{ role: "user", content: message }],
      max_tokens: 200,
      temperature: 0.7
    });

    const reply = response.choices?.[0]?.message?.content || null;
    if (!reply) return res.status(500).json({ message: "Chatbot model failed" });

    let session;
    if (sessionId) {
      // Append to existing session
      session = await ChatSession.findById(sessionId);
      if (session) {
        session.messages.push({ sender: "user", text: message });
        session.messages.push({ sender: "bot", text: reply });
        await session.save();
      }
    }

    if (!session) {
      // Create new session
      session = await ChatSession.create({
        userId: req.user.id,
        messages: [
          { sender: "user", text: message },
          { sender: "bot", text: reply }
        ]
      });
    }

    res.json({ message: reply, sessionId: session._id });

  } catch (err) {
    console.error("HF ERROR →", err.response?.data || err.message);
    res.status(500).json({ message: "Chatbot model failed" });
  }
});

// Get all sessions
router.get("/history", auth(), async (req, res) => {
  const sessions = await ChatSession.find({ userId: req.user.id }).sort({ createdAt: -1 });
  res.json(sessions);
});

// Delete a session
router.delete("/history/:id", auth(), async (req, res) => {
  await ChatSession.findByIdAndDelete(req.params.id);
  res.json({ msg: "Deleted" });
});

export default router;
