import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// ============================================================================
// Database facade â€” ASYNC.
//
// Local / fleet: better-sqlite3 (fast, file-backed). Serverless (Vercel):
// Turso/libSQL over HTTP (persistent, SQLite-compatible â€” no SQL rewriting).
// Pick the driver with TURSO_URL; without it, fall back to the local file.
//
// EVERY call site must `await` db calls. Prepared statements keep the SQLite
// `?` placeholder style, which both drivers accept.
// ============================================================================

type Params = any[];

interface Prepared {
  get(...params: Params): Promise<Record<string, unknown> | undefined>;
  all(...params: Params): Promise<Record<string, unknown>[]>;
  run(...params: Params): Promise<{ changes: number; lastInsertRowid: number | bigint }>;
}

interface DbLike {
  prepare(sql: string): Prepared;
  exec(sql: string): Promise<void>;
  pragma(sql: string): Promise<Record<string, unknown>[]>;
  transaction<T>(fn: () => T): { run(): Promise<T> };
  close(): void;
}

const isVercel = process.env.VERCEL === '1';
const useRemote = Boolean(process.env.TURSO_URL);

// â”€â”€ driver selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getLocalDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  try {
    if (fs.existsSync('/data')) return path.join('/data', 'app.sqlite');
  } catch {
    /* ignore */
  }
  const candidates = [
    path.join(process.cwd(), 'app.sqlite'),
    path.resolve(import.meta.dirname, 'app.sqlite'),
    path.resolve(import.meta.dirname, '..', 'app.sqlite'),
  ];
  const existing = candidates.find((p) => fs.existsSync(p));
  if (existing) return existing;
  if (process.env.NODE_ENV === 'production' && !isVercel) {
    console.warn("ðŸš¨ SECURITY & PERSISTENCE WARNING: Running in production without DB_PATH or /data volume. Data will be volatile!");
  }
  return candidates[0];
}

