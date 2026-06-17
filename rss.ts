import Parser from "rss-parser";
import db from "./db";
import { processRawArticleForConfig } from "./aiService";
import { feeds } from "./feeds";
import crypto from "crypto";

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure'],
      ['image', 'image']
    ]
  }
});

let isSyncing = false;

function generateStableHash(sourceName: string, title: string, content: string): string {
  return crypto.createHash('sha256').update(`${sourceName}:${title}:${content.slice(0, 50)}`).digest('hex');
}

export async function syncRSSNews() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    console.log("Starting RSS Sync Sweep...");
    const feedResults = { successes: 0, errors: 0, itemsIngested: 0 };

    for (const feed of feeds) {
      let retries = 2;
      let parsed: any = null;
      while (retries > 0 && !parsed) {
        try {
          parsed = await parser.parseURL(feed.url);
        } catch (err: any) {
          retries--;
          console.warn(`Feed fetch warning for ${feed.url} (retries left: ${retries}) - ${err.message}`);
          if (retries === 0) feedResults.errors++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!parsed) continue;

      try {
        for (const item of parsed.items) {
           const textDump = `${item.title || ""}\n\n${item.contentSnippet || item.content || ""}`.trim();
           
           // Robust dedupe fallback
           let urlHash = item.link || item.guid;
           if (!urlHash) {
             urlHash = generateStableHash(feed.source_name, item.title || "", textDump);
           }

           let imageUrl = null;
           if (item.enclosure && item.enclosure.url) {
             imageUrl = item.enclosure.url;
           } else if (item.mediaContent && item.mediaContent['$'] && item.mediaContent['$'].url) {
             imageUrl = item.mediaContent['$'].url;
           } else if (item.image) {
             imageUrl = typeof item.image === 'string' ? item.image : item.image.url;
           }
           
           const stmt = db.prepare('INSERT OR IGNORE INTO articles (url_hash, category, source_name, original_title, original_url, image_url, original_text_dump) VALUES (?, ?, ?, ?, ?, ?, ?)');
           const info = stmt.run(
             urlHash, feed.category, feed.source_name, item.title || "Untitled", item.link || "#", imageUrl, textDump
           );
           
           if (info.changes > 0) {
             feedResults.itemsIngested++;
           }
        }
        feedResults.successes++;
      } catch (err: any) {
        console.warn("Failed to process feed items", feed.url, err.message);
        feedResults.errors++;
      }
    }
    
    console.log(`RSS Ingestion Complete: ${feedResults.successes} successful feeds, ${feedResults.errors} unreachable feeds, ${feedResults.itemsIngested} new items saved.`);

    const activeConfigs = db.prepare('SELECT DISTINCT reading_mode, lens_intensity FROM user_settings').all() as { reading_mode: string, lens_intensity: string }[];
    if (!activeConfigs.some(c => c.reading_mode === 'simplified' && c.lens_intensity === 'balanced')) {
       activeConfigs.push({ reading_mode: 'simplified', lens_intensity: 'balanced' });
    }

    // Instead of artificial limits per config, find un-processed top recent articles for each active config
    for (const config of activeConfigs) {
      // Find recent articles that haven't been AI processed for this specific config yet
      const unprocessedArticles = db.prepare(`
        SELECT a.* FROM articles a
        LEFT JOIN article_ai_cache c 
          ON a.url_hash = c.url_hash 
          AND c.reading_mode = ? 
          AND c.lens_intensity = ?
        WHERE c.id IS NULL
        ORDER BY a.created_at DESC 
        LIMIT 25 -- Backlog batch max per sync
      `).all(config.reading_mode, config.lens_intensity) as any[];
      
      if (unprocessedArticles.length > 0) {
         console.log(`Processing ${unprocessedArticles.length} new articles for config [${config.reading_mode}/${config.lens_intensity}]`);
         for (const article of unprocessedArticles) {
           await processRawArticleForConfig(article, config.reading_mode, config.lens_intensity);
         }
      }
    }
    
  } catch (err) {
    console.error("RSS Sync Master Error", err);
  } finally {
    isSyncing = false;
  }
}
