import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'app.sqlite');
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    url_hash TEXT PRIMARY KEY,
    category TEXT,
    source_name TEXT,
    original_title TEXT,
    original_url TEXT,
    image_url TEXT,
    original_text_dump TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.exec('ALTER TABLE articles ADD COLUMN image_url TEXT;');
} catch (e) {
  // Ignore if column already exists
}

db.exec(`
  CREATE TABLE IF NOT EXISTS article_ai_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url_hash TEXT,
    reading_mode TEXT,
    lens_intensity TEXT,
    reframed_headline TEXT,
    reframed_summary TEXT,
    cultural_lens_analysis TEXT,
    key_takeaways TEXT,
    what_this_means_for_us TEXT,
    statistical_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(url_hash, reading_mode, lens_intensity)
  );

  CREATE TABLE IF NOT EXISTS article_backstory_cache (
    url_hash TEXT PRIMARY KEY,
    historical_backstory TEXT
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    session_id TEXT PRIMARY KEY,
    reading_mode TEXT DEFAULT 'simplified',
    lens_intensity TEXT DEFAULT 'balanced',
    odds_format TEXT DEFAULT 'american',
    regions TEXT DEFAULT '{"us":true,"westAfrica":false,"caribbean":true}',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export default db;
