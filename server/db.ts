import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

// Select db path safely, preferring custom path or mounted volumes
const getDbPath = (): string => {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  try {
    if (fs.existsSync('/data')) {
      return path.join('/data', 'app.sqlite');
    }
  } catch (e) {}
  return path.join(process.cwd(), 'app.sqlite');
};

const dbPath = getDbPath();
const db = new Database(dbPath);

// Enable pragmas
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Encryption and decryption helpers for sensitive user data (like gemini_api_key)
const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = crypto.createHash('sha256').update(process.env.SESSION_SECRET || process.env.GEMINI_API_KEY || 'global-lens-default-secret-key-12345').digest();

export function encrypt(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  if (!text) return "";
  try {
    const parts = text.split(':');
    if (parts.length !== 2) return "";
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedTextHex = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encryptedTextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error("Decryption failed:", e);
    return "";
  }
}

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
if (!tableInfo.some(column => column.name === 'is_moderated')) {
  db.exec('ALTER TABLE articles ADD COLUMN is_moderated INTEGER DEFAULT 0;');
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

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS user_settings (
    session_id TEXT PRIMARY KEY,
    reading_mode TEXT DEFAULT 'simplified',
    lens_intensity TEXT DEFAULT 'balanced',
    odds_format TEXT DEFAULT 'american',
    regions TEXT DEFAULT '{"us":true,"westAfrica":false,"caribbean":true}',
    gemini_api_key TEXT DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const userSettingsInfo = db.pragma('table_info(user_settings)') as any[];
if (!userSettingsInfo.some(column => column.name === 'gemini_api_key')) {
  db.exec('ALTER TABLE user_settings ADD COLUMN gemini_api_key TEXT;');
}

// Clean up expired sessions (older than 30 days) on startup
try {
  db.prepare("DELETE FROM sessions WHERE datetime(created_at, '+30 days') < datetime('now')").run();
} catch (e) {
  console.error("Failed to clean up expired sessions on startup:", e);
}

export default db;
