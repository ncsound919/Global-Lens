import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

// Select db path safely, preferring custom paths or mounted volumes.
// Independent of the current working directory: if a database already exists
// in the project dir (module-relative) it wins, so launching the bundled
// server from any cwd still uses the same SQLite file.
const getDbPath = (): string => {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  try {
    if (fs.existsSync('/data')) {
      return path.join('/data', 'app.sqlite');
    }
  } catch (e) {}

  const candidates = [
    path.join(process.cwd(), 'app.sqlite'),
    path.resolve(__dirname, 'app.sqlite'), // dev (tsx server.ts): project root
    path.resolve(__dirname, '..', 'app.sqlite'), // prod bundle (dist/server.cjs): project root
  ];
  const existing = candidates.find((p) => fs.existsSync(p));
  if (existing) return existing;

  if (process.env.NODE_ENV === 'production') {
    console.warn("🚨 SECURITY & PERSISTENCE WARNING: Running in production without DB_PATH or /data volume. Data will be volatile!");
  }
  return candidates[0];
};

const dbPath = getDbPath();
const db = new Database(dbPath);

// Enable pragmas
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Secure key derivation without hardcoded fallback strings
const getSecretKey = (): Buffer => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("CRITICAL SECURITY ERROR: SESSION_SECRET is required in production environments but was not set.");
    }
    // In development, warn the user and use a consistent dev fallback secret
    console.warn("⚠️ WARNING: SESSION_SECRET is not set in the environment. Using a default development key. Do NOT use this in production!");
    return crypto.createHash('sha256').update('global-lens-default-dev-secret-key-12345').digest();
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
  } catch (e: any) {
    // Log decryption failures securely without leaking raw ciphertext or key values
    console.error("[Database Decryption] Decryption failed. This may indicate a wrong or rotated SESSION_SECRET, payload corruption, or a key derivation mismatch. Details:", e.message);
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

  // Migration 3: Transition user_settings to hold strictly user accounts with foreign key to users
  runMigration('003_user_settings_foreign_key', () => {
    // 1. Create a temporary new table with the foreign key constraint
    db.exec(`
      CREATE TABLE user_settings_new (
        owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        reading_mode TEXT DEFAULT 'simplified',
        lens_intensity TEXT DEFAULT 'balanced',
        odds_format TEXT DEFAULT 'american',
        regions TEXT DEFAULT '{"us":true,"westAfrica":false,"caribbean":true}' CHECK(json_valid(regions)),
        gemini_api_key TEXT DEFAULT '',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Copy existing settings that belong to real users (if any)
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'").get();
    if (tableExists) {
      db.exec(`
        INSERT INTO user_settings_new (owner_id, reading_mode, lens_intensity, odds_format, regions, gemini_api_key, updated_at)
        SELECT s.owner_id, s.reading_mode, s.lens_intensity, s.odds_format, s.regions, s.gemini_api_key, s.updated_at
        FROM user_settings s
        JOIN users u ON s.owner_id = u.id;
      `);
      db.exec(`DROP TABLE user_settings;`);
    }
    db.exec(`ALTER TABLE user_settings_new RENAME TO user_settings;`);
  });

  // Migration 4: Overlay Global Lens — ecosystem content tables (papers, trends, discoveries, metaphors)
  runMigration('004_insights_content', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS research_papers (
        id TEXT PRIMARY KEY,
        source TEXT,
        title TEXT,
        url TEXT,
        year INTEGER,
        authors TEXT,
        abstract TEXT,
        summary TEXT,
        category TEXT,
        pillar TEXT,
        evidence_tier TEXT,
        payload TEXT,
        pub_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_research_papers_pillar ON research_papers(pillar);
      CREATE INDEX IF NOT EXISTS idx_research_papers_pub_date ON research_papers(pub_date DESC);

      CREATE TABLE IF NOT EXISTS trends (
        id TEXT PRIMARY KEY,
        title TEXT,
        summary TEXT,
        direction TEXT,
        slope REAL,
        confidence REAL,
        evidence_tier TEXT,
        recommended_action TEXT,
        source TEXT,
        category TEXT,
        payload TEXT,
        pub_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_trends_evidence_tier ON trends(evidence_tier);
      CREATE INDEX IF NOT EXISTS idx_trends_pub_date ON trends(pub_date DESC);

      CREATE TABLE IF NOT EXISTS discoveries (
        id TEXT PRIMARY KEY,
        title TEXT,
        insight TEXT,
        evidence_tier TEXT,
        hypothesis_id TEXT,
        linked_patch_id TEXT,
        source TEXT,
        category TEXT,
        payload TEXT,
        pub_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_discoveries_evidence_tier ON discoveries(evidence_tier);
      CREATE INDEX IF NOT EXISTS idx_discoveries_pub_date ON discoveries(pub_date DESC);

      CREATE TABLE IF NOT EXISTS metaphors (
        id TEXT PRIMARY KEY,
        url_hash TEXT REFERENCES articles(url_hash) ON DELETE CASCADE,
        topic TEXT,
        protocol_id TEXT,
        core_tension TEXT,
        mappings TEXT,
        beat_structure TEXT,
        narrative TEXT,
        lesson TEXT,
        codex_scores TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_metaphors_url_hash ON metaphors(url_hash);
    `);
  });

  // Migration 5: Add article_body to article_ai_cache (referenced by later
  // backfill and aiService/news reads; 001 predates the column).
  runMigration('005_article_body_column', () => {
    const cols = db.pragma("table_info(article_ai_cache)") as any[];
    if (!cols.some((c) => c.name === "article_body")) {
      db.exec(`ALTER TABLE article_ai_cache ADD COLUMN article_body TEXT DEFAULT "";`);
    }
  });

  // Migration 6: Backfill legacy cache rows that predate the article_body column
  // with a plain multi-paragraph body derived from the original dispatch.
  runMigration('006_article_body_backfill', () => {
    db.exec(`
      UPDATE article_ai_cache
      SET article_body = (
        SELECT a.original_text_dump
        FROM articles a WHERE a.url_hash = article_ai_cache.url_hash
      )
      WHERE article_body IS NULL OR article_body = ''
    `);
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
