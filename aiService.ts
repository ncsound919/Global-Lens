import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import db from "./db";
import fs from "fs";
import path from "path";
import { ArticleProps } from "./src/types";
import PQueueMod from 'p-queue';
import OpenAI from 'openai';

export async function generateImage(prompt: string, style: string, userApiKey?: string): Promise<string> {
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("No Gemini API key configured.");
    
    const client = new GoogleGenAI({ apiKey });
    
    const response: GenerateContentResponse = await client.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: {
            parts: [{ text: `Generate a ${style} image based on this prompt: ${prompt}` }],
        },
        config: {
            imageConfig: {
                aspectRatio: "16:9",
                imageSize: "1K"
            }
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No image generated.");
}

const PQueue = (PQueueMod as any).default || PQueueMod;

// Respect limits globally (leave buffer for user actions)
const aiQueue = new PQueue({ concurrency: 1, intervalCap: 12, interval: 60000 });

let providerIndex = 0;
let geminiModelIndex = 0;
let openrouterModelIndex = 0;
let mistralModelIndex = 0;

export const getAvailableProviders = () => {
  const p = [];
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10 && !process.env.GEMINI_API_KEY.includes('GEMINI_API_KEY')) p.push('gemini');
  if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.length > 10) p.push('deepseek');
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.length > 10) p.push('openrouter');
  if (process.env.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY.length > 10) p.push('mistral');
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.length > 10) p.push('groq');
  return p;
};

export const callAIQueued = (prompt: string) => aiQueue.add(() => callAIConfigured(prompt));

