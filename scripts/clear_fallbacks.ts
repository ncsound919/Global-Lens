import db from '../db';
const res = db.prepare("DELETE FROM article_ai_cache WHERE what_this_means_for_us LIKE '%This issue warrants further community observation.%'").run();
console.log(`Deleted ${res.changes} fallback rows.`);
