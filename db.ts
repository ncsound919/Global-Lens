import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'app.sqlite');
const db = new Database(dbPath);

// Enable pragmas
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

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
    pub_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_moderated INTEGER DEFAULT 0
  );
`);

// Add missing columns if needed
const tableInfo = db.pragma('table_info(articles)') as any[];
if (!tableInfo.some(column => column.name === 'image_url')) {
  db.exec('ALTER TABLE articles ADD COLUMN image_url TEXT;');
}
if (!tableInfo.some(column => column.name === 'pub_date')) {
  db.exec('ALTER TABLE articles ADD COLUMN pub_date TEXT;');
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
  CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);

  CREATE TABLE IF NOT EXISTS article_ai_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url_hash TEXT REFERENCES articles(url_hash) ON DELETE CASCADE,
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
    url_hash TEXT PRIMARY KEY REFERENCES articles(url_hash) ON DELETE CASCADE,
    historical_backstory TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
try {
  db.prepare("ALTER TABLE articles ADD COLUMN is_moderated INTEGER DEFAULT 0").run();
} catch (e) {
  // Column might already exist
}
