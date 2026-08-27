import Parser from "rss-parser";
import db from "./db.js";
import { processRawArticleForConfig } from "./aiService.js";
import { feeds } from "./feeds.js";
import { repairMojibake } from "./encoding.js";
import crypto from "crypto";

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure'],
      ['image', 'image']
    ]
  }
});

// Fetch the OpenGraph image from an article page (best-effort; many RSS feeds
// omit media images, so we pull the og:image from the page itself so the
// outlet's front page and story views always have a picture).
async function fetchOgImage(articleUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(articleUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const og = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)
      || html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
    if (!og) return null;
    let url = og[1];
    try {
      url = new URL(url, articleUrl).toString();
    } catch { /* keep as-is */ }
    return url.startsWith("http") ? url : null;
  } catch {
    return null;
  }
}

// Backfill missing article images. Pulls the og:image from each article's own
// page (bounded per sync) so picture coverage fills in over time without
// hammering publisher sites.
export async function backfillArticleImages(limit = 30): Promise<number> {
  const rows = await db.prepare(`
    SELECT url_hash, original_url FROM articles
    WHERE (image_url IS NULL OR image_url = '')
    ORDER BY created_at DESC LIMIT ?
  `).all(limit) as any[];
  let filled = 0;
  for (const row of rows) {
    const url = row.original_url;
    if (!url || url === "#" || url.startsWith("global-lens://")) continue;
    const img = await fetchOgImage(url);
    if (img) {
      await db.prepare("UPDATE articles SET image_url = ? WHERE url_hash = ?").run(img, row.url_hash);
      filled++;
    }
  }
  if (filled > 0) console.log(`[rss] Backfilled ${filled} article image(s) via og:image.`);
  return filled;
}

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
          if (err.message && (err.message.includes('429') || err.message.includes('rate'))) {
            await new Promise(resolve => setTimeout(resolve, 10000));
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (!parsed) continue;

      try {
        for (const item of parsed.items) {
           const title = repairMojibake(item.title || "Untitled");
           const textDump = `${title}\n\n${repairMojibake(item.contentSnippet || item.content || "")}`.trim();
           
           // Robust dedupe fallback
           let rawUrl = item.link || item.guid;
           let urlHash = rawUrl;
           if (rawUrl && typeof rawUrl === 'string') {
             try {
               const parsedUrl = new URL(rawUrl);
               // Remove tracking params
               parsedUrl.searchParams.delete('utm_source');
               parsedUrl.searchParams.delete('utm_medium');
               parsedUrl.searchParams.delete('utm_campaign');
               parsedUrl.searchParams.delete('utm_term');
               parsedUrl.searchParams.delete('utm_content');
               parsedUrl.searchParams.delete('traffic_source');
               let cleanUrl = parsedUrl.toString();
               // Remove trailing slash
               if (cleanUrl.endsWith('/')) {
                 cleanUrl = cleanUrl.slice(0, -1);
               }
               urlHash = cleanUrl;
             } catch (e) {
               // Fallback if not a valid URL
               if (urlHash.endsWith('/')) urlHash = urlHash.slice(0, -1);
             }
           }
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
           
           let pubDate = item.isoDate || item.pubDate || new Date().toISOString();
           try {
             pubDate = new Date(pubDate).toISOString();
           } catch(e) {
             // Fallback to current time if parsing fails
             pubDate = new Date().toISOString();
           }
           
           const stmt = await db.prepare('INSERT OR IGNORE INTO articles (url_hash, category, source_name, original_title, original_url, image_url, original_text_dump, pub_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
           const info = await stmt.run(
             urlHash, feed.category, feed.source_name, title, item.link || "#", imageUrl, textDump, pubDate
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

    // Fill missing pictures from og:image so the outlet always has imagery.
    try {
      await backfillArticleImages(25);
    } catch (e: any) {
      console.warn(`[rss] Image backfill failed: ${e.message}`);
    }

    // Prune articles older than 30 days — use SQLite's datetime() so the
    // comparison format matches CURRENT_TIMESTAMP (YYYY-MM-DD HH:MM:SS UTC)
    // on both better-sqlite3 and Turso/libSQL.
    const pruneInfo = await db.prepare("DELETE FROM articles WHERE created_at < datetime('now', '-30 days')").run();
    if (pruneInfo.changes > 0) {
       console.log(`Pruned ${pruneInfo.changes} legacy articles.`);
    }

    const activeConfigs = await db.prepare('SELECT DISTINCT reading_mode, lens_intensity FROM user_settings').all() as { reading_mode: string, lens_intensity: string }[];
    if (!activeConfigs.some(c => c.reading_mode === 'simplified' && c.lens_intensity === 'balanced')) {
       activeConfigs.push({ reading_mode: 'simplified', lens_intensity: 'balanced' });
    }

    // Instead of artificial limits per config, find un-processed top recent articles for each active config
    for (const config of activeConfigs) {
      // Find recent articles that haven't been AI processed for this specific config yet
      const unprocessedArticles = await db.prepare(`
        SELECT a.* FROM articles a
        LEFT JOIN article_ai_cache c 
          ON a.url_hash = c.url_hash 
          AND c.reading_mode = ? 
          AND c.lens_intensity = ?
        WHERE c.id IS NULL
        ORDER BY a.created_at DESC 
        LIMIT 50 -- Backlog batch max per sync
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