export const callAIConfigured = async (prompt: string): Promise<string | null> => {
   const providers = getAvailableProviders();
   if (!providers.length) throw new Error("No AI API keys are configured.");
   
   let lastError: any = null;
   
   for (let i = 0; i < providers.length; i++) {
     const provider = providers[providerIndex % providers.length];
     providerIndex++;

       try {
       if (provider === 'gemini') {
          const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash'];
          const modelToUse = geminiModels[geminiModelIndex % geminiModels.length];
          geminiModelIndex++;
          const response = await client.models.generateContent({
            model: modelToUse,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.1,
            }
          });
          return response.text;
       } else if (provider === 'deepseek') {
          const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });
          const res = await client.chat.completions.create({
             model: 'deepseek-chat',
             response_format: { type: 'json_object' },
             messages: [{ role: 'user', content: prompt }]
          });
          if (res.choices && res.choices[0] && res.choices[0].message.content) return res.choices[0].message.content;
       } else if (provider === 'openrouter') {
          const client = new OpenAI({ 
             apiKey: process.env.OPENROUTER_API_KEY, 
             baseURL: 'https://openrouter.ai/api/v1',
             defaultHeaders: {
               "HTTP-Referer": process.env.APP_URL || "https://local.io",
               "X-Title": "Black Global Lens",
             }
          });
          const openrouterModels = ['nvidia/llama-3.1-nemotron-70b-instruct:free', 'deepseek/deepseek-chat:free', 'google/gemini-2.0-flash-lite-preview-02-05:free', 'google/gemini-2.0-pro-exp-02-05:free'];
          const modelToUse = openrouterModels[openrouterModelIndex % openrouterModels.length];
          openrouterModelIndex++;
          const res = await client.chat.completions.create({
             model: modelToUse,
             messages: [{ role: 'user', content: prompt }]
          });
          if (res.choices && res.choices.length > 0 && res.choices[0].message.content) return res.choices[0].message.content;
       } else if (provider === 'mistral') {
          const client = new OpenAI({ apiKey: process.env.MISTRAL_API_KEY, baseURL: 'https://api.mistral.ai/v1' });
          const mistralModels = ['mistral-large-latest', 'mistral-small-latest'];
          const modelToUse = mistralModels[mistralModelIndex % mistralModels.length];
          mistralModelIndex++;
          const res = await client.chat.completions.create({
             model: modelToUse,
             response_format: { type: 'json_object' },
             messages: [{ role: 'user', content: prompt }]
          });
          if (res.choices[0].message.content) return res.choices[0].message.content;
       } else if (provider === 'groq') {
          const client = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
          const res = await client.chat.completions.create({
             model: 'llama-3.3-70b-versatile',
             response_format: { type: 'json_object' },
             messages: [{ role: 'user', content: prompt }]
          });
          if (res.choices && res.choices[0] && res.choices[0].message.content) return res.choices[0].message.content;
       }
     } catch (e: any) {
        lastError = e;
        const isRateLimit = e?.status === 429 || e?.message?.includes('429') || e?.status === 402 || e?.message?.includes('402') || e?.status === 401 || e?.message?.includes('401');
        if (!isRateLimit) {
           console.warn(JSON.stringify({ 
               severity: 'WARNING', 
               message: `AI provider ${provider} failed.`, 
               error: e.message || e.toString() 
           }));
        }
     }
   }
   
   if (lastError) {
      if (lastError.status === 429 || lastError.message?.includes('429') || lastError.status === 402 || lastError.message?.includes('402') || lastError.message?.includes('timed out')) {
         // Silenced for transient rate limits
         throw lastError;
      }
      console.warn(JSON.stringify({ severity: 'WARNING', message: `All AI providers failed. Last error: ${lastError.message || 'Unknown'}`, error: lastError.message }));
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
      INSERT OR REPLACE INTO article_ai_cache (url_hash, reading_mode, lens_intensity, reframed_headline, reframed_summary, cultural_lens_analysis, key_takeaways, what_this_means_for_us, statistical_data)
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
         INSERT OR REPLACE INTO article_ai_cache (url_hash, reading_mode, lens_intensity, reframed_headline, reframed_summary, cultural_lens_analysis, key_takeaways, what_this_means_for_us, statistical_data)
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
      Source: ${article.source_name}
      ${['Al Jazeera', 'France 24', 'Africa News'].includes(article.source_name) ? "Note: This source is a state-adjacent international broadcaster. In your cultural_lens_analysis, explicitly acknowledge or critique its geopolitical framing." : ""}
      Context: ${safeContext}
      Category: ${article.category}
      
      Output strictly valid JSON with NO markdown codeblock wrapping! We need the raw JSON object string.
      Do not invent fabricated statistical sources. If there is real statistical data, include it, otherwise use null for statistical_data.
      You perform critical content moderation. If the text promotes violence, explicit content, or obvious misinformation without credible framing, set "is_safe" to false and provide a "verification_warning".
      Format:
      {
         "reframed_headline": "Simple clear headline",
         "reframed_summary": "1-3 sentences summary",
         "cultural_lens_analysis": "Systemic analysis paragraph",
         "key_takeaways": ["point 1", "point 2"],
         "what_this_means_for_us": ["community point 1", "community point 2"],
         "is_safe": true,
         "verification_warning": null,
         "statistical_data": {
            "title": "Chart Title", 
            "type": "bar", 
            "data": [{"name": "Label1", "value": 10}, {"name": "Label2", "value": 20}], 
            "reference": "REAL EXTRACTED SOURCE OR OMIT"
         } // or null
      }
      `;

      const responseText = await callAIQueued(prompt);
      
      if (!responseText) throw new Error("AI Queue returned null response");
      
      let aiResponse: any = null;
      try {
        const jsonMatch = (responseText || '').match(/\{[\s\S]*\}/);
        aiResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        
        if (aiResponse.is_safe === false) {
           console.warn(`[Content Moderation] Article filtered out: ${article.url_hash}. Warning: ${aiResponse.verification_warning}`);
           db.prepare('UPDATE articles SET is_moderated = 1 WHERE url_hash = ?').run(article.url_hash);
           return;
        }

        const stringFields = ['reframed_headline', 'reframed_summary', 'cultural_lens_analysis'];
        for (const field of stringFields) {
          if (aiResponse[field] !== null && typeof aiResponse[field] === 'object') {
            aiResponse[field] = Object.values(aiResponse[field])
              .filter((v: any) => typeof v === 'string')
              .join(' ') || JSON.stringify(aiResponse[field]);
          }
        }
        
        if (!aiResponse.reframed_headline && !aiResponse.reframed_summary) throw new Error("Empty AI response");
      } catch (e) {
        console.warn("AI JSON parse failure for article:", article.url_hash, "Raw text:", responseText?.substring(0, 200));
        
        // Insert fallback to avoid infinite retry loops on poison pill articles
        insertDeterministicFallback();
        return;
      }

        const sanitizedTakeaways = Array.isArray(aiResponse.key_takeaways) 
          ? aiResponse.key_takeaways.map((t: any) => typeof t === 'string' ? t : JSON.stringify(t))
          : [];
        const sanitizedMeans = Array.isArray(aiResponse.what_this_means_for_us)
          ? aiResponse.what_this_means_for_us.map((t: any) => typeof t === 'string' ? t : JSON.stringify(t))
          : [];

      db.prepare(`
        INSERT OR REPLACE INTO article_ai_cache (url_hash, reading_mode, lens_intensity, reframed_headline, reframed_summary, cultural_lens_analysis, key_takeaways, what_this_means_for_us, statistical_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        article.url_hash, readingMode, lensIntensity,
        aiResponse.reframed_headline || article.original_title,
        aiResponse.reframed_summary || article.original_text_dump?.substring(0, 200) || "",
        aiResponse.cultural_lens_analysis || "Analysis currently unavailable.",
        JSON.stringify(sanitizedTakeaways),
        JSON.stringify(sanitizedMeans),
        aiResponse.statistical_data ? JSON.stringify(aiResponse.statistical_data) : null
      );
    } catch (e: any) {
      const isRetryable = e?.status === 429 || e?.message?.includes('429') || e?.status === 402 || e?.message?.includes('402') || e?.message?.includes('timed out') || e?.status === 503 || e?.message?.includes('503') || e?.status === 500;
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
