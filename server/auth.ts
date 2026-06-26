import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db, { encrypt } from "./db";

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

/**
 * Migrates settings from bgl_guest_settings cookie into user_settings table for authenticated user.
 */
function migrateGuestSettings(req: express.Request, res: express.Response, userId: string) {
  try {
    const guestSettingsCookie = req.cookies?.bgl_guest_settings;
    if (guestSettingsCookie) {
      let parsed: any = null;
      try {
        parsed = JSON.parse(guestSettingsCookie);
      } catch (e) {}

      if (parsed) {
        let finalEncryptedKey = "";
        if (parsed.geminiApiKey && parsed.geminiApiKey !== "••••" && parsed.geminiApiKey !== "••••••••••••••••") {
          finalEncryptedKey = encrypt(parsed.geminiApiKey);
        }

        db.prepare(`
          INSERT INTO user_settings (owner_id, reading_mode, lens_intensity, odds_format, regions, gemini_api_key)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(owner_id) DO UPDATE SET
            reading_mode=excluded.reading_mode,
            lens_intensity=excluded.lens_intensity,
            odds_format=excluded.odds_format,
            regions=excluded.regions,
            gemini_api_key=excluded.gemini_api_key,
            updated_at=CURRENT_TIMESTAMP
        `).run(
          userId,
          parsed.readingMode || "simplified",
          parsed.lensIntensity || "balanced",
          parsed.oddsFormat || "american",
          JSON.stringify(parsed.regions || {}),
          finalEncryptedKey
        );
      }
    }
  } catch (err) {
    console.error("Failed to migrate anonymous guest settings:", err);
  } finally {
    res.clearCookie('bgl_guest_settings', {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: 'lax'
    });
  }
}

authRouter.post("/register", authLimiter, async (req, res) => {
  try {
    const parsed = AuthSchema.parse(req.body);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(parsed.email);
    if (existing) return res.status(400).json({ error: "Email already exists" });

    const id = uuidv4();
    const hash = await bcrypt.hash(parsed.password, 10);
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, parsed.email, hash);
    
    // Auto login
    const sessionId = uuidv4();
    db.prepare("INSERT OR REPLACE INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").run(sessionId, id);
    res.cookie('bgl_session', sessionId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
    
    // Migrate anonymous settings from cookie to authenticated user_id if present
    migrateGuestSettings(req, res, id);

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

    const sessionId = uuidv4();
    db.prepare("INSERT OR REPLACE INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").run(sessionId, user.id);
    res.cookie('bgl_session', sessionId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
    
    // Migrate anonymous settings from cookie to authenticated user_id if present
    migrateGuestSettings(req, res, user.id);

    res.json({ success: true, user: { id: user.id, email: user.email } });
  } catch(e: any) {
    res.status(400).json({ error: "Login failed" });
  }
});

authRouter.post("/logout", (req, res) => {
  const authSessionId = req.cookies?.bgl_session as string | undefined;

  if (authSessionId) {
    db.prepare('DELETE FROM sessions WHERE session_id = ?').run(authSessionId);
  }

  res.clearCookie('bgl_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  res.json({ success: true });   
});
