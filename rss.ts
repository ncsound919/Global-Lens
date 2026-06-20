import Parser from "rss-parser";
import db from "./db";
import { processRawArticleForConfig } from "./aiService";
import { feeds } from "./feeds";
import crypto from "crypto";

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure'],
      ['image', 'image']
    ]
  }
});

let isSyncing = false;
let needsSync = false;

const feedHealth = new Map<string, { fails: number, last_success?: number }>();

export function getFeedHealth() {
  const result: any = {};
  for (const [url, status] of feedHealth.entries()) {
    result[url] = status;
  }
  return result;
}

function generateStableHash(sourceName: string, title: string, content: string): string {
  return crypto.createHash('sha256').update(`${sourceName}:${title}:${content.slice(0, 50)}`).digest('hex');
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  return Promise.race([
    parser.parseURL(url),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
  ]);
}

export async function syncRSSNews() {
  if (isSyncing) {
    needsSync = true;
    return;
  }
  isSyncing = true;
  
  do {
    needsSync = false;
    try {
      console.log("Starting RSS Sync Sweep...");
    const feedResults = { successes: 0, errors: 0, itemsIngested: 0, skipped: 0 };

    for (const feed of feeds) {
      const status = feedHealth.get(feed.url) || { fails: 0 };
      const fails = status.fails;
      if (fails >= 3) {
        feedHealth.set(feed.url, { ...status, fails: fails - 1 });
        feedResults.skipped++;
        continue;
      }

      let retries = 2;
      let parsed: any = null;
      while (retries > 0 && !parsed) {
        try {
          parsed = await fetchWithTimeout(feed.url, 8000);
          feedHealth.set(feed.url, { fails: 0, last_success: Date.now() }); // Reset health on success
        } catch (err: any) {
          retries--;
          console.warn(`Feed fetch warning for ${feed.url} (retries left: ${retries}) - ${err.message}`);
          if (retries === 0) {
            feedHealth.set(feed.url, { ...status, fails: fails + 1 });
            feedResults.errors++;
          }
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
           if (item.mediaContent && item.mediaContent['$'] && item.mediaContent['$'].url) {
             imageUrl = item.mediaContent['$'].url;
           } else if (item.enclosure && item.enclosure.url) {
             imageUrl = item.enclosure.url;
           } else if (item.image) {
             imageUrl = typeof item.image === 'string' ? item.image : item.image.url;
           }
           
           const pubDate = item.pubDate || item.isoDate || null;
           
           const stmt = db.prepare('INSERT OR IGNORE INTO articles (url_hash, category, source_name, original_title, original_url, image_url, original_text_dump, pub_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
           const info = stmt.run(
             urlHash, feed.category, feed.source_name, item.title || "Untitled", item.link || "#", imageUrl, textDump, pubDate
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
    
    console.log(`RSS Ingestion Complete: ${feedResults.successes} successful feeds, ${feedResults.skipped} skipped, ${feedResults.errors} unreachable, ${feedResults.itemsIngested} new items saved.`);

    // Prune articles older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const pruneInfo = db.prepare("DELETE FROM articles WHERE created_at < ?").run(thirtyDaysAgo.toISOString());
    if (pruneInfo.changes > 0) {
       console.log(`Pruned ${pruneInfo.changes} legacy articles.`);
    }

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
           try {
             await processRawArticleForConfig(article, config.reading_mode, config.lens_intensity);
           } catch (e: any) {
             console.error(`Article process threw for ${article.url_hash}:`, e.message);
           }
         }
      }
    }
    
  } catch (err) {
    console.error("RSS Sync Master Error", err);
  }
  } while (needsSync);
  
  isSyncing = false;
}
