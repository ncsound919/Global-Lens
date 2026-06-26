import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db from "./db";
import { getAuthSession } from "./api"; // we'll export getAuthSession from api or keep a copy

export const authRouter = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  validate: { xForwardedForHeader: false }
});

const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

authRouter.post("/register", authLimiter, async (req, res) => {
  try {
    const parsed = AuthSchema.parse(req.body);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(parsed.email);
    if (existing) return res.status(400).json({ error: "Email already exists" });

    const id = uuidv4();
    const hash = await bcrypt.hash(parsed.password, 10);
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, parsed.email, hash);
    
    // Auto login
    const sessionId = (req as any).sessionId || uuidv4();
    db.prepare("INSERT OR REPLACE INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").run(sessionId, id);
    res.cookie('bgl_session', sessionId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
    
    // Migrate anonymous settings to authenticated user_id if present
    try {
      const anonId = (req as any).sessionId;
      if (anonId && anonId !== id) {
        const anonSettings = db.prepare('SELECT * FROM user_settings WHERE owner_id = ?').get(anonId) as any;
        if (anonSettings) {
          const userSettings = db.prepare('SELECT 1 FROM user_settings WHERE owner_id = ?').get(id);
          if (!userSettings) {
            db.prepare(`
              INSERT INTO user_settings (owner_id, reading_mode, lens_intensity, odds_format, regions, gemini_api_key)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(id, anonSettings.reading_mode, anonSettings.lens_intensity, anonSettings.odds_format, anonSettings.regions, anonSettings.gemini_api_key);
          }
        }
      }
    } catch (err) {
      console.error("Failed to migrate anonymous settings during registration:", err);
    }

    res.json({ success: true, user: { id, email: parsed.email } });
  } catch(e: any) {
    res.status(400).json({ error: e.message || "Registration failed" });
  }
});

authRouter.post("/login", authLimiter, async (req, res) => {
  try {
    const parsed = AuthSchema.parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(parsed.email) as any;
    if (!user || !(await bcrypt.compare(parsed.password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const sessionId = (req as any).sessionId || uuidv4();
    db.prepare("INSERT OR REPLACE INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").run(sessionId, user.id);
    res.cookie('bgl_session', sessionId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
    
    // Migrate anonymous settings to authenticated user_id if present
    try {
      const anonId = (req as any).sessionId;
      if (anonId && anonId !== user.id) {
        const anonSettings = db.prepare('SELECT * FROM user_settings WHERE owner_id = ?').get(anonId) as any;
        if (anonSettings) {
          const userSettings = db.prepare('SELECT 1 FROM user_settings WHERE owner_id = ?').get(user.id);
          if (!userSettings) {
            db.prepare(`
              INSERT INTO user_settings (owner_id, reading_mode, lens_intensity, odds_format, regions, gemini_api_key)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(user.id, anonSettings.reading_mode, anonSettings.lens_intensity, anonSettings.odds_format, anonSettings.regions, anonSettings.gemini_api_key);
          }
        }
      }
    } catch (err) {
      console.error("Failed to migrate anonymous settings during login:", err);
    }

    res.json({ success: true, user: { id: user.id, email: user.email } });
  } catch(e: any) {
    res.status(400).json({ error: "Login failed" });
  }
});

authRouter.post("/logout", (req, res) => {
  const authSessionId = req.cookies?.bgl_session as string | undefined;
  const anonSessionId = req.cookies?.session_id as string | undefined;

  if (authSessionId) {
    db.prepare('DELETE FROM sessions WHERE session_id = ?').run(authSessionId);
  }

  res.clearCookie('bgl_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  if (anonSessionId) {
    res.clearCookie('session_id', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
  }

  res.json({ success: true });   
});