async function loadLocalDriver(): Promise<DbLike> {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(getLocalDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  return {
    prepare(sql: string): Prepared {
      const stmt = db.prepare(sql);
      return {
        get: async (...p) => stmt.get(...p) as Record<string, unknown> | undefined,
        all: async (...p) => stmt.all(...p) as Record<string, unknown>[],
        run: async (...p) => {
          const r = stmt.run(...p);
          return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
        },
      };
    },
    exec: async (sql) => {
      db.exec(sql);
    },
    pragma: async (sql) =>
      db.pragma(sql.replace(/^PRAGMA\s+/i, '') as any) as unknown as Record<string, unknown>[],
    transaction<T>(fn: () => T) {
      // better-sqlite3 transactions are synchronous only; async migration steps
      // run without an explicit SQLite transaction (idempotent DDL — safe).
      return { run: async () => fn() };
    },
    close: () => db.close(),
  };
}

async function loadRemoteDriver(): Promise<DbLike> {
  // Pure-JS hrana-over-HTTP transport — no native `libsql` binary needed, so it
  // runs on Vercel (which does not install optional platform natives).
  const { createClient } = await import('@libsql/client/http');
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
  const toPlain = (rows: any[]): Record<string, unknown>[] =>
    rows.map((r) =>
      typeof r?.toJSON === 'function' ? r.toJSON() : Object.fromEntries((r?.entries?.() ?? []) as [string, unknown][])
    );
  return {
    prepare(sql: string): Prepared {
      return {
        get: async (...p) => {
          const r = await client.execute({ sql, args: p });
          return toPlain(r.rows)[0];
        },
        all: async (...p) => {
          const r = await client.execute({ sql, args: p });
          return toPlain(r.rows);
        },
        run: async (...p) => {
          const r = await client.execute({ sql, args: p });
          return { changes: Number(r.rowsAffected || 0), lastInsertRowid: r.lastInsertRowid };
        },
      };
    },
    exec: async (sql) => {
      // libSQL's execute() rejects multi-statement strings (SQL_MANY_STATEMENTS),
      // so split into statements and run them in one batch.
      const stmts = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (stmts.length > 1) {
        await client.batch(stmts);
      } else {
        await client.execute(sql);
      }
    },
    pragma: async (sql) => {
      const r = await client.execute(sql);
      return toPlain(r.rows);
    },
    transaction<T>(fn: () => T) {
      // Remote HTTP transactions are best-effort (idempotent migrations).
      return { run: async () => fn() };
    },
    close: () => undefined,
  };
}

let _dbPromise: Promise<DbLike> | null = null;
function getRawDb(): Promise<DbLike> {
  if (!_dbPromise) {
    _dbPromise = useRemote && process.env.TURSO_URL ? loadRemoteDriver() : loadLocalDriver();
  }
  return _dbPromise;
}

let _migrationsPromise: Promise<void> | null = null;
function ensureMigrations(): Promise<void> {
  if (!_migrationsPromise) _migrationsPromise = runMigrations();
  return _migrationsPromise;
}

export async function getDb(): Promise<DbLike> {
  const d = await getRawDb();
  await ensureMigrations();
  return d;
}

// â”€â”€ synchronous ergonomic wrapper (module-level) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Exposes the same surface as before but every method returns a Promise, so
// existing `db.prepare(...).get(...)` call sites only need an `await` added.
const db = {
  prepare(sql: string): Prepared {
    return {
      get: (...p: Params) => getDb().then((d) => d.prepare(sql).get(...p)),
      all: (...p: Params) => getDb().then((d) => d.prepare(sql).all(...p)),
      run: (...p: Params) => getDb().then((d) => d.prepare(sql).run(...p)),
    };
  },
  exec: (sql: string) => getDb().then((d) => d.exec(sql)),
  pragma: (sql: string) => getDb().then((d) => d.pragma(sql)),
  transaction<T>(fn: () => T) {
    return { run: () => getDb().then((d) => d.transaction(fn).run()) };
  },
  close: () => getDb().then((d) => d.close()),
};

// â”€â”€ secure key derivation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const getSecretKey = (): Buffer => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("CRITICAL SECURITY ERROR: SESSION_SECRET is required in production environments but was not set.");
    }
    console.warn("âš ï¸ WARNING: SESSION_SECRET is not set in the environment. Using a default development key. Do NOT use this in production!");
    return crypto.createHash('sha256').update('global-lens-default-dev-secret-key-12345').digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
};

const SECRET_KEY = getSecretKey();
const ALGORITHM_GCM = 'aes-256-gcm';
const ALGORITHM_CBC = 'aes-256-cbc';

export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM_GCM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + encrypted + ':' + tag.toString('hex');
}

