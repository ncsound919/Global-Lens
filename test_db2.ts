import db from './db';

const rows = db.prepare('SELECT url_hash, key_takeaways, what_this_means_for_us FROM article_ai_cache LIMIT 5;').all();
console.log(rows.map((r: any) => ({
  id: r.url_hash,
  key_takeaways: typeof r.key_takeaways === 'string' ? JSON.parse(r.key_takeaways) : r.key_takeaways,
  what_this_means_for_us: typeof r.what_this_means_for_us === 'string' ? JSON.parse(r.what_this_means_for_us) : r.what_this_means_for_us
})));
