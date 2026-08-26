import express from "express";
import { z } from "zod";
import db, { encrypt, decrypt } from "./db.js";
import { getAuthSession } from "./api.js";

export const settingsRouter = express.Router();

export const SettingsSchema = z.object({
  readingMode: z.enum(['simplified', 'executive', 'academic', 'raw']).optional(),
  lensIntensity: z.enum(['balanced', 'pan_african', 'hyper_local', 'indigenous', 'marxist', 'decolonial']).optional(),
  oddsFormat: z.enum(['american', 'decimal', 'fractional']).optional(),
  regions: z.record(z.string().max(50), z.boolean()).optional(),
  geminiApiKey: z.string().max(250).optional()
});

settingsRouter.get("/settings", async (req, res) => {
  const session = await getAuthSession(req);
  
  if (session) {
    // Authenticated path: Retrieve settings from the secure relational database
    const userId = session.user_id;
    let settings = await db.prepare('SELECT * FROM user_settings WHERE owner_id = ?').get(userId) as any;
    
    if (!settings) {
       settings = {
         owner_id: userId,
         reading_mode: "simplified",
         lens_intensity: "balanced",
         odds_format: "american",
         regions: '{"us":true,"westAfrica":false,"caribbean":true}',
         gemini_api_key: ""
       };
       await db.prepare(`
         INSERT OR IGNORE INTO user_settings (owner_id, reading_mode, lens_intensity, odds_format, regions, gemini_api_key) 
         VALUES (?, ?, ?, ?, ?, ?)
       `).run(
         userId, settings.reading_mode, settings.lens_intensity, settings.odds_format, settings.regions, settings.gemini_api_key
       );
    }
    
    let parsedRegions = { us: true, westAfrica: false, caribbean: true };
    try { 
      parsedRegions = JSON.parse(settings.regions); 
    } catch (e) {}

    const isKeySet = !!settings.gemini_api_key;

    // Do NOT return any owner_id or session_id to protect user privacy
    return res.json({
      reading_mode: settings.reading_mode,
      lens_intensity: settings.lens_intensity,
      odds_format: settings.odds_format,
      regions: parsedRegions,
      gemini_api_key: isKeySet ? "â€¢â€¢â€¢â€¢" : ""
    });
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
          gemini_api_key: parsed.encryptedGeminiApiKey ? "â€¢â€¢â€¢â€¢" : ""
        };
      } catch (e) {
        // Fallback to defaults on corrupt cookie
      }
    }

    return res.json({
      reading_mode: guestSettings.reading_mode,
      lens_intensity: guestSettings.lens_intensity,
      odds_format: guestSettings.odds_format,
      regions: guestSettings.regions,
      gemini_api_key: guestSettings.gemini_api_key
    });
  }
});

settingsRouter.put("/settings", async (req, res) => {
  const parsed = SettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid parameters" });
  }
  const body = parsed.data;
  const session = await getAuthSession(req);

  if (session) {
    // Authenticated path: Update the persistent relational database record
    const userId = session.user_id;
    let finalEncryptedKey = "";
    
    if (body.geminiApiKey === "â€¢â€¢â€¢â€¢" || body.geminiApiKey === "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢") {
      const existing = await db.prepare('SELECT gemini_api_key FROM user_settings WHERE owner_id = ?').get(userId) as any;
      finalEncryptedKey = existing?.gemini_api_key || "";
    } else if (body.geminiApiKey) {
      finalEncryptedKey = encrypt(body.geminiApiKey);
    }

    await db.prepare(`
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
    // Guest path: Store settings securely in cookie. Encrypt sensitive keys first.
    let existingEncryptedKey = "";
    const cookieVal = req.cookies?.bgl_guest_settings;
    if (cookieVal) {
      try {
        const parsedCookie = JSON.parse(cookieVal);
        existingEncryptedKey = parsedCookie.encryptedGeminiApiKey || "";
      } catch (e) {}
    }

    let finalEncryptedKey = "";
    if (body.geminiApiKey === "â€¢â€¢â€¢â€¢" || body.geminiApiKey === "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢") {
      finalEncryptedKey = existingEncryptedKey;
    } else if (body.geminiApiKey) {
      finalEncryptedKey = encrypt(body.geminiApiKey);
    }

    const cookiePayload = {
      readingMode: body.readingMode || "simplified",
      lensIntensity: body.lensIntensity || "balanced",
      oddsFormat: body.oddsFormat || "american",
      regions: body.regions || { us: true, westAfrica: false, caribbean: true },
      encryptedGeminiApiKey: finalEncryptedKey
    };

    const serialized = JSON.stringify(cookiePayload);
    if (serialized.length > 2000) {
      return res.status(400).json({ error: "Settings payload exceeds safe cookie size limits" });
    }

    res.cookie('bgl_guest_settings', serialized, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    return res.json({ success: true });
  }
});
