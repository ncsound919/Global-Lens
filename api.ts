import express from "express";
import db from "./db";
import { syncRSSNews } from "./rss";
import { ArticleProps } from "./src/types";

export const apiRouter = express.Router();

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
  const body = req.body;
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
  
  // Optionally trigger a re-sync if reading mode or lens changes
  syncRSSNews();
});

apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

apiRouter.get("/news", (req, res) => {
  const sessionId = (req as any).sessionId;
  let settings = db.prepare('SELECT reading_mode, lens_intensity FROM user_settings WHERE session_id = ?').get(sessionId) as any;
  if (!settings) settings = { reading_mode: 'simplified', lens_intensity: 'balanced' };

  const category = req.query.category as string || "all";
  let articlesRaw;
  if (category === 'all') {
    articlesRaw = db.prepare('SELECT * FROM articles ORDER BY created_at DESC LIMIT 50').all();
  } else {
    articlesRaw = db.prepare('SELECT * FROM articles WHERE category = ? ORDER BY created_at DESC LIMIT 50').all(category);
  }
  
  const articlesOut: ArticleProps[] = articlesRaw.map((raw: any) => {
    const cache = db.prepare('SELECT * FROM article_ai_cache WHERE url_hash = ? AND reading_mode = ? AND lens_intensity = ?').get(raw.url_hash, settings.reading_mode, settings.lens_intensity) as any;
    if (cache) {
      return {
        id: raw.url_hash,
        url_hash: raw.url_hash,
        category: raw.category,
        source_name: raw.source_name,
        original_title: raw.original_title,
        original_url: raw.original_url,
        image_url: raw.image_url,
        original_text_dump: raw.original_text_dump,
        reframed_headline: cache.reframed_headline,
        reframed_summary: cache.reframed_summary,
        cultural_lens_analysis: cache.cultural_lens_analysis,
        key_takeaways: JSON.parse(cache.key_takeaways || '[]'),
        what_this_means_for_us: JSON.parse(cache.what_this_means_for_us || '[]'),
        statistical_data: cache.statistical_data ? JSON.parse(cache.statistical_data) : null,
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

apiRouter.get("/news/:id/backstory", async (req, res) => {
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
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    
    // We can't use static import inside dynamic check but it's fine for Express
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `
    You are an expert political historian and investigative archivist. 
    A reader is viewing a news story originally titled: "${article.original_title}".
    
    The raw underlying dispatch context is: ${article.original_text_dump}
    
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      }
    });
    
    let backstoryJson: any = {};
    try {
      backstoryJson = JSON.parse(response.text || '{}');
    } catch(e) {
      console.error("Backstory parse error", e);
    }

    db.prepare('INSERT OR REPLACE INTO article_backstory_cache (url_hash, historical_backstory) VALUES (?, ?)').run(
       articleId, JSON.stringify(backstoryJson)
    );
    return res.json(backstoryJson);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ detail: `Failed to generate background context: ${e.message}` });
  }
});
