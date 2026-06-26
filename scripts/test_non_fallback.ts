import db from '../db';

const rows = db.prepare("SELECT url_hash, key_takeaways, what_this_means_for_us FROM article_ai_cache WHERE what_this_means_for_us NOT LIKE '%This issue warrants further community observation.%' LIMIT 10").all();
console.log(`Found ${rows.length} rows`);
if (rows.length > 0) {
  console.log(JSON.stringify(rows, null, 2));
}
