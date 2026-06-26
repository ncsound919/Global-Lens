import express from "express";
import { z } from "zod";
import db, { encrypt, decrypt } from "./db";
import { getAuthSession } from "./api";

export const settingsRouter = express.Router();

const SettingsSchema = z.object({
  readingMode: z.enum(['simplified', 'executive', 'academic', 'raw']).optional(),
  lensIntensity: z.enum(['balanced', 'pan_african', 'hyper_local', 'indigenous', 'marxist', 'decolonial']).optional(),
  oddsFormat: z.enum(['american', 'decimal', 'fractional']).optional(),
  regions: z.record(z.string(), z.boolean()).optional(),
  geminiApiKey: z.string().optional()
});

settingsRouter.get("/settings", (req, res) => {
  const session = getAuthSession(req);
  
  if (session) {
    // Authenticated path: Retrieve settings from the secure relational database
    const userId = session.user_id;
    let settings = db.prepare('SELECT * FROM user_settings WHERE owner_id = ?').get(userId) as any;
    
    if (!settings) {
       settings = {
         owner_id: userId,
         reading_mode: "simplified",
         lens_intensity: "balanced",
         odds_format: "american",
         regions: '{"us":true,"westAfrica":false,"caribbean":true}',
         gemini_api_key: ""
       };
       db.prepare(`
         INSERT OR IGNORE INTO user_settings (owner_id, reading_mode, lens_intensity, odds_format, regions, gemini_api_key) 
         VALUES (?, ?, ?, ?, ?, ?)
       `).run(
         userId, settings.reading_mode, settings.lens_intensity, settings.odds_format, settings.regions, settings.gemini_api_key
       );
    }
    
    // Format response matching expected front-end schema
    settings.session_id = settings.owner_id;
    try { 
      settings.regions = JSON.parse(settings.regions); 
    } catch (e) {
      settings.regions = { us: true, westAfrica: false, caribbean: true };
    }

    if (settings.gemini_api_key) {
      settings.gemini_api_key = "••••";
    } else {
      settings.gemini_api_key = "";
    }

    return res.json(settings);
  } else {
    // Anonymous/Guest path: Use secure cookie-based preference isolation
    let guestSettings = {
      reading_mode: "simplified",
      lens_intensity: "balanced",
      odds_format: "american",
      regions: { us: true, westAfrica: false, caribbean: true },
      gemini_api_key: ""
    };

    const cookieVal = req.cookies?.bgl_guest_settings;
    if (cookieVal) {
      try {
        const parsed = JSON.parse(cookieVal);
        guestSettings = {
          reading_mode: parsed.readingMode || "simplified",
          lens_intensity: parsed.lensIntensity || "balanced",
          odds_format: parsed.oddsFormat || "american",
          regions: parsed.regions || { us: true, westAfrica: false, caribbean: true },
          gemini_api_key: parsed.geminiApiKey ? "••••" : ""
        };
      } catch (e) {
        // Fallback to defaults on corrupt cookie
      }
    }

    return res.json({
      owner_id: "guest",
      session_id: "guest",
      ...guestSettings
    });
  }
});

settingsRouter.put("/settings", (req, res) => {
  const parsed = SettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid parameters" });
  }
  const body = parsed.data;
  const session = getAuthSession(req);

  if (session) {
    // Authenticated path: Update the persistent relational database record
    const userId = session.user_id;
    let finalEncryptedKey = "";
    
    if (body.geminiApiKey === "••••" || body.geminiApiKey === "••••••••••••••••") {
      const existing = db.prepare('SELECT gemini_api_key FROM user_settings WHERE owner_id = ?').get(userId) as any;
      finalEncryptedKey = existing?.gemini_api_key || "";
    } else if (body.geminiApiKey) {
      finalEncryptedKey = encrypt(body.geminiApiKey);
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
       body.readingMode || "simplified", 
       body.lensIntensity || "balanced", 
       body.oddsFormat || "american", 
       JSON.stringify(body.regions || {}),
       finalEncryptedKey
    );

    // Also clear any legacy guest setting cookie now that they are logged in
    res.clearCookie('bgl_guest_settings', {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: 'lax'
    });

    return res.json({ success: true });
  } else {
    // Guest path: Store the settings in an isolated, client-session cookie
    // Ensure we do not save any actual secret keys in a readable plaintext cookie!
    // If they set a geminiApiKey, we mask it or keep it as-is for the transient session.
    res.cookie('bgl_guest_settings', JSON.stringify(body), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    return res.json({ success: true });
  }
});
