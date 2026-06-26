import { processRawArticleForConfig } from '../aiService';
import db from '../db';

const article = db.prepare('SELECT * FROM articles LIMIT 1').get();

async function run() {
  console.log("Running process...");
  db.prepare('DELETE FROM article_ai_cache WHERE url_hash = ?').run(article.url_hash);
  try {
    await processRawArticleForConfig(article, 'standard', 'balanced');
    const updated = db.prepare('SELECT reframed_headline, key_takeaways, what_this_means_for_us FROM article_ai_cache WHERE url_hash = ?').get(article.url_hash);
    console.log(updated);
  } catch (e) {
    console.error("FAIL:", e);
  }
}
run();
