// backend/routes/messages.js
import express from "express";
import Message from "../models/Message.js";
import Appointment from "../models/Appointment.js";
import auth from "../middleware/auth.js";
import { getIO } from "../socketServer.js";

const router = express.Router();

// canonical conversation id for two ids
const conversationIdFor = (a, b) => {
  const [x, y] = [String(a), String(b)].sort();
  return `${x}:${y}`;
};

/**
 * GET /api/messages/conversations
 * Returns merged conversation heads coming from:
 *  - messages collection (real chat messages)
 *  - appointments collection (appointment relationships create implicit chats)
 *
 * Response: [{ conversationId, otherUser, lastMessage, unreadCount }]
 */
router.get("/conversations", auth(), async (req, res) => {
  try {
    const userId = String(req.user.id);

    // 1) message-based heads (latest message per conversation)
    const messageHeads = await Message.aggregate([
      { $match: { $or: [{ from: req.user.id }, { to: req.user.id }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversationId",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$to", req.user.id] }, { $eq: ["$read", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    const messageResults = messageHeads.map((c) => {
      const parts = c._id.split(":");
      const otherUser = parts[0] === userId ? parts[1] : parts[0];
      return {
        conversationId: c._id,
        otherUser,
        lastMessage: {
          text: c.lastMessage.text,
          from: c.lastMessage.from,
          to: c.lastMessage.to,
          createdAt: c.lastMessage.createdAt,
        },
        unreadCount: c.unreadCount || 0,
        source: "message",
      };
    });

    // 2) appointment-based heads
    // Find appointments where user is either patient or doctor and build a head for the counterpart.
    // Only include if there isn't already a message-based head for that conversation.
    const apptMatch = {
      $or: [{ patientId: req.user.id }, { doctorId: req.user.id }],
    };

    const apptDocs = await Appointment.find(apptMatch)
      .select("patientId doctorId date type reason status")
      .lean();

    const apptMap = new Map(); // convId => head

    for (const a of apptDocs) {
      const patientId = String(a.patientId);
      const doctorId = String(a.doctorId);
      const convId = conversationIdFor(patientId, doctorId);
      if (apptMap.has(convId)) {
        // keep the most recent appointment summary
        const prev = apptMap.get(convId);
        if (new Date(a.date) > new Date(prev.date)) apptMap.set(convId, a);
      } else {
        apptMap.set(convId, a);
      }
    }

    // Build appointment heads array, but skip those that already exist in messageResults
    const messageConvIds = new Set(messageResults.map((m) => m.conversationId));

    const apptResults = [];
    for (const [convId, appt] of apptMap.entries()) {
      if (messageConvIds.has(convId)) continue;

      // decide otherUser relative to current user
      const parts = convId.split(":");
      const otherUser = parts[0] === userId ? parts[1] : parts[0];

      // Build a small lastMessage-like object describing the appointment
      const dateLabel = appt.date ? new Date(appt.date).toLocaleString() : "";
      const summaryParts = [`Appointment`];
      if (appt.type) summaryParts.push(appt.type);
      if (dateLabel) summaryParts.push(dateLabel);
      if (appt.reason) summaryParts.push(`Reason: ${String(appt.reason).slice(0, 80)}`);
      const txt = summaryParts.join(" | ");

      apptResults.push({
        conversationId: convId,
        otherUser,
        lastMessage: {
          text: txt,
          from: null,
          to: null,
          createdAt: appt.date || null,
        },
        unreadCount: 0,
        source: "appointment",
      });
    }

    // 3) merge messageResults + apptResults preserving sort by createdAt desc
    const merged = [...messageResults, ...apptResults];

    merged.sort((a, b) => {
      const ta = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const tb = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return tb - ta;
    });

    res.json(merged);
  } catch (err) {
    console.error("Conversations error:", err);
    res.status(500).json({ message: "Failed to load conversations" });
  }
});

/* ---------------------------------------------------
   GET /api/messages/:conversationId
   (unchanged behavior) - keep for ChatWindow
----------------------------------------------------*/
router.get("/:conversationId", auth(), async (req, res) => {
  try {
    const { conversationId } = req.params;
    const [a, b] = conversationId.split(":");
    if (![a, b].includes(String(req.user.id))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).lean();

    // mark read
    await Message.updateMany({ conversationId, to: req.user.id, read: false }, { $set: { read: true } });

    res.json(messages);
  } catch (err) {
    console.error("Load messages error:", err);
    res.status(500).json({ message: "Failed to load messages" });
  }
});

/* ---------------------------------------------------
   POST /api/messages   (send message)
----------------------------------------------------*/
router.post("/", auth(), async (req, res) => {
  try {
    const from = req.user.id;
    const { to, text } = req.body;
    if (!to || !text) return res.status(400).json({ message: "to & text required" });

    const conversationId = conversationIdFor(from, to);

    const msg = await Message.create({
      conversationId,
      from,
      to,
      text,
      read: false,
    });

    const saved = await Message.findById(msg._id).lean();

    // push socket notice if io available
    try {
      const io = getIO();
      if (io) {
        io.to(`conversation:${conversationId}`).emit("message", saved);
        io.to(`user:${to}`).emit("message:notice", { conversationId, message: saved });
      }
    } catch (emitErr) {
      console.error("Emit error after sending message:", emitErr);
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

export default router;
