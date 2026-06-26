import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db, { encrypt } from "./db";
import { SettingsSchema } from "./settings";

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
      let rawParsed: any = null;
      try {
        rawParsed = JSON.parse(guestSettingsCookie);
      } catch (e) {}

      if (rawParsed) {
        // Validate with identical strict SettingsSchema to prevent unvalidated input injection
        const parsedResult = SettingsSchema.safeParse(rawParsed);
        if (!parsedResult.success) {
          console.warn("[migrateGuestSettings] Invalid guest settings rejected:", parsedResult.error.format());
          return;
        }
        const validated = parsedResult.data;

        let finalEncryptedKey = "";
        if (rawParsed.encryptedGeminiApiKey) {
          finalEncryptedKey = String(rawParsed.encryptedGeminiApiKey);
        } else if (validated.geminiApiKey && validated.geminiApiKey !== "••••" && validated.geminiApiKey !== "••••••••••••••••") {
          finalEncryptedKey = encrypt(validated.geminiApiKey);
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
          validated.readingMode || "simplified",
          validated.lensIntensity || "balanced",
          validated.oddsFormat || "american",
          JSON.stringify(validated.regions || {}),
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

authRouter.get("/google/url", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(400).json({ error: "Google OAuth is not configured. Please set GOOGLE_CLIENT_ID in the app's Secrets panel." });
  }
  
  const redirectUri = req.query.redirectUri as string;
  if (!redirectUri) {
    return res.status(400).json({ error: "redirectUri query parameter is required" });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: redirectUri, // Pass redirectUri in state so callback knows where to post
    access_type: 'offline',
    prompt: 'consent'
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url: authUrl });
});

authRouter.get("/google/callback", async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: "${error}" }, '*');
              window.close();
            } else {
              window.location.href = '/?error=' + encodeURIComponent(String("${error}"));
            }
          </script>
          <p>Authentication failed: ${error}</p>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send("Authorization code is required");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).send("Google client credentials are not configured on the server. Please check your secrets configuration.");
  }

  const originalRedirectUri = state ? String(state) : "";
  if (!originalRedirectUri) {
    return res.status(400).send("OAuth state (redirect URI) is missing");
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: originalRedirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenResponse.json() as any;
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange authorization code");
    }

    const { access_token } = tokenData;

    const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { "Authorization": `Bearer ${access_token}` }
    });

    const userinfo = await userinfoResponse.json() as any;
    if (!userinfoResponse.ok) {
      throw new Error("Failed to fetch user profile from Google");
    }

    const email = userinfo.email;
    if (!email) {
      throw new Error("Google account does not have a verified email address");
    }

    // Check if user exists by email
    let user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email) as any;
    
    if (!user) {
      // Create user. Google authenticated users don't have a local password_hash.
      const id = uuidv4();
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, NULL)').run(id, email);
      user = { id, email };
    }

    // Auto login
    const sessionId = uuidv4();
    db.prepare("INSERT OR REPLACE INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").run(sessionId, user.id);
    
    res.cookie('bgl_session', sessionId, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production", 
      sameSite: 'lax', 
      maxAge: 30 * 24 * 60 * 60 * 1000 
    });
    
    // Migrate anonymous settings
    migrateGuestSettings(req, res, user.id);

    const userJson = JSON.stringify({ id: user.id, email: user.email });

    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: ${userJson} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Google OAuth Callback Error:", err);
    const errorMsg = err.message || String(err);
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: "${errorMsg.replace(/"/g, '\\"')}" }, '*');
              window.close();
            } else {
              window.location.href = '/?error=' + encodeURIComponent("${errorMsg}");
            }
          </script>
          <p>Authentication failed: ${errorMsg}</p>
        </body>
      </html>
    `);
  }
});

