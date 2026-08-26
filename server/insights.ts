import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import db from "./db.js";
import { syncResearchPapers } from "./research.js";
import { syncTrendsAndDiscoveries } from "./trends.js";
import { syncDomainResearchWithEditorial } from "./domainResearch.js";
import { scienceValidationFindings } from "./scienceIngest.js";
import { synthesizeResearchPapers } from "./researchSynthesis.js";
import { syncCrossDomainSignals } from "./crossDomain.js";
import { generateMetaphorForArticle, generateMetaphorForTopic } from "./metaphors.js";

export const insightsRouter = express.Router();

const metaphorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 15 : 500,
  message: { detail: "Too many metaphor generations. Please try again later." },
  validate: { xForwardedForHeader: false },
});

const syncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 2,
  message: { detail: "Too many sync requests. Please try again later." },
  validate: { xForwardedForHeader: false },
});

const PapersQuerySchema = z.object({
  category: z.string().optional(),
  pillar: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).catch(20),
  offset: z.coerce.number().min(0).catch(0),
});

const TrendsQuerySchema = z.object({
  direction: z.string().optional(),
  evidence_tier: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).catch(20),
  offset: z.coerce.number().min(0).catch(0),
});

const DiscoveriesQuerySchema = z.object({
  evidence_tier: z.string().optional(),
  source: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).catch(20),
  offset: z.coerce.number().min(0).catch(0),
});

insightsRouter.get("/papers", async (req, res) => {
  const q = PapersQuerySchema.parse(req.query);
  const clauses: string[] = [];
  const params: any[] = [];
  if (q.category) { clauses.push("category = ?"); params.push(q.category); }
  if (q.pillar) { clauses.push("pillar = ?"); params.push(q.pillar); }
  // research_papers holds ONLY Overlay's own research â€” the OpenAlex/PubMed
  // reference pool lives in a separate `reference_papers` table and is never
  // surfaced here. No source filter needed.
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(q.limit, q.offset);

  const papers = await db.prepare(`
    SELECT * FROM research_papers
    ${where}
    ORDER BY COALESCE(pub_date, created_at) DESC LIMIT ? OFFSET ?
  `).all(...params) as any[];

  const total = (await db.prepare(`SELECT COUNT(*) as c FROM research_papers ${where}`).get(...params.slice(0, -2)) as any)?.c || 0;

  const out = papers.map((p) => ({
    id: p.id,
    source: p.source,
    title: p.title,
    url: p.url,
    year: p.year,
    authors: p.authors,
    abstract: p.abstract,
    summary: summarize(p),
    category: p.category,
    pillar: p.pillar,
    evidence_tier: p.evidence_tier,
    payload: safeParse(p.payload, null),
    pub_date: p.pub_date,
  }));

  res.json({ papers: out, total });
});

/**
 * Surface a real summary for a paper. Many ingested papers carry only an
 * abstract (the ecosystem digest is the exception), so fall back from a stored
 * summary -> abstract -> title, and never return an empty shell. This keeps
 * the outlet's papers readable and the content-depth signal honest.
 */
function summarize(p: any): string {
  const candidate = (v: unknown) => typeof v === "string" && v.trim().length > 20;
  const pick = (v: unknown) => (candidate(v) ? (v as string).trim() : "");
  const s = pick(p.summary) || pick(p.abstract);
  if (s) return s.slice(0, 1000);
  const title = typeof p.title === "string" && p.title.trim() ? p.title.trim() : "Untitled";
  return title.slice(0, 200);
}

insightsRouter.get("/trends", async (req, res) => {
  const q = TrendsQuerySchema.parse(req.query);
  const clauses: string[] = [];
  const params: any[] = [];
  if (q.direction) { clauses.push("direction = ?"); params.push(q.direction); }
  if (q.evidence_tier) { clauses.push("evidence_tier = ?"); params.push(q.evidence_tier); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(q.limit, q.offset);

  const trends = await db.prepare(`
    SELECT * FROM trends
    ${where}
    ORDER BY COALESCE(pub_date, created_at) DESC LIMIT ? OFFSET ?
  `).all(...params) as any[];

  const total = (await db.prepare(`SELECT COUNT(*) as c FROM trends ${where}`).get(...params.slice(0, -2)) as any)?.c || 0;

  res.json({
    trends: trends.map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary,
      direction: t.direction,
      slope: t.slope,
      confidence: t.confidence,
      evidence_tier: t.evidence_tier,
      recommended_action: t.recommended_action,
      source: t.source,
      category: t.category,
      pub_date: t.pub_date,
    })),
    total,
  });
});

