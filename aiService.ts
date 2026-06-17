import db from "./db";
import fs from "fs";
import path from "path";
import { ArticleProps } from "./src/types";

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

  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let contextContent = "Focus on economic equity and historical structural insights.";
      try {
        let lensFile = 'economy_wealth.md';
        if (lensIntensity === 'pan_african') {
           lensFile = 'geopolitics_diaspora.md';
        }
        const filePath = path.join(process.cwd(), 'context', lensFile);
        if (fs.existsSync(filePath)) {
           contextContent = fs.readFileSync(filePath, "utf-8");
        }
      } catch (e) {}
      
      let readingInstruction = "explains complex global news to a 10-year-old while providing acute systemic analysis.";
      if (readingMode === 'executive') {
          readingInstruction = "provides high-density, professional executive summaries intended for rapid scanning by advanced professionals.";
      }

      const prompt = `
      You are an expert journalist and educator who ${readingInstruction}
      
      BACKGROUND CONTEXT:
      ${contextContent}
      
      CURRENT EVENT:
      Title: ${article.original_title}
      Context: ${article.original_text_dump}
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

      // Sleep to respect the 15 RPM limit on Gemini Free Tier.
      await new Promise(resolve => setTimeout(resolve, 4500));

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      
      let aiResponse: any = {};
      try {
        aiResponse = JSON.parse(response.text || '{}');
      } catch (e) {
        // Fallback gracefully on parsing
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
      if (e?.status === 429 || e?.message?.includes('429')) {
         console.warn("AI Generation Quota Exceeded for article", article.url_hash, "- Will retry on next sync pass.");
      } else {
         console.warn("AI Generation Warning for article", article.url_hash, e?.message || e);
      }
    }
  }
}