export function decrypt(text: string): string {
  if (!text) return '';
  try {
    const parts = text.split(':');
    if (parts.length === 3) {
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedHex = parts[1];
      const tag = Buffer.from(parts[2], 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM_GCM, SECRET_KEY, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } else if (parts.length === 2) {
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedHex = parts[1];
      const decipher = crypto.createDecipheriv(ALGORITHM_CBC, SECRET_KEY, iv);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    return '';
  } catch (e: any) {
    console.error('[Database Decryption] Decryption failed:', e.message);
    return '';
  }
}

// â”€â”€ migrations (async) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function runMigrations() {
  const d = await getRawDb();
  await d.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      run_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const runMigration = async (name: string, upFn: () => Promise<void> | void) => {
    const executed = await d.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(name);
    if (executed) return;
    console.log(`[Database Migration] Running migration: ${name}`);
    try {
      await d.transaction(async () => {
        await upFn();
        await d.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)').run(name);
      }).run();
      console.log(`[Database Migration] Migration successfully completed: ${name}`);
    } catch (err) {
      console.error(`[Database Migration] Migration failed: ${name}`, err);
      throw err;
    }
  };

  await runMigration('001_initial_schema', async () => {
    await d.exec(`CREATE TABLE IF NOT EXISTS articles (
      url_hash TEXT PRIMARY KEY, category TEXT, source_name TEXT, original_title TEXT,
      original_url TEXT, image_url TEXT, original_text_dump TEXT, pub_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, is_moderated INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
    CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
    CREATE TABLE IF NOT EXISTS article_ai_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url_hash TEXT REFERENCES articles(url_hash) ON DELETE CASCADE,
      reading_mode TEXT, lens_intensity TEXT, reframed_headline TEXT, reframed_summary TEXT,
      cultural_lens_analysis TEXT, key_takeaways TEXT, what_this_means_for_us TEXT,
      statistical_data TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(url_hash, reading_mode, lens_intensity)
    );
    CREATE TABLE IF NOT EXISTS article_backstory_cache (
      url_hash TEXT PRIMARY KEY REFERENCES articles(url_hash) ON DELETE CASCADE,
      historical_backstory TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`);
  });

  await runMigration('002_user_settings_refactor', async () => {
    const tableExists = await d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'").get();
    if (!tableExists) {
      await d.exec(`CREATE TABLE user_settings (
        owner_id TEXT PRIMARY KEY,
        reading_mode TEXT DEFAULT 'simplified',
        lens_intensity TEXT DEFAULT 'balanced',
        odds_format TEXT DEFAULT 'american',
        regions TEXT DEFAULT '{"us":true,"westAfrica":false,"caribbean":true}',
        gemini_api_key TEXT DEFAULT '',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`);
    } else {
      const cols = await d.pragma('PRAGMA table_info(user_settings)');
      const hasSessionId = cols.some((c) => c.name === 'session_id');
      const hasOwnerId = cols.some((c) => c.name === 'owner_id');
      if (hasSessionId && !hasOwnerId) {
        await d.exec('ALTER TABLE user_settings RENAME COLUMN session_id TO owner_id;');
      }
      if (!cols.some((c) => c.name === 'gemini_api_key')) {
        await d.exec('ALTER TABLE user_settings ADD COLUMN gemini_api_key TEXT DEFAULT "";');
      }
    }
  });

  await runMigration('003_user_settings_foreign_key', async () => {
    await d.exec(`CREATE TABLE user_settings_new (
      owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      reading_mode TEXT DEFAULT 'simplified',
      lens_intensity TEXT DEFAULT 'balanced',
      odds_format TEXT DEFAULT 'american',
      regions TEXT DEFAULT '{"us":true,"westAfrica":false,"caribbean":true}',
      gemini_api_key TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO user_settings_new (owner_id, reading_mode, lens_intensity, odds_format, regions, gemini_api_key, updated_at)
    SELECT s.owner_id, s.reading_mode, s.lens_intensity, s.odds_format, s.regions, s.gemini_api_key, s.updated_at
    FROM user_settings s JOIN users u ON s.owner_id = u.id;
    DROP TABLE user_settings;
    ALTER TABLE user_settings_new RENAME TO user_settings;`).catch(() => {
      /* 003 is best-effort when user_settings doesn't exist yet */
    });
  });

  await runMigration('004_insights_content', async () => {
    await d.exec(`CREATE TABLE IF NOT EXISTS research_papers (
      id TEXT PRIMARY KEY, source TEXT, title TEXT, url TEXT, year INTEGER, authors TEXT,
      abstract TEXT, summary TEXT, category TEXT, pillar TEXT, evidence_tier TEXT,
      payload TEXT, pub_date TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_research_papers_pillar ON research_papers(pillar);
    CREATE INDEX IF NOT EXISTS idx_research_papers_pub_date ON research_papers(pub_date DESC);
    CREATE TABLE IF NOT EXISTS reference_papers (
      id TEXT PRIMARY KEY, source TEXT, title TEXT, url TEXT, year INTEGER, authors TEXT,
      abstract TEXT, summary TEXT, category TEXT, pillar TEXT, evidence_tier TEXT DEFAULT 'REF',
      payload TEXT, pub_date TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_reference_papers_title ON reference_papers(title);
    CREATE TABLE IF NOT EXISTS trends (
      id TEXT PRIMARY KEY, title TEXT, summary TEXT, direction TEXT, slope REAL,
      confidence REAL, evidence_tier TEXT, recommended_action TEXT, source TEXT,
      category TEXT, payload TEXT, pub_date TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_trends_evidence_tier ON trends(evidence_tier);
    CREATE INDEX IF NOT EXISTS idx_trends_pub_date ON trends(pub_date DESC);
    CREATE TABLE IF NOT EXISTS discoveries (
      id TEXT PRIMARY KEY, title TEXT, insight TEXT, evidence_tier TEXT,
      hypothesis_id TEXT, linked_patch_id TEXT, source TEXT, category TEXT,
      payload TEXT, pub_date TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_discoveries_evidence_tier ON discoveries(evidence_tier);
    CREATE INDEX IF NOT EXISTS idx_discoveries_pub_date ON discoveries(pub_date DESC);
    CREATE TABLE IF NOT EXISTS metaphors (
      id TEXT PRIMARY KEY, url_hash TEXT REFERENCES articles(url_hash) ON DELETE CASCADE,
      topic TEXT, protocol_id TEXT, core_tension TEXT, mappings TEXT, beat_structure TEXT,
      narrative TEXT, lesson TEXT, codex_scores TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_metaphors_url_hash ON metaphors(url_hash);`);
  });

  await runMigration('005_article_body_column', async () => {
    const cols = await d.pragma('PRAGMA table_info(article_ai_cache)');
    if (!cols.some((c) => c.name === 'article_body')) {
      await d.exec(`ALTER TABLE article_ai_cache ADD COLUMN article_body TEXT DEFAULT "";`);
    }
  });

  await runMigration('006_article_body_backfill', async () => {
    await d.exec(`UPDATE article_ai_cache
      SET article_body = (SELECT a.original_text_dump FROM articles a WHERE a.url_hash = article_ai_cache.url_hash)
      WHERE article_body IS NULL OR article_body = ''`);
  });

  await runMigration('007_oncology_findings', async () => {
    await d.exec(`CREATE TABLE IF NOT EXISTS research_findings (
      id TEXT PRIMARY KEY, paper_id TEXT, headline TEXT NOT NULL, kind TEXT NOT NULL,
      metric TEXT, value TEXT, unit TEXT, reference_claim TEXT, evidence_tier TEXT,
      manifest_hash TEXT, audit_signature TEXT, dataset TEXT, sample_size INTEGER,
      pub_date TEXT, payload TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_research_findings_pub_date ON research_findings(pub_date DESC);
    CREATE INDEX IF NOT EXISTS idx_research_findings_kind ON research_findings(kind);
    CREATE INDEX IF NOT EXISTS idx_research_findings_paper_id ON research_findings(paper_id);
    CREATE TABLE IF NOT EXISTS findings_of_day (
      day TEXT PRIMARY KEY, finding_id TEXT REFERENCES research_findings(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY, amount INTEGER NOT NULL, currency TEXT DEFAULT 'usd',
      campaign TEXT, recurring INTEGER DEFAULT 0, status TEXT DEFAULT 'pending',
      source TEXT DEFAULT 'stripe_webhook', settled_at TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_donations_settled_at ON donations(settled_at DESC);
    CREATE TABLE IF NOT EXISTS donation_events (
      event_id TEXT PRIMARY KEY, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`);
  });
}

// Migrations run lazily on first getDb()/query (see ensureMigrations).

// Expired session cleanup (fire-and-forget; unref so it never holds a process open)
export async function cleanExpiredSessions(): Promise<void> {
  try {
    const result = await db.prepare(`
      DELETE FROM sessions
      WHERE (expires_at IS NOT NULL AND datetime(expires_at) < datetime('now'))
         OR datetime(created_at, '+30 days') < datetime('now')
    `).run();
    if (result.changes > 0) {
      console.log(`[Session Cleanup] Successfully removed ${result.changes} expired sessions.`);
    }
  } catch (e) {
    console.error('[Session Cleanup] Error cleaning up expired sessions:', e);
  }
}

cleanExpiredSessions();
if (!isVercel) {
  setInterval(() => cleanExpiredSessions(), 6 * 60 * 60 * 1000).unref();
}

export default db;