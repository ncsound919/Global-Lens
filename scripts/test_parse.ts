import db from '../db';
const row = db.prepare('SELECT url_hash, key_takeaways, what_this_means_for_us FROM article_ai_cache LIMIT 1').get();
console.log(row.what_this_means_for_us);
console.log(JSON.parse(row.what_this_means_for_us));
