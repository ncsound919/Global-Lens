import express from "express";
import db from "./db";
import { syncRSSNews } from "./rss";
import rateLimit from "express-rate-limit";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

// Rate limiting for AI backstory endpoint
const backstoryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per IP
  message: { detail: 'Too many backstory generation requests. Please try again later.' },
  validate: { xForwardedForHeader: false }
});

const standardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  validate: { xForwardedForHeader: false }
});

export const apiRouter = express.Router();
apiRouter.use(standardLimiter);

// Create simple debounce logic
let syncTimeout: NodeJS.Timeout;

const SettingsSchema = z.object({
  readingMode: z.string().optional(),
  lensIntensity: z.string().optional(),
  oddsFormat: z.string().optional(),
  regions: z.record(z.string(), z.boolean()).optional()
});

apiRouter.get("/user/settings", (req, res) => {
  const sessionId = (req as any).sessionId;
  let settings = db.prepare('SELECT * FROM user_settings WHERE session_id = ?').get(sessionId) as any;
  if (!settings) {
     settings = {
       session_id: sessionId,
       reading_mode: "simplified",
       lens_intensity: "balanced",
       odds_format: "american",
       regions: '{"us":true,"westAfrica":false,"caribbean":true}'
     };
     db.prepare('INSERT OR IGNORE INTO user_settings (session_id, reading_mode, lens_intensity, odds_format, regions) VALUES (?, ?, ?, ?, ?)').run(
       sessionId, settings.reading_mode, settings.lens_intensity, settings.odds_format, settings.regions
     );
  }
  try { settings.regions = JSON.parse(settings.regions); } catch (e) {}
  res.json(settings);
});

apiRouter.put("/user/settings", (req, res) => {
  const sessionId = (req as any).sessionId;
  
  const parsed = SettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid parameters" });
  }
  const body = parsed.data;

  db.prepare(`
    INSERT INTO user_settings (session_id, reading_mode, lens_intensity, odds_format, regions) 
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET 
      reading_mode=excluded.reading_mode, 
      lens_intensity=excluded.lens_intensity, 
      odds_format=excluded.odds_format, 
      regions=excluded.regions,
      updated_at=CURRENT_TIMESTAMP
  `).run(
     sessionId, 
     body.readingMode || "simplified", 
     body.lensIntensity || "balanced", 
     body.oddsFormat || "american", 
     JSON.stringify(body.regions || {})
  );
  res.json({ success: true });
  
  // Debounce the resync
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncRSSNews();
  }, 1000);
});

apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

apiRouter.get("/news", (req, res) => {
  const sessionId = (req as any).sessionId;
  let settings = db.prepare('SELECT reading_mode, lens_intensity FROM user_settings WHERE session_id = ?').get(sessionId) as any;
  if (!settings) settings = { reading_mode: 'simplified', lens_intensity: 'balanced' };

  const category = req.query.category as string || "all";
  const limitStr = req.query.limit as string;
  const offsetStr = req.query.offset as string;
  
  const limit = Math.min(parseInt(limitStr) || 20, 50);
  const offset = parseInt(offsetStr) || 0;
  
  let articlesRaw;
  if (category === 'all') {
    articlesRaw = db.prepare(`
      SELECT a.*, c.reframed_headline, c.reframed_summary, c.cultural_lens_analysis, 
             c.key_takeaways, c.what_this_means_for_us, c.statistical_data
      FROM articles a
      LEFT JOIN article_ai_cache c ON a.url_hash = c.url_hash AND c.reading_mode = ? AND c.lens_intensity = ?
      ORDER BY a.created_at DESC LIMIT ? OFFSET ?
    `).all(settings.reading_mode, settings.lens_intensity, limit, offset);
  } else {
    articlesRaw = db.prepare(`
      SELECT a.*, c.reframed_headline, c.reframed_summary, c.cultural_lens_analysis, 
             c.key_takeaways, c.what_this_means_for_us, c.statistical_data
      FROM articles a
      LEFT JOIN article_ai_cache c ON a.url_hash = c.url_hash AND c.reading_mode = ? AND c.lens_intensity = ?
      WHERE a.category = ?
      ORDER BY a.created_at DESC LIMIT ? OFFSET ?
    `).all(settings.reading_mode, settings.lens_intensity, category, limit, offset);
  }
  
  const articlesOut = articlesRaw.map((raw: any) => {
    if (raw.reframed_headline) {
      return {
        id: raw.url_hash,
        url_hash: raw.url_hash,
        category: raw.category,
        source_name: raw.source_name,
        original_title: raw.original_title,
        original_url: raw.original_url,
        image_url: raw.image_url,
        original_text_dump: raw.original_text_dump,
        reframed_headline: raw.reframed_headline,
        reframed_summary: raw.reframed_summary,
        cultural_lens_analysis: raw.cultural_lens_analysis,
        key_takeaways: JSON.parse(raw.key_takeaways || '[]'),
        what_this_means_for_us: JSON.parse(raw.what_this_means_for_us || '[]'),
        statistical_data: raw.statistical_data ? JSON.parse(raw.statistical_data) : null,
      }
    } else {
      return {
        id: raw.url_hash,
        url_hash: raw.url_hash,
        category: raw.category,
        source_name: raw.source_name,
        original_title: raw.original_title,
        original_url: raw.original_url,
        image_url: raw.image_url,
        original_text_dump: raw.original_text_dump,
        reframed_headline: raw.original_title,
        reframed_summary: "AI analysis is pending processing... Please refresh shortly.",
        cultural_lens_analysis: "Systemic analysis in queue...",
        key_takeaways: [],
        what_this_means_for_us: []
      }
    }
  });
  
  res.json({ articles: articlesOut });
});

function stripHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {}
  });
}

apiRouter.get("/news/:id/backstory", backstoryLimiter, async (req, res) => {
  const articleId = req.params.id;
  const article = db.prepare('SELECT * FROM articles WHERE url_hash = ?').get(articleId) as any;
  
  if (!article) {
    return res.status(404).json({ detail: "Article not found" });
  }

  const cache = db.prepare('SELECT historical_backstory FROM article_backstory_cache WHERE url_hash = ?').get(articleId) as any;
  if (cache && cache.historical_backstory) {
    return res.json(JSON.parse(cache.historical_backstory));
  }

  try {
    const { callAIConfigured, getAvailableProviders } = await import('./aiService');
    const providers = getAvailableProviders();
    if (providers.length === 0 || (providers.length === 1 && providers[0] === 'gemini' && !process.env.GEMINI_API_KEY)) {
      throw new Error("No AI API keys are configured");
    }
    
    const safeContent = stripHtml(article.original_text_dump || '').trim().slice(0, 2000).replace(/`|\$|{}/g, '');
    const safeTitle = (article.original_title || "").replace(/`|\$|{}/g, '');
    
    const prompt = `
    You are an expert political historian and investigative archivist. 
    A reader is viewing a news story originally titled: "${safeTitle}".
    
    The raw underlying dispatch context is: ${safeContent}
    
    Provide an interactive, deep-dive historical context file that explains the "how did we get here" behind this current event. 
    Break it down structurally so a reader can easily get caught up on the historical roots of this ongoing situation.
    
    Provide your output in clear JSON matching this format. NO MARKDOWN CODE BLOCKS.
    {
       "the_past_roots": "A 1-2 paragraph history lesson detailing what caused this conflict or event over the last few decades.",
       "ongoing_players": "Brief description of the key countries, organizations, or systemic factors driving this situation.",
       "timeline": [
          {"time": "Year/Date", "event": "What happened back then that connects to today"}
       ],
       "insider_insight": "An advanced, eye-opening analytical takeaway showing systemic patterns or structural context."
    }
    `;

    const responseText = await callAIConfigured(prompt);
    
    let backstoryJson: any = {};
    try {
      backstoryJson = JSON.parse(responseText || '{}');
    } catch(e) {
      console.error("Backstory parse error", e);
    }

    db.prepare('INSERT OR REPLACE INTO article_backstory_cache (url_hash, historical_backstory) VALUES (?, ?)').run(
       articleId, JSON.stringify(backstoryJson)
    );
    return res.json(backstoryJson);
  } catch (e: any) {
    console.error("Backstory generation error:", e);
    return res.status(500).json({ detail: 'Background context unavailable. Try again shortly.' });
  }
});
