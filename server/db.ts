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

  if (process.env.NODE_ENV === 'production') {
    console.warn("🚨 SECURITY & PERSISTENCE WARNING: Running in production without DB_PATH or /data volume. Data will be volatile!");
  }
  return path.join(process.cwd(), 'app.sqlite');
};

const dbPath = getDbPath();
const db = new Database(dbPath);

// Enable pragmas
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Secure key derivation without hardcoded fallback strings
const getSecretKey = (): Buffer => {
  const secret = process.env.SESSION_SECRET || process.env.GEMINI_API_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("CRITICAL SECURITY ERROR: SESSION_SECRET is required in production environments but was not set.");
    }
    // In development, throw clear instructions instead of quiet insecure fallback
    throw new Error("Environment configuration error: Either SESSION_SECRET or GEMINI_API_KEY must be set in the environment to derive secure keys.");
  }
  return crypto.createHash('sha256').update(secret).digest();
};

const SECRET_KEY = getSecretKey();
const ALGORITHM_GCM = 'aes-256-gcm';
const ALGORITHM_CBC = 'aes-256-cbc';

/**
 * Encrypts sensitive data using authenticated AES-256-GCM encryption.
 */
export function encrypt(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(12); // Standard 12 bytes IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM_GCM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + encrypted + ':' + tag.toString('hex');
}

/**
 * Decrypts sensitive data supporting both AES-256-GCM (authenticated) and legacy AES-256-CBC (unauthenticated fallback).
 */
export function decrypt(text: string): string {
  if (!text) return "";
  try {
    const parts = text.split(':');
    if (parts.length === 3) {
      // Authenticated AES-256-GCM decryption
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedHex = parts[1];
      const tag = Buffer.from(parts[2], 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM_GCM, SECRET_KEY, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } else if (parts.length === 2) {
      // Legacy unauthenticated AES-256-CBC decryption fallback for zero-downtime migration
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedHex = parts[1];
      const decipher = crypto.createDecipheriv(ALGORITHM_CBC, SECRET_KEY, iv);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    return "";
  } catch (e) {
    // Silent failure on decryption errors to prevent security log noise/telemetry leakage
    return "";
  }
}

/**
 * Versioned Migration Runner to keep the database schema robust and predictable.
 */
export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      run_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const runMigration = (name: string, upFn: () => void) => {
    const executed = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(name);
    if (!executed) {
      console.log(`[Database Migration] Running migration: ${name}`);
      try {
        db.transaction(() => {
          upFn();
          db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
        })();
        console.log(`[Database Migration] Migration successfully completed: ${name}`);
      } catch (err) {
        console.error(`[Database Migration] Migration failed: ${name}`, err);
        throw err;
      }
    }
  };

  // Migration 1: Setup initial articles, AI caching, Backstory, and Users tables
  runMigration('001_initial_schema', () => {
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    `);
  });

  // Migration 2: Setup or migrate user_settings using neutral 'owner_id' as the key
  runMigration('002_user_settings_refactor', () => {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'").get();
    if (!tableExists) {
      db.exec(`
        CREATE TABLE user_settings (
          owner_id TEXT PRIMARY KEY,
          reading_mode TEXT DEFAULT 'simplified',
          lens_intensity TEXT DEFAULT 'balanced',
          odds_format TEXT DEFAULT 'american',
          regions TEXT DEFAULT '{"us":true,"westAfrica":false,"caribbean":true}' CHECK(json_valid(regions)),
          gemini_api_key TEXT DEFAULT '',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      const cols = db.pragma("table_info(user_settings)") as any[];
      const hasSessionId = cols.some(c => c.name === 'session_id');
      const hasOwnerId = cols.some(c => c.name === 'owner_id');
      
      if (hasSessionId && !hasOwnerId) {
        db.exec('ALTER TABLE user_settings RENAME COLUMN session_id TO owner_id;');
      }
      if (!cols.some(c => c.name === 'gemini_api_key')) {
        db.exec('ALTER TABLE user_settings ADD COLUMN gemini_api_key TEXT DEFAULT "";');
      }
    }
  });
}

// Run migrations immediately on bootstrap
runMigrations();

// Function to clean up expired sessions from the database
export function cleanExpiredSessions() {
  try {
    const result = db.prepare(`
      DELETE FROM sessions 
      WHERE (expires_at IS NOT NULL AND datetime(expires_at) < datetime('now'))
         OR datetime(created_at, '+30 days') < datetime('now')
    `).run();
    if (result.changes > 0) {
      console.log(`[Session Cleanup] Successfully removed ${result.changes} expired sessions.`);
    }
  } catch (e) {
    console.error("[Session Cleanup] Error cleaning up expired sessions:", e);
  }
}

// Perform initial cleanup on boot
cleanExpiredSessions();

// Recurring automated session cleanup running every 6 hours
setInterval(cleanExpiredSessions, 6 * 60 * 60 * 1000).unref();

export default db;
