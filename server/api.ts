import express from "express";
import rateLimit from "express-rate-limit";
import db from "./db";
import { syncRSSNews, getFeedHealth } from "./rss";
import { authRouter } from "./auth";
import { settingsRouter } from "./settings";
import { newsRouter } from "./news";

const standardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // max 120 requests per minute for public API protection
  validate: { xForwardedForHeader: false }
});

const syncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 2, // 2 syncs per 5 minutes per IP
  message: { detail: 'Too many sync requests. Please try again later.' },
  validate: { xForwardedForHeader: false }
});

export const apiRouter = express.Router();
apiRouter.use(standardLimiter);

/**
 * Validates session against database to return authenticated details.
 * Strictly uses the secure HTTP-only bgl_session cookie for session identification.
 */
export function getAuthSession(req: express.Request) {
  const sessionId = req.cookies?.bgl_session as string | undefined;
  if (!sessionId) return null;
  
  try {
    const session = db.prepare(`
      SELECT s.session_id, s.user_id, u.email 
      FROM sessions s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.session_id = ? 
        AND (s.expires_at IS NULL OR datetime(s.expires_at) > datetime('now'))
        AND datetime(s.created_at, '+30 days') > datetime('now')
    `).get(sessionId) as any;
    
    return session || null;
  } catch (e) {
    console.error("getAuthSession error:", e);
    return null;
  }
}

// Register sub-routers
apiRouter.use("/auth", authRouter);
apiRouter.use("/user", settingsRouter);
apiRouter.use("/news", newsRouter);

// Service utility endpoints
apiRouter.get("/health", (req, res) => {
  try {
    const isDbAlive = db.prepare("SELECT 1").get();
    if (!isDbAlive) throw new Error("DB unreachable");
    const feedCount = db.prepare("SELECT COUNT(*) as c FROM rss_feeds").get() as any;
    res.json({ 
       status: "ok", 
       timestamp: new Date().toISOString(),
       db: "connected",
       feeds: feedCount?.c || 0
    });
  } catch (err: any) {
    console.error("Health check failed:", err.message);
    res.status(503).json({ status: "error", details: "Service unavailable" });
  }
});

apiRouter.post("/sync", syncLimiter, (req, res) => {
  syncRSSNews();
  res.json({ success: true, message: "Sync started" });
});

apiRouter.get("/feeds/health", (req, res) => {
  res.json({ health: getFeedHealth() });
});
