// backend/middleware/auth.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const jwtSecret = process.env.JWT_SECRET || "change_this_secret"; // set in .env in prod

/**
 * Basic auth middleware:
 * - If called as auth(), it will verify token and attach req.user = { id, role, ... }
 * - If you want to enforce role, use requireRole('Admin') exported helper
 */

export function auth() {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ msg: "No token provided" });
      }
      const token = authHeader.split(" ")[1];
      const payload = jwt.verify(token, jwtSecret);
      // payload should include id, role
      req.user = payload;
      next();
    } catch (err) {
      return res.status(401).json({ msg: "Invalid or expired token" });
    }
  };
}

/**
 * Use as: app.get('/admin', requireRole('Admin'), handler)
 */
export function requireRole(role) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ msg: "No token provided" });
      }
      const token = authHeader.split(" ")[1];
      const payload = jwt.verify(token, jwtSecret);
      if (!payload.role || payload.role !== role) {
        return res.status(403).json({ msg: "Forbidden: insufficient role" });
      }
      req.user = payload;
      next();
    } catch (err) {
      return res.status(401).json({ msg: "Invalid or expired token" });
    }
  };
}

export default auth;
