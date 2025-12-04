import express from "express";
import Message from "../models/Message.js";
import auth from "../middleware/auth.js";

const router = express.Router();

const conversationIdFor = (a, b) => {
  const [x, y] = [String(a), String(b)].sort();
  return `${x}:${y}`;
};

// GET conversation list
router.get("/conversations", auth(), async (req, res) => {
  try {
    const userId = req.user.id;

    const convs = await Message.aggregate([
      { $match: { $or: [{ from: userId }, { to: userId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversationId",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$to", userId] }, { $eq: ["$read", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    const result = convs.map((c) => {
      const [a, b] = c._id.split(":");
      const other = a === String(userId) ? b : a;

      return {
        conversationId: c._id,
        otherUser: other,
        lastMessage: c.lastMessage,
        unreadCount: c.unreadCount,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Conversation Error:", err);
    res.status(500).json({ msg: "Failed to load conversations" });
  }
});

// GET messages for a conversation
router.get("/:conversationId", auth(), async (req, res) => {
  try {
    const { conversationId } = req.params;
    const [a, b] = conversationId.split(":");

    if (![a, b].includes(String(req.user.id))) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const msgs = await Message.find({ conversationId }).sort({ createdAt: 1 });

    await Message.updateMany(
      { conversationId, to: req.user.id },
      { $set: { read: true } }
    );

    res.json(msgs);
  } catch (err) {
    console.error("Load message error:", err);
    res.status(500).json({ msg: "Failed to load messages" });
  }
});

// SEND message
router.post("/", auth(), async (req, res) => {
  try {
    const from = req.user.id;
    const fromModel = req.user.role === "Doctor" ? "Doctor" : "Patient";

    const { to, toModel, text } = req.body;

    const convId = conversationIdFor(from, to);

    const msg = await Message.create({
      conversationId: convId,
      from,
      fromModel,
      to,
      toModel,
      text,
      read: false,
    });

    res.status(201).json(msg);
  } catch (err) {
    console.error("Send error:", err);
    res.status(500).json({ msg: "Failed to send message" });
  }
});

export default router;
