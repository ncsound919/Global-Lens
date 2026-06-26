import db from '../db';

const rows = db.prepare('SELECT url_hash, key_takeaways, what_this_means_for_us FROM article_ai_cache LIMIT 10').all();
console.log(JSON.stringify(rows, null, 2));
