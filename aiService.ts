import db from "./db";
import fs from "fs";
import path from "path";
import { ArticleProps } from "./src/types";
import PQueueMod from 'p-queue';
import OpenAI from 'openai';

const PQueue = (PQueueMod as any).default || PQueueMod;

// Respect limits globally (leave buffer for user actions)
const aiQueue = new PQueue({ concurrency: 1, intervalCap: 12, interval: 60000 });

let roundRobinIndex = 0;

export const getAvailableProviders = () => {
  const p = [];
  if (process.env.GEMINI_API_KEY) p.push('gemini');
  if (process.env.OPENAI_API_KEY) p.push('openai');
  if (process.env.DEEPSEEK_API_KEY) p.push('deepseek');
  if (process.env.OPENROUTER_API_KEY) p.push('openrouter');
  if (process.env.MISTRAL_API_KEY) p.push('mistral');
  return p.length ? p : ['gemini'];
};

export const callAIConfigured = async (prompt: string): Promise<string | null> => {
   const providers = getAvailableProviders();
   
   let lastError: any = null;
   
   for (let i = 0; i < providers.length; i++) {
     const provider = providers[roundRobinIndex % providers.length];
     roundRobinIndex++;

     try {
       if (provider === 'gemini') {
          const { GoogleGenAI } = await import('@google/genai');
          const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.1,
            }
          });
          return response.text;
       } else if (provider === 'openai') {
          const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const res = await client.chat.completions.create({
             model: 'gpt-4o-mini',
             response_format: { type: 'json_object' },
             messages: [{ role: 'user', content: prompt }]
          });
          if (res.choices[0].message.content) return res.choices[0].message.content;
       } else if (provider === 'deepseek') {
          const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });
          const res = await client.chat.completions.create({
             model: 'deepseek-chat',
             response_format: { type: 'json_object' },
             messages: [{ role: 'user', content: prompt }]
          });
          if (res.choices[0].message.content) return res.choices[0].message.content;
       } else if (provider === 'openrouter') {
          const client = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' });
          const res = await client.chat.completions.create({
             model: 'liquid/lfm-40b', // OpenRouter supports various models. Using this or openrouter/auto
             messages: [{ role: 'user', content: prompt }]
          });
          if (res.choices[0].message.content) return res.choices[0].message.content;
       } else if (provider === 'mistral') {
          const client = new OpenAI({ apiKey: process.env.MISTRAL_API_KEY, baseURL: 'https://api.mistral.ai/v1' });
          const res = await client.chat.completions.create({
             model: 'mistral-small-latest',
             response_format: { type: 'json_object' },
             messages: [{ role: 'user', content: prompt }]
          });
          if (res.choices[0].message.content) return res.choices[0].message.content;
       }
     } catch (e: any) {
        lastError = e;
     }
   }
   
   if (lastError) {
      if (lastError.status === 429 || lastError.message?.includes('429')) {
         // Silently bubble up rate limits without spam
         throw lastError;
      }
      console.warn(`All AI providers failed. Last error: ${lastError.message || 'Unknown'}`);
      throw lastError;
   }
   return null;
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

  const generateDeterministicFallback = (article: any, readingMode: string, lensIntensity: string) => {
    const title = article.original_title || "Untitled Article";
    const content = article.original_text_dump || "";
    
    // Split into sentences using a simple punctuation regex, keeping longer sentences.
    const sentences = content.split(/[.?!]\s+/).filter((s: string) => s.length > 20);
    const summary = sentences.slice(0, 2).join(". ") + (sentences.length > 0 ? "." : "");
    
    const takeaways = sentences.slice(0, 3).map((s: string) => s + ".");
    
    let structuralAnalysis = "This article covers global events from a traditional news perspective.";
    let whatItMeans = ["This issue warrants further community observation."];
    
    if (lensIntensity === 'pan_african') {
       structuralAnalysis = "Viewed through a Pan-African lens, this event may highlight ongoing shifts in post-colonial economic or social structures, demanding closer attention to how it impacts local sovereignty and community resilience.";
       whatItMeans = ["Consider how these developments affect continental independence.", "Reflect on localized alternatives to international reliance."];
    } else if (lensIntensity === 'indigenous') {
       structuralAnalysis = "From an Indigenous perspective, this narrative often intersects with issues of land rights, ongoing colonial impact, and the vital importance of preserving traditional knowledge and ecological balance.";
       whatItMeans = ["Pay attention to potential impacts on tribal sovereignty and environmental stewardship.", "Listen to and amplify local Indigenous voices on this matter."];
    } else if (lensIntensity === 'marxist') {
       structuralAnalysis = "Through a Marxist analytic framework, this situation reflects underlying tensions between labor and capital, potentially exposing the contradictions and inequalities inherent in current economic systems.";
       whatItMeans = ["Analyze how this affects labor rights and wealth distribution.", "Look for opportunities to support working-class solidarity."];
    } else if (lensIntensity === 'decolonial') {
       structuralAnalysis = "Applying a decolonial framework, observers must question the implicit assumptions of global north hegemony present in the events, focusing instead on pathways to dismantling structural power disparities.";
       whatItMeans = ["Question the dominant narratives and power structures at play.", "Focus on ways to empower historically marginalized communities."];
    }

    if (readingMode === 'academic') {
       structuralAnalysis = "Academic Assessment: " + structuralAnalysis;
    } else if (readingMode === 'simplified') {
       structuralAnalysis = structuralAnalysis.replace(/intersectionality|contradictions|sovereignty|hegemony/gi, "important structural factors");
    }
    
    return {
      reframed_headline: `[Focus: ${lensIntensity}] ${title}`,
      reframed_summary: summary || "Content analysis naturally derived from current reporting.",
      cultural_lens_analysis: structuralAnalysis,
      key_takeaways: takeaways.length > 0 ? takeaways : ["Key points are actively developing."],
      what_this_means_for_us: whatItMeans,
      statistical_data: null
    };
  };

  const insertDeterministicFallback = () => {
     try {
       const fb = generateDeterministicFallback(article, readingMode, lensIntensity);
       db.prepare(`
         INSERT INTO article_ai_cache (url_hash, reading_mode, lens_intensity, reframed_headline, reframed_summary, cultural_lens_analysis, key_takeaways, what_this_means_for_us, statistical_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       `).run(
         article.url_hash, readingMode, lensIntensity,
         fb.reframed_headline, fb.reframed_summary, fb.cultural_lens_analysis,
         JSON.stringify(fb.key_takeaways), JSON.stringify(fb.what_this_means_for_us), null
       );
     } catch (err) {
       console.error("Fallback insertion failed:", err);
     }
  };

  const providers = getAvailableProviders();
  if (providers.length > 0) {
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

      const responseText = await aiQueue.add(() => callAIConfigured(prompt));
      
      if (!responseText) throw new Error("AI Queue returned null response");
      
      let aiResponse: any = null;
      try {
        aiResponse = JSON.parse(responseText || '{}');
        if (!aiResponse.reframed_headline && !aiResponse.reframed_summary) throw new Error("Empty AI response");
      } catch (e) {
        console.warn("AI JSON parse failure for article:", article.url_hash, "Raw text:", responseText?.substring(0, 200));
        
        // Insert fallback to avoid infinite retry loops on poison pill articles
        insertDeterministicFallback();
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
         // Silenced: console.warn(`AI Rate Limit / Transient Error`, article.url_hash);
         insertDeterministicFallback();
      } else {
         // Silenced: console.warn("AI Generation Permanent Error", article.url_hash);
         insertDeterministicFallback();
      }
    }
  } else {
    // No LLM configured, just run deterministic fallback
    insertDeterministicFallback();
  }
}
