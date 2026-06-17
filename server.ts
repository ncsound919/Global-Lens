import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

import Parser from "rss-parser";
import fs from "fs";

let ARTICLES_CACHE: any[] = [
  {
    id: 1,
    url_hash: "abcd1234efgh5678",
    category: "finance",
    source_name: "BBC Finance",
    original_title: "Tech stocks surge as AI investments drive Q3 yields higher than anticipated",
    original_url: "https://www.bbc.com/news/business",
    original_text_dump: "European tech stocks surged early Wednesday following massive Q3 investments in AI infrastructure...",
    reframed_headline: "AI Infrastructure Spending Pushes Tech Stocks to Record Highs",
    reframed_summary: "Major Q3 capital deployments into AI infrastructure have driven unprecedented market growth, defying earlier inflation worries.",
    cultural_lens_analysis: "This represents a definitive shift in market confidence from skeptical caution to aggressive FOMO regarding AI infrastructure. Communities invested in traditional sectors are feeling the squeeze as 'Big Tech' consolidates power and capital.",
    historical_context: "Similar to the dot-com infrastructure build-out of 1998, though concentrated among fewer mega-cap entities.",
    key_takeaways: [
      "AI capital expenditure drove Q3 gains",
      "Traditional sectors are lagging behind",
      "Potential bubble worries overshadowed by immediate returns"
    ],
    what_this_means_for_us: [
      "Concentration of corporate wealth means an increasing need for diverse community ownership in AI sector components.",
      "Green energy jobs connected to massive data centers may be a key employment factor for local communities in coming years."
    ],
    statistical_data: {
      title: "Tech Stock Market Growth (Q1 - Q3)",
      type: "bar",
      data: [
         { name: "Q1", value: 12 },
         { name: "Q2", value: 15 },
         { name: "Q3", value: 38 }
      ],
      reference: "Global Financial Index Report Q3"
    }
  }
];

const parser = new Parser();

async function processFeedItem(item: any, category: string) {
  if (ARTICLES_CACHE.find(a => a.url_hash === item.link)) return;

  const textDump = `${item.title}\n\n${item.contentSnippet || item.content || ""}`;

  let aiResponse: any = {};
  if (process.env.GEMINI_API_KEY && USER_SETTINGS.readingMode !== 'raw') {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let contextContent = "Focus on economic equity and historical structural insights.";
      try {
        let lensFile = 'economy_wealth.md';
        if (USER_SETTINGS.lensIntensity === 'hyper_local' || category === 'finance' || category === 'tech') {
           lensFile = 'economy_wealth.md';
        }
        if (USER_SETTINGS.lensIntensity === 'pan_african' || category === 'global') {
           lensFile = 'geopolitics_diaspora.md';
        }
        const filePath = path.join(process.cwd(), 'context', lensFile);
        if (fs.existsSync(filePath)) {
           contextContent = fs.readFileSync(filePath, "utf-8");
        }
      } catch (e) {}
      
      let readingInstruction = "explains complex global news to a 10-year-old while providing acute systemic analysis.";
      if (USER_SETTINGS.readingMode === 'executive') {
          readingInstruction = "provides high-density, professional executive summaries intended for rapid scanning by advanced professionals.";
      }

      const prompt = `
      You are an expert journalist and educator who ${readingInstruction}
      
      BACKGROUND CONTEXT:
      ${contextContent}
      
      CURRENT EVENT:
      Title: ${item.title}
      Context: ${textDump}
      Category: ${category}
      
      Output strictly valid JSON:
      {
         "reframed_headline": "Simple clear headline",
         "reframed_summary": "10-year level summary",
         "cultural_lens_analysis": "Systemic analysis paragraph",
         "key_takeaways": ["point 1", "point 2"],
         "what_this_means_for_us": ["community point 1", "community point 2"],
         "statistical_data": {
             "title": "Chart Title",
             "type": "bar",
             "data": [{"name": "Label1", "value": 10}, {"name": "Label2", "value": 20}],
             "reference": "Made up or extracted source"
         }
      }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      aiResponse = JSON.parse(response.text || '{}');
    } catch (e) {
      console.error("AI Generation Error", e);
    }
  }

  const newArticle = {
    id: ARTICLES_CACHE.length + 1,
    url_hash: item.link,
    category,
    source_name: "BBC News",
    original_title: item.title,
    original_url: item.link,
    original_text_dump: textDump,
    reframed_headline: aiResponse.reframed_headline || item.title,
    reframed_summary: aiResponse.reframed_summary || textDump.substring(0, 200),
    cultural_lens_analysis: aiResponse.cultural_lens_analysis || "Analysis currently unavailable.",
    key_takeaways: aiResponse.key_takeaways || [],
    what_this_means_for_us: aiResponse.what_this_means_for_us || [],
    statistical_data: aiResponse.statistical_data || null,
  };

  ARTICLES_CACHE.unshift(newArticle);
}

let isSyncing = false;

let USER_SETTINGS = {
  readingMode: "simplified",
  lensIntensity: "balanced",
  oddsFormat: "american",
  regions: { us: true, westAfrica: false, caribbean: true }
};

async function syncRSSNews() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const feeds = [
      { url: "http://feeds.bbci.co.uk/news/business/rss.xml", category: "finance" },
      { url: "http://feeds.bbci.co.uk/news/technology/rss.xml", category: "tech" }
    ];
    for (const feed of feeds) {
      const parsed = await parser.parseURL(feed.url);
      // Process only first 2 to keep it fast
      for (const item of parsed.items.slice(0, 2)) {
         await processFeedItem(item, feed.category);
      }
    }
  } catch (err) {
    console.error("RSS Sync Error", err);
  } finally {
    isSyncing = false;
  }
}

// kick off initial sync in bg
syncRSSNews();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing middleware
  app.use(express.json());

  // API Routes
  app.get("/api/user/settings", (req, res) => {
    res.json(USER_SETTINGS);
  });

  app.put("/api/user/settings", (req, res) => {
    USER_SETTINGS = { ...USER_SETTINGS, ...req.body };
    res.json({ success: true });
    
    // Optionally trigger a re-sync if reading mode or lens changes
    ARTICLES_CACHE = []; // clear to force re-fetch with new AI instructions
    syncRSSNews();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/news", (req, res) => {
    const category = req.query.category as string || "all";
    const filtered = category === "all" ? ARTICLES_CACHE : ARTICLES_CACHE.filter(a => a.category === category);
    
    // Simulate slight network delay
    setTimeout(() => {
      res.json({ articles: filtered });
    }, 400);
  });

  app.get("/api/news/:id/backstory", async (req, res) => {
    const articleId = parseInt(req.params.id);
    const article = ARTICLES_CACHE.find((a) => a.id === articleId);
    
    if (!article) {
      return res.status(404).json({ detail: "Article not found" });
    }

    if ((article as any).historical_backstory) {
      return res.json((article as any).historical_backstory);
    }

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set");
      }
      
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
      You are an expert political historian and investigative archivist. 
      A reader is viewing a simplified news story titled: "${article.reframed_headline}".
      
      The raw underlying dispatch context is: ${article.original_text_dump}
      
      Provide an interactive, deep-dive historical context file that explains the "how did we get here" behind this current event. 
      Break it down structurally so a reader can easily get caught up on the historical roots of this ongoing situation.
      
      Provide your output in clear JSON matching this format:
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
      
      const backstoryJson = JSON.parse(response.text || '{}');
      (article as any).historical_backstory = backstoryJson;
      return res.json(backstoryJson);
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ detail: `Failed to generate background context: ${e.message}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
