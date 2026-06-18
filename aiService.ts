import db from "./db";
import fs from "fs";
import path from "path";
import { ArticleProps } from "./src/types";
import PQueueMod from 'p-queue';

const PQueue = (PQueueMod as any).default || PQueueMod;

// Respect Gemini Free Tier 15 RPM limits globally (leave 3 RPM buffer for user actions)
const aiQueue = new PQueue({ concurrency: 1, intervalCap: 12, interval: 60000 });

let aiClientPromise: Promise<any> | null = null;
const initAI = async () => {
  if (!aiClientPromise && process.env.GEMINI_API_KEY) {
    aiClientPromise = import('@google/genai').then(({ GoogleGenAI }) => {
      return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    });
  }
  return aiClientPromise;
}

const contextCache = new Map<string, string>();

function getContext(lensFile: string) {
  if (contextCache.has(lensFile)) return contextCache.get(lensFile)!;
  try {
     const filePath = path.join(process.cwd(), 'context', lensFile);
     if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        contextCache.set(lensFile, content);
        return content;
     } else {
        console.warn(`Context file not found: ${filePath}`);
     }
  } catch (e) {
     console.error(`Error reading context file ${lensFile}:`, e);
  }
  return "Focus on economic equity and historical structural insights.";
}

export async function processRawArticleForConfig(article: any, readingMode: string, lensIntensity: string) {
  const existing = db.prepare('SELECT 1 FROM article_ai_cache WHERE url_hash = ? AND reading_mode = ? AND lens_intensity = ?').get(article.url_hash, readingMode, lensIntensity);
  if (existing) return;

  if (readingMode === 'raw') {
    db.prepare(`
      INSERT INTO article_ai_cache (url_hash, reading_mode, lens_intensity, reframed_headline, reframed_summary, cultural_lens_analysis, key_takeaways, what_this_means_for_us, statistical_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(article.url_hash, readingMode, lensIntensity, article.original_title, article.original_text_dump, "Raw dispatch. No AI analysis.", JSON.stringify([]), JSON.stringify([]), null);
    return;
  }

  const ai = await initAI();
  if (ai) {
    try {
      let lensFile = 'economy_wealth.md';
      if (lensIntensity === 'pan_african') {
         lensFile = 'geopolitics_diaspora.md';
      } else if (lensIntensity === 'hyper_local') {
         lensFile = 'domestic_equity.md';
      }
      
      const contextContent = getContext(lensFile);
      let readingInstruction = "explains complex global news to a 10-year-old while providing acute systemic analysis.";
      if (readingMode === 'executive') {
          readingInstruction = "provides high-density, professional executive summaries intended for rapid scanning by advanced professionals.";
      }
      
      const safeTitle = (article.original_title || "").replace(/`|\$|{}/g, '');
      const safeContext = (article.original_text_dump || "").substring(0, 3000).replace(/`|\$|{}/g, '');
      
      const prompt = `
      You are an expert journalist and educator who ${readingInstruction}
      
      BACKGROUND CONTEXT:
      ${contextContent}
      
      CURRENT EVENT:
      Title: ${safeTitle}
      Context: ${safeContext}
      Category: ${article.category}
      
      Output strictly valid JSON with NO markdown codeblock wrapping! We need the raw JSON object string.
      Do not invent fabricated statistical sources. If there is real statistical data, include it, otherwise use null for statistical_data.
      Format:
      {
         "reframed_headline": "Simple clear headline",
         "reframed_summary": "1-3 sentences summary",
         "cultural_lens_analysis": "Systemic analysis paragraph",
         "key_takeaways": ["point 1", "point 2"],
         "what_this_means_for_us": ["community point 1", "community point 2"],
         "statistical_data": {
            "title": "Chart Title", 
            "type": "bar", 
            "data": [{"name": "Label1", "value": 10}, {"name": "Label2", "value": 20}], 
            "reference": "REAL EXTRACTED SOURCE OR OMIT"
         } // or null
      }
      `;

      const response = await aiQueue.add(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      }));
      
      if (!response) throw new Error("AI Queue returned null response");
      
      let aiResponse: any = null;
      try {
        aiResponse = JSON.parse(response.text || '{}');
        if (!aiResponse.reframed_headline && !aiResponse.reframed_summary) throw new Error("Empty AI response");
      } catch (e) {
        console.warn("AI JSON parse failure for article:", article.url_hash, "Raw text:", response.text?.substring(0, 200));
        
        // Insert fallback to avoid infinite retry loops on poison pill articles
        db.prepare(`
          INSERT INTO article_ai_cache (url_hash, reading_mode, lens_intensity, reframed_headline, reframed_summary, cultural_lens_analysis, key_takeaways, what_this_means_for_us, statistical_data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          article.url_hash, readingMode, lensIntensity,
          article.original_title,
          "Analysis format failed. " + (article.original_text_dump?.substring(0, 150) || ""),
          "Systemic analysis unavailable due to processing error.",
          JSON.stringify(["Processing error"]),
          JSON.stringify(["Processing error"]),
          null
        );
        return;
      }

      db.prepare(`
        INSERT INTO article_ai_cache (url_hash, reading_mode, lens_intensity, reframed_headline, reframed_summary, cultural_lens_analysis, key_takeaways, what_this_means_for_us, statistical_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        article.url_hash, readingMode, lensIntensity,
        aiResponse.reframed_headline || article.original_title,
        aiResponse.reframed_summary || article.original_text_dump?.substring(0, 200) || "",
        aiResponse.cultural_lens_analysis || "Analysis currently unavailable.",
        JSON.stringify(aiResponse.key_takeaways || []),
        JSON.stringify(aiResponse.what_this_means_for_us || []),
        aiResponse.statistical_data ? JSON.stringify(aiResponse.statistical_data) : null
      );
    } catch (e: any) {
      const isRetryable = e?.status === 429 || e?.message?.includes('429') || e?.status === 503 || e?.message?.includes('503') || e?.status === 500;
      if (isRetryable) {
         console.warn(`AI Generation ${e?.status || 'Transient'} Error for article`, article.url_hash, "- Will retry on next sync pass.");
      } else {
         console.warn("AI Generation Permanent Error for article", article.url_hash, e?.message || e);
         // Insert fallback to avoid infinite retry loops on safety blocks or other permanent errors
         try {
           db.prepare(`
             INSERT INTO article_ai_cache (url_hash, reading_mode, lens_intensity, reframed_headline, reframed_summary, cultural_lens_analysis, key_takeaways, what_this_means_for_us, statistical_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           `).run(
             article.url_hash, readingMode, lensIntensity,
             article.original_title,
             "Analysis blocked by filter or permanent error. " + (article.original_text_dump?.substring(0, 150) || ""),
             "Systemic analysis unavailable.",
             JSON.stringify(["Analysis unavailable"]),
             JSON.stringify(["Analysis unavailable"]),
             null
           );
         } catch(err) {}
      }
    }
  }
}
