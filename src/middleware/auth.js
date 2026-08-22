import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({ error: "Access denied. Token missing." });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || "quantum_package_manager_super_secret_jwt_key_2026";
    const decoded = jwt.verify(token, jwtSecret);

    if (decoded && decoded.id) {
      const user = await User.findById(decoded.id).select("-passwordHash");
      if (user) {
        req.user = user;
        return next();
      }
    }

    return res.status(401).json({ error: "Invalid authentication token or user not found." });
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token: " + err.message });
  }
};

export const optionalAuthenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return next();
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || "quantum_package_manager_super_secret_jwt_key_2026";
    const decoded = jwt.verify(token, jwtSecret);
    if (decoded && decoded.id) {
      const user = await User.findById(decoded.id).select("-passwordHash");
      if (user) {
        req.user = user;
      }
    }
  } catch (err) {
    // Ignore invalid optional tokens
  }
  next();
};