insightsRouter.get("/discoveries", async (req, res) => {
  const q = DiscoveriesQuerySchema.parse(req.query);
  const clauses: string[] = [];
  const params: any[] = [];
  if (q.evidence_tier) { clauses.push("evidence_tier = ?"); params.push(q.evidence_tier); }
  if (q.source) { clauses.push("source = ?"); params.push(q.source); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(q.limit, q.offset);

  const discoveries = await db.prepare(`
    SELECT * FROM discoveries
    ${where}
    ORDER BY COALESCE(pub_date, created_at) DESC LIMIT ? OFFSET ?
  `).all(...params) as any[];

  const total = (await db.prepare(`SELECT COUNT(*) as c FROM discoveries ${where}`).get(...params.slice(0, -2)) as any)?.c || 0;

  res.json({
    discoveries: discoveries.map((d) => ({
      id: d.id,
      title: d.title,
      insight: d.insight,
      evidence_tier: d.evidence_tier,
      source: d.source,
      category: d.category,
      pub_date: d.pub_date,
    })),
    total,
  });
});

insightsRouter.get("/insights/feed", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  // research_papers = Overlay's own research only; reference pool is separate.
  const papers = await db.prepare(`
    SELECT 'paper' as type, id, title, summary, COALESCE(pub_date, created_at) as pub_date, pillar as item_group, url as link, evidence_tier
    FROM research_papers
    ORDER BY COALESCE(pub_date, created_at) DESC LIMIT ?
  `).all(limit) as any[];

  const trends = await db.prepare(`
    SELECT 'trend' as type, id, title, summary, COALESCE(pub_date, created_at) as pub_date, category as item_group, NULL as link, evidence_tier
    FROM trends ORDER BY COALESCE(pub_date, created_at) DESC LIMIT ?
  `).all(limit) as any[];

  const discoveries = await db.prepare(`
    SELECT 'discovery' as type, id, title, insight as summary, COALESCE(pub_date, created_at) as pub_date, category as item_group, NULL as link, evidence_tier
    FROM discoveries ORDER BY COALESCE(pub_date, created_at) DESC LIMIT ?
  `).all(limit) as any[];

  const items = [...papers, ...trends, ...discoveries]
    .sort((a, b) => new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime())
    .slice(0, limit);

  res.json({ items, total: items.length });
});

insightsRouter.get("/metaphors/:articleId", metaphorLimiter, async (req, res) => {
  const articleId = req.params.articleId;
  if (!articleId || articleId.length < 8 || articleId.length > 1024) {
    return res.status(400).json({ detail: "Invalid article ID" });
  }
  const { metaphor, cached } = await generateMetaphorForArticle(articleId);
  if (!metaphor) return res.status(404).json({ detail: "Article not found" });
  res.json({ metaphor, cached });
});

insightsRouter.post("/metaphors/topic", metaphorLimiter, async (req, res) => {
  const topic = String(req.body?.topic || "").trim().slice(0, 500);
  if (!topic) return res.status(400).json({ detail: "topic is required" });
  const { metaphor, cached } = await generateMetaphorForTopic(topic);
  res.json({ metaphor, cached });
});

insightsRouter.post("/sync/research", syncLimiter, (req, res) => {
  const result = syncResearchPapers();
  res.json({ success: true, ...result });
});

insightsRouter.post("/sync/trends", syncLimiter, (req, res) => {
  const result = syncTrendsAndDiscoveries();
  res.json({ success: true, ...result });
});

insightsRouter.post("/sync/domain", syncLimiter, async (req, res) => {
  try {
    const { sync, editorial } = await syncDomainResearchWithEditorial();
    res.json({ success: true, ...sync, editorial_articles: editorial });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Ingest just the science validation findings (validation ledger, gap-domain
// scan, golf onco correlations) into the outlet's discoveries/trends/papers.
// Runs as part of the full domain sync; exposed separately so operators can
// verify the ingest surface independently.
insightsRouter.post("/sync/science", syncLimiter, async (req, res) => {
  try {
    const findings = await scienceValidationFindings();
    res.json({ success: true, findings: findings.length, sample: findings.slice(0, 3).map((f) => ({ title: f.title, category: f.category, pillar: f.pillar })) });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Bundle the science research programs into definitive papers: cluster the
// data, re-run it through the Overlay Science engines, and synthesize one full
// paper per cluster from our own measured outputs.
insightsRouter.post("/sync/synthesis", syncLimiter, async (req, res) => {
  try {
    const result = await synthesizeResearchPapers();
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Detect cross-domain signals across the whole ecosystem (all pillars): domain
// state, translation bridges, coupled domains and operational cross-impact.
insightsRouter.post("/sync/cross-domain", syncLimiter, async (req, res) => {
  try {
    const result = await syncCrossDomainSignals();
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

function safeParse(data: string, fallback: any): any {
  if (!data) return fallback;
  try {
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}