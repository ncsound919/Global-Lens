import db from './db';
import { feeds } from './feeds';

function safeJSONParse(data: any, fallback: any = []) {
  if (!data) return fallback;
  try { return JSON.parse(data); } catch (e) { return fallback; }
}

const raw = db.prepare(`SELECT a.*, c.reframed_headline, c.key_takeaways, c.what_this_means_for_us FROM articles a LEFT JOIN article_ai_cache c ON a.url_hash = c.url_hash LIMIT 2`).all();

console.log(raw.map((r: any) => ({
  id: r.url_hash,
  key_takeaways: safeJSONParse(r.key_takeaways, []),
  what_this_means_for_us: safeJSONParse(r.what_this_means_for_us, [])
})));
