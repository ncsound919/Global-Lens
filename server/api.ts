import express from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import db from "./db";
import { syncRSSNews, getFeedHealth } from "./rss";
import { authRouter } from "./auth";
import { settingsRouter } from "./settings";
import { newsRouter } from "./news";
import { insightsRouter } from "./insights";
import { getFindingOfDay, getFindings, upsertFinding, setFindingOfDay } from "./oncology";
import { donateRouter, getSettledDonationStats } from "./donations";

const standardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // max 120 requests per minute for public API protection
  validate: { xForwardedForHeader: false }
});

const syncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 2, // 2 syncs per 5 minutes per IP
  message: { detail: 'Too many sync requests. Please try again later.' },
  validate: { xForwardedForHeader: false }
});

export const apiRouter = express.Router();
apiRouter.use(standardLimiter);

/**
 * Validates session against database to return authenticated details.
 * Strictly uses the secure HTTP-only bgl_session cookie for session identification.
 */
export function getAuthSession(req: express.Request) {
  const sessionId = req.cookies?.bgl_session as string | undefined;
  if (!sessionId) return null;
  
  try {
    const session = db.prepare(`
      SELECT s.session_id, s.user_id, u.email 
      FROM sessions s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.session_id = ? 
        AND (s.expires_at IS NULL OR datetime(s.expires_at) > datetime('now'))
        AND datetime(s.created_at, '+30 days') > datetime('now')
    `).get(sessionId) as any;
    
    return session || null;
  } catch (e) {
    console.error("getAuthSession error:", e);
    return null;
  }
}

// Register sub-routers
apiRouter.use("/auth", authRouter);
apiRouter.use("/user", settingsRouter);
apiRouter.use("/news", newsRouter);
// Overlay Global Lens — ecosystem content (papers/trends/discoveries/metaphors)
apiRouter.use("/", insightsRouter);

// Overlay Oncology — verified research findings + transparent donations.
apiRouter.use("/donate", donateRouter);

apiRouter.get("/oncology/overview", (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const fod = getFindingOfDay(today);
  const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
  const findings = getFindings({ kind });
  const papers = db.prepare(`
    SELECT * FROM research_papers
    WHERE category = 'cancer-research'
    ORDER BY COALESCE(pub_date, created_at) DESC LIMIT 50
  `).all() as any[];
  res.json({
    finding_of_day: fod,
    findings: findings.findings,
    papers: papers.map((p) => ({
      id: p.id, source: p.source, title: p.title, url: p.url, year: p.year,
      authors: p.authors, abstract: p.abstract, summary: p.summary,
      category: p.category, pillar: p.pillar, evidence_tier: p.evidence_tier,
      pub_date: p.pub_date,
    })),
    donations: getSettledDonationStats(),
  });
});

// Service utility endpoints
// Health counts are memoized briefly (TTL) so liveness checks stay cheap even
// when the article/research tables are large or a background sync is writing.
// A stale-by-seconds count is acceptable for an uptime probe.
const countCache = new Map<string, { value: number; at: number }>();
const COUNT_TTL_MS = 5_000;

function countRows(sql: string, key: string): number {
  const hit = countCache.get(key);
  if (hit && Date.now() - hit.at < COUNT_TTL_MS) return hit.value;
  let value = 0;
  try {
    value = (db.prepare(sql).get() as any)?.c ?? 0;
  } catch {
    value = 0;
  }
  countCache.set(key, { value, at: Date.now() });
  return value;
}

apiRouter.get("/health", (req, res) => {
  try {
    const isDbAlive = db.prepare("SELECT 1").get();
    if (!isDbAlive) throw new Error("DB unreachable");
    res.json({ 
       status: "ok", 
       timestamp: new Date().toISOString(),
       db: "connected",
       feeds: countRows("SELECT COUNT(*) as c FROM rss_feeds", "feeds"),
       research_papers: countRows("SELECT COUNT(*) as c FROM research_papers", "papers"),
       reference_papers: countRows("SELECT COUNT(*) as c FROM reference_papers", "refs"),
       trends: countRows("SELECT COUNT(*) as c FROM trends", "trends"),
       discoveries: countRows("SELECT COUNT(*) as c FROM discoveries", "discoveries"),
       metaphors: countRows("SELECT COUNT(*) as c FROM metaphors", "metaphors")
    });
  } catch (err: any) {
    console.error("Health check failed:", err.message);
    res.status(503).json({ status: "error", details: "Service unavailable" });
  }
});

apiRouter.post("/sync", syncLimiter, (req, res) => {
  syncRSSNews();
  res.json({ success: true, message: "Sync started" });
});

apiRouter.get("/feeds/health", (req, res) => {
  res.json({ health: getFeedHealth() });
});

/**
 * POST /api/publish — fleet ingest point.
 * Overlay365 agents (e.g. the Hemp Research & News digest) publish finished
 * articles/insights here so they flow through the Global Lens AI pipeline
 * (reframing, takeaways, backstory) like any RSS article.
 *
 * Body: { title, body, category?, source_name?, url?, image_url? }
 * Auth: Bearer <GL_PUBLISH_KEY> REQUIRED — fail-closed when unset so an
 * unconfigured deployment can never accept forged "verified research".
 * Deterministic: a stable sha256 hash over source+title+body
 * makes re-publishes idempotent (INSERT OR IGNORE).
 */
