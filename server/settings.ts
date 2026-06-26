import express from "express";
import { z } from "zod";
import db, { encrypt, decrypt } from "./db";
import { getSettingsIdentifier } from "./api";

export const settingsRouter = express.Router();

const SettingsSchema = z.object({
  readingMode: z.enum(['simplified', 'executive', 'academic', 'raw']).optional(),
  lensIntensity: z.enum(['balanced', 'pan_african', 'hyper_local', 'indigenous', 'marxist', 'decolonial']).optional(),
  oddsFormat: z.enum(['american', 'decimal', 'fractional']).optional(),
  regions: z.record(z.string(), z.boolean()).optional(),
  geminiApiKey: z.string().optional()
});

settingsRouter.get("/settings", (req, res) => {
  const identifier = getSettingsIdentifier(req);
  let settings = db.prepare('SELECT * FROM user_settings WHERE owner_id = ?').get(identifier) as any;
  if (!settings) {
     settings = {
       owner_id: identifier,
       reading_mode: "simplified",
       lens_intensity: "balanced",
       odds_format: "american",
       regions: '{"us":true,"westAfrica":false,"caribbean":true}',
       gemini_api_key: ""
     };
     db.prepare('INSERT OR IGNORE INTO user_settings (owner_id, reading_mode, lens_intensity, odds_format, regions, gemini_api_key) VALUES (?, ?, ?, ?, ?, ?)').run(
       identifier, settings.reading_mode, settings.lens_intensity, settings.odds_format, settings.regions, settings.gemini_api_key
     );
  }
  
  // Backward compatibility alias for frontend compatibility
  settings.session_id = settings.owner_id;
  try { settings.regions = JSON.parse(settings.regions); } catch (e) {}

  // Secure masking: Stop returning any stored key data or its length in GET /user/settings
  if (settings.gemini_api_key) {
    settings.gemini_api_key = "••••";
  } else {
    settings.gemini_api_key = "";
  }

  res.json(settings);
});

settingsRouter.put("/settings", (req, res) => {
  const identifier = getSettingsIdentifier(req);
  
  const parsed = SettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid parameters" });
  }
  const body = parsed.data;

  let finalEncryptedKey = "";
  if (body.geminiApiKey === "••••" || body.geminiApiKey === "••••••••••••••••") {
    // Keep existing key if it was not modified
    const existing = db.prepare('SELECT gemini_api_key FROM user_settings WHERE owner_id = ?').get(identifier) as any;
    finalEncryptedKey = existing?.gemini_api_key || "";
  } else if (body.geminiApiKey) {
    // Encrypt the new key using authenticated encryption (AES-256-GCM)
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
     identifier, 
     body.readingMode || "simplified", 
     body.lensIntensity || "balanced", 
     body.oddsFormat || "american", 
     JSON.stringify(body.regions || {}),
     finalEncryptedKey
  );
  res.json({ success: true });
});
