import express from "express";
import rateLimit from "express-rate-limit";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import db, { decrypt } from "./db";
import { getAuthSession } from "./api";
import { getAvailableProviders, callAIQueued, generateImage } from "./aiService";
import { feeds } from "./feeds";

export const newsRouter = express.Router();

// Rate limiting for AI backstory endpoint
const backstoryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === "production" ? 15 : 500, // dynamically decreased for prod
  message: { detail: 'Too many backstory generation requests. Please try again later.' },
  validate: { xForwardedForHeader: false }
});

const NewsQuerySchema = z.object({
  category: z.enum(["all", "global", "politics", "diaspora", "finance", "culture", "health", "music", "sports"]).catch("all"),
  limit: z.coerce.number().min(1).max(50).catch(20),
  offset: z.coerce.number().min(0).catch(0)
});

newsRouter.get("/:id/share", (req, res) => {
  const articleId = req.params.id;
  const isValidId = /^[a-zA-Z0-9\-_]{10,128}$/.test(articleId);
  if (!isValidId) {
    return res.status(400).send('Invalid article ID');
  }
  const article = db.prepare(`
    SELECT a.original_url, a.image_url, a.source_name, a.pub_date,
           c.reframed_headline, c.cultural_lens_analysis
    FROM articles a
    LEFT JOIN article_ai_cache c ON a.url_hash = c.url_hash
    WHERE a.url_hash = ? OR a.id = ?
    LIMIT 1
  `).get(articleId, articleId) as any;

  if (!article) return res.status(404).send('Not found');

  const headline = sanitizeHtml(article.reframed_headline || 'Global Lens Story', { allowedTags: [] });
  const description = sanitizeHtml((article.cultural_lens_analysis || '').slice(0, 200), { allowedTags: [] });
  const image = article.image_url || '';
  const sourceCredit = sanitizeHtml(article.source_name || '', { allowedTags: [] });
  const baseUrl = process.env.PUBLIC_URL || process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const canonicalUrl = `${baseUrl}/?article=${encodeURIComponent(articleId)}`;
  const publishedTime = article.pub_date ? new Date(article.pub_date).toISOString() : new Date().toISOString();

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${headline} — Overlay Global Lens</title>

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Overlay Global Lens" />
  <meta property="og:title" content="${headline}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonicalUrl}" />
  ${image ? `<meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />` : ''}
  
  <!-- Article Specific -->
  <meta property="article:published_time" content="${publishedTime}" />
  <meta property="article:author" content="${sourceCredit}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${headline}" />
  <meta name="twitter:description" content="${description}" />
  ${image ? `<meta name="twitter:image" content="${image}" />` : ''}

  <!-- Redirect humans to the app, crawlers stay for OG tags -->
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
</head>
<body>
  <p>Redirecting to Overlay Global Lens... <a href="${canonicalUrl}">Click here</a></p>
</body>
</html>`);
});

newsRouter.get("/", (req, res) => {
  const session = getAuthSession(req);
  let settings: any = null;

  if (session) {
    settings = db.prepare('SELECT reading_mode, lens_intensity FROM user_settings WHERE owner_id = ?').get(session.user_id) as any;
  } else {
    const cookieVal = req.cookies?.bgl_guest_settings;
    if (cookieVal) {
      try {
        const parsed = JSON.parse(cookieVal);
        settings = {
          reading_mode: parsed.readingMode,
          lens_intensity: parsed.lensIntensity
        };
      } catch (e) {
        // Safe fallback on parse error
      }
    }
  }

  if (!settings) {
    settings = { reading_mode: 'simplified', lens_intensity: 'balanced' };
  }

  const parsedQuery = NewsQuerySchema.parse(req.query);
  const { category, limit, offset } = parsedQuery;
  
  let articlesRaw;
  if (category === 'all') {
    articlesRaw = db.prepare(`
      SELECT a.*, c.reframed_headline, c.reframed_summary, c.cultural_lens_analysis,
             c.key_takeaways, c.what_this_means_for_us, c.statistical_data, c.article_body
      FROM articles a
      LEFT JOIN article_ai_cache c ON a.url_hash = c.url_hash AND c.reading_mode = ? AND c.lens_intensity = ?
      WHERE a.is_moderated = 0
      ORDER BY COALESCE(a.pub_date, a.created_at) DESC LIMIT ? OFFSET ?
    `).all(settings.reading_mode, settings.lens_intensity, limit, offset);
  } else {
    articlesRaw = db.prepare(`
      SELECT a.*, c.reframed_headline, c.reframed_summary, c.cultural_lens_analysis,
             c.key_takeaways, c.what_this_means_for_us, c.statistical_data, c.article_body
      FROM articles a
      LEFT JOIN article_ai_cache c ON a.url_hash = c.url_hash AND c.reading_mode = ? AND c.lens_intensity = ?
      WHERE a.category = ? AND a.is_moderated = 0
      ORDER BY COALESCE(a.pub_date, a.created_at) DESC LIMIT ? OFFSET ?
    `).all(settings.reading_mode, settings.lens_intensity, category, limit, offset);
  }
  
  function safeJSONParse(data: any, fallback: any = []) {
    if (!data) return fallback;
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("JSON parse failure in /news payload:", e);
      return fallback;
    }
  }

  function coerceToString(val: any): string {
    if (typeof val === 'string') return val;
    if (val === null || val === undefined) return '';
    return JSON.stringify(val);
  }

  function sanitizeArticle(article: any) {
    if (Array.isArray(article.key_takeaways)) {
      article.key_takeaways = article.key_takeaways.map(coerceToString);
    }
    if (Array.isArray(article.what_this_means_for_us)) {
      article.what_this_means_for_us = article.what_this_means_for_us.map(coerceToString);
    }
    if (article.statistical_data && Array.isArray(article.statistical_data.data)) {
      article.statistical_data.data = article.statistical_data.data.map((d: any) => ({
        name: coerceToString(d?.name),
        value: typeof d?.value === 'number' ? d.value : parseFloat(coerceToString(d?.value)) || 0,
      }));
    }
    const stringFields = ['reframed_headline', 'reframed_summary', 'cultural_lens_analysis', 'article_body'];
    for (const field of stringFields) {
      if (article[field] !== null && typeof article[field] === 'object') {
        article[field] = coerceToString(article[field]);
      }
    }
    return article;
  }
  
  const articlesOut = articlesRaw.map((raw: any) => {
    let bias = "independent";
    const feedConfig = feeds.find(f => f.source_name === raw.source_name || f.url === raw.original_url);
    if (feedConfig && (feedConfig as any).bias) {
      bias = (feedConfig as any).bias;
    }
    
    if (raw.reframed_headline) {
      return sanitizeArticle({
        id: raw.url_hash,
        url_hash: raw.url_hash,
        category: raw.category,
        source_name: raw.source_name,
        bias,
        pub_date: raw.pub_date,
        lens_intensity: settings.lens_intensity,
        original_title: raw.original_title,
        original_url: raw.original_url,
        image_url: raw.image_url,
        original_text_dump: raw.original_text_dump,
        reframed_headline: raw.reframed_headline,
        reframed_summary: raw.reframed_summary,
        cultural_lens_analysis: raw.cultural_lens_analysis,
        article_body: raw.article_body,
        key_takeaways: safeJSONParse(raw.key_takeaways, []),
        what_this_means_for_us: safeJSONParse(raw.what_this_means_for_us, []),
        statistical_data: raw.statistical_data ? safeJSONParse(raw.statistical_data, null) : null,
      });
    } else {
      return sanitizeArticle({
        id: raw.url_hash,
        url_hash: raw.url_hash,
        category: raw.category,
        source_name: raw.source_name,
        bias,
        pub_date: raw.pub_date,
        lens_intensity: settings.lens_intensity,
        original_title: raw.original_title,
        original_url: raw.original_url,
        image_url: raw.image_url,
        original_text_dump: raw.original_text_dump,
        reframed_headline: raw.original_title,
        reframed_summary: "AI analysis is pending processing... Please refresh shortly.",
        cultural_lens_analysis: "Systemic analysis in queue...",
        article_body: "",
        key_takeaways: [],
        what_this_means_for_us: []
      });
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

const ongoingBackstories = new Map<string, Promise<any>>();

newsRouter.get("/:id/backstory", backstoryLimiter, async (req, res) => {
  const articleId = req.params.id;
  const article = db.prepare('SELECT * FROM articles WHERE url_hash = ?').get(articleId) as any;
  
  if (!article) {
    return res.status(404).json({ detail: "Article not found" });
  }

  const cache = db.prepare('SELECT historical_backstory FROM article_backstory_cache WHERE url_hash = ?').get(articleId) as any;
  if (cache && cache.historical_backstory) {
    return res.json(JSON.parse(cache.historical_backstory));
  }

  // If there's already an active generation promise for this article, await it.
  if (ongoingBackstories.has(articleId)) {
    try {
      const result = await ongoingBackstories.get(articleId);
      return res.json(result);
    } catch (err) {
      return res.status(200).json({
        the_past_roots: '',
        ongoing_players: '',
        insider_insight: '',
        timeline: [],
        _unavailable: true
      });
    }
  }

  // Create a new generation promise
  const generationPromise = (async () => {
    const providers = getAvailableProviders();
    if (providers.length === 0) {
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

    const responseText: string = await Promise.race([
      callAIQueued(prompt) as Promise<string>,
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Backstory generation timed out')), 90000)
      )
    ]);
    
    let backstoryJson: any = {};
    try {
      const jsonMatch = (responseText || '').match(/\{[\s\S]*\}/);
      backstoryJson = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      
      const coerceField = (val: any): string => {
        if (typeof val === 'string') return val;
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') {
          return Object.values(val).filter(v => typeof v === 'string').join(' ') || JSON.stringify(val);
        }
        return String(val);
      };

      backstoryJson = {
        ...backstoryJson,
        the_past_roots: coerceField(backstoryJson.the_past_roots),
        ongoing_players: coerceField(backstoryJson.ongoing_players),
        insider_insight: coerceField(backstoryJson.insider_insight),
        timeline: Array.isArray(backstoryJson.timeline)
          ? backstoryJson.timeline.map((item: any) => ({
              time: coerceField(item?.time),
              event: coerceField(item?.event),
            }))
          : [],
      };
      
    } catch(e) {
      // parse error
    }

    db.prepare('INSERT OR REPLACE INTO article_backstory_cache (url_hash, historical_backstory) VALUES (?, ?)').run(
       articleId, JSON.stringify(backstoryJson)
    );
    return backstoryJson;
  })();

  // Store the promise in the map
  ongoingBackstories.set(articleId, generationPromise);

  try {
    const result = await generationPromise;
    return res.json(result);
  } catch (e: any) {
    const msg = e?.message || '';
    if (!msg.includes('402') && !msg.includes('429') && !msg.includes('timed out')) {
      console.error("Backstory generation error:", e);
    }
    return res.status(200).json({
      the_past_roots: '',
      ongoing_players: '',
      insider_insight: '',
      timeline: [],
      _unavailable: true
    });
  } finally {
    // Clean up the promise map once finished
    ongoingBackstories.delete(articleId);
  }
});

newsRouter.post("/:id/generate-image", async (req, res) => {
  const articleId = req.params.id;
  const allowedStyles = ['photorealistic', 'cyberpunk', 'artistic', 'minimalist'];
  const style = allowedStyles.includes(req.body.style) ? req.body.style : 'photorealistic';
  const article = db.prepare('SELECT original_title FROM articles WHERE url_hash = ?').get(articleId) as any;
  if (!article) return res.status(404).json({ error: "Article not found" });

  const session = getAuthSession(req);
  let settings: any = null;

  if (session) {
    settings = db.prepare('SELECT gemini_api_key FROM user_settings WHERE owner_id = ?').get(session.user_id) as any;
  } else {
    const cookieVal = req.cookies?.bgl_guest_settings;
    if (cookieVal) {
      try {
        const parsed = JSON.parse(cookieVal);
        settings = {
          gemini_api_key: parsed.encryptedGeminiApiKey
        };
      } catch (e) {
        // Safe fallback
      }
    }
  }
  
  try {
    const decryptedKey = settings?.gemini_api_key ? (settings.gemini_api_key === "••••" || settings.gemini_api_key === "••••••••••••••••" ? undefined : decrypt(settings.gemini_api_key)) : undefined;
    const imageUrl = await generateImage(article.original_title, style, decryptedKey || undefined);
    res.json({ imageUrl });
  } catch (e: any) {
    console.error("Image generation error:", e);
    res.status(500).json({ error: e.message || "Failed to generate image" });
  }
});