apiRouter.post("/publish", (req, res) => {
  const key = process.env.GL_PUBLISH_KEY;
  if (!key) {
    return res.status(503).json({ detail: "publish disabled: GL_PUBLISH_KEY not configured" });
  }
  const auth = String(req.headers.authorization || "");
  const expected = `Bearer ${key}`;
  const authBuf = Buffer.from(auth);
  const expBuf = Buffer.from(expected);
  if (authBuf.length !== expBuf.length || !crypto.timingSafeEqual(authBuf, expBuf)) {
    return res.status(401).json({ detail: "unauthorized" });
  }

  const { title, body, category = "global", source_name = "Overlay365", url = "", image_url = "", insights, digest, trends } = (req.body || {}) as {
    title?: string; body?: string; category?: string; source_name?: string; url?: string; image_url?: string;
    insights?: unknown; digest?: unknown; trends?: unknown;
  };
  if (!title) {
    return res.status(422).json({ detail: "title is required" });
  }

  // Compose a body when the publisher passes structured chain outputs
  // (insights/digest/trends) instead of a pre-rendered string.
  let finalBody = body;
  if (typeof finalBody !== "string" || !finalBody.trim()) {
    const sections: string[] = [];
    if (digest && typeof digest === "object" && Object.keys(digest).length) {
      sections.push(`DIGEST\n${JSON.stringify(digest, null, 2).slice(0, 4000)}`);
    }
    if (insights && typeof insights === "object" && Object.keys(insights).length) {
      sections.push(`INSIGHTS\n${JSON.stringify(insights, null, 2).slice(0, 4000)}`);
    }
    if (trends && typeof trends === "object" && Object.keys(trends).length) {
      sections.push(`TRENDS\n${JSON.stringify(trends, null, 2).slice(0, 2000)}`);
    }
    finalBody = sections.join("\n\n") || "No content.";
  }

  const urlHash = crypto.createHash("sha256").update(`${source_name}:${title}:${finalBody.slice(0, 50)}`).digest("hex");
  const pubDate = new Date().toISOString();

  const info = db.prepare(
    "INSERT OR IGNORE INTO articles (url_hash, category, source_name, original_title, original_url, image_url, original_text_dump, pub_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(urlHash, category, source_name, title.slice(0, 500), url || `global-lens://${urlHash}`, image_url, finalBody, pubDate);

  // Optional paper attachment: upsert into research_papers so the published
  // article can be linked to its source paper (idempotent on paper.id).
  const { paper } = (req.body || {}) as any;
  let paperId: string | undefined;
  if (paper && paper.title) {
    // Defense-in-depth against duplicate papers: if the publisher sends a
    // time-scoped id (e.g. "brain-{build_id}" regenerated every run), fall back
    // to a stable hash of source+title so re-publishes upsert ONE row instead
    // of inserting a duplicate. Publisher-supplied ids are used only when they
    // look stable (already a hash of content, or explicitly flagged).
    const stableId = paper.id && !/brain-[a-f0-9]{12}/i.test(String(paper.id))
      ? String(paper.id)
      : `paper-${crypto.createHash("sha256").update(`${paper.source || 'CureMind'}:${paper.title}`).digest("hex").slice(0, 24)}`;
    paperId = stableId;
    const paperInfo = db.prepare(`
      INSERT INTO research_papers (id, source, title, url, year, authors, abstract, summary, category, pillar, evidence_tier, payload, pub_date)
      VALUES (@id, @source, @title, @url, @year, @authors, @abstract, @summary, @category, @pillar, @evidence_tier, @payload, @pub_date)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, url=excluded.url, summary=excluded.summary, evidence_tier=excluded.evidence_tier, payload=excluded.payload
    `).run({
      id: stableId,
      source: 'CureMind',
      title: paper.title,
      url: paper.url || '',
      year: new Date().getFullYear(),
      authors: paper.authors || 'CureMind',
      abstract: paper.abstract || '',
      summary: paper.summary || '',
      category: paper.category || 'cancer-research',
      pillar: paper.pillar || 'science',
      evidence_tier: paper.evidence_tier || 'E1',
      payload: JSON.stringify(paper.payload || {}),
      pub_date: new Date().toISOString(),
    });
    if (paperInfo.changes > 0) console.log(`[publish] attached paper ${stableId}`);
  }

  // Oncology findings + finding-of-day (verified, signed results).
  const { findings = [], finding_of_day = [] } = (req.body || {}) as {
    findings?: any[]; finding_of_day?: { day: string; finding_id: string }[];
  };

  if (Array.isArray(findings)) {
    for (const f of findings) {
      if (!f || typeof f.headline !== "string" || !f.headline.trim()) continue; // per-row fail-soft
      const stableId = f.id && /^[a-zA-Z0-9][a-zA-Z0-9\-_]{3,127}$/.test(String(f.id))
        ? String(f.id)
        : `finding-${crypto.createHash("sha256").update(`${f.headline}:${f.metric || ""}:${f.value || ""}`).digest("hex").slice(0, 24)}`;
      upsertFinding({
        id: stableId,
        paper_id: f.paper_id || paperId,
        headline: String(f.headline),
        kind: String(f.kind || "discovery"),
        metric: f.metric,
        value: f.value,
        unit: f.unit,
        reference_claim: f.reference_claim,
        evidence_tier: f.evidence_tier,
        manifest_hash: f.manifest_hash,
        audit_signature: f.audit_signature,
        dataset: f.dataset,
        sample_size: f.sample_size,
        pub_date: f.pub_date,
        payload: f.payload,
      });
    }
  }

  if (Array.isArray(finding_of_day)) {
    for (const fod of finding_of_day) {
      if (!fod || typeof fod.day !== "string" || typeof fod.finding_id !== "string") continue;
      setFindingOfDay(fod.day, fod.finding_id);
    }
  }

  res.status(info.changes > 0 ? 201 : 200).json({
    ok: true,
    inserted: info.changes > 0,
    url_hash: urlHash,
    category,
    source_name,
    title,
  });
});
