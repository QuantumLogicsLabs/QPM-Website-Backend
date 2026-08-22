import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, bio } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(400).json({ error: "Username is already taken." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash,
      bio: bio || ""
    });

    await user.save();

    const jwtSecret = process.env.JWT_SECRET || "quantum_package_manager_super_secret_jwt_key_2026";
    const token = jwt.sign({ id: user._id, username: user.username, email: user.email }, jwtSecret, {
      expiresIn: "7d"
    });

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: err.message || "Signup failed." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: "Email/Username and password are required." });
    }

    const query = emailOrUsername.includes("@")
      ? { email: emailOrUsername.toLowerCase() }
      : { username: emailOrUsername.toLowerCase() };

    const user = await User.findOne(query);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const jwtSecret = process.env.JWT_SECRET || "quantum_package_manager_super_secret_jwt_key_2026";
    const token = jwt.sign({ id: user._id, username: user.username, email: user.email }, jwtSecret, {
      expiresIn: "7d"
    });

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: err.message || "Login failed." });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req, res) => {
  try {
    return res.json({
      user: req.user
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch user profile." });
  }
});

export default router;
