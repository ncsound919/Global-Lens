import db from "./db";
import crypto from "crypto";

// Overlay Global Lens — comic metaphor enrichment.
// Calls the Comic Metaphor Engine (FastAPI / MCP) to frame each story as a comic
// storyline. Mirrors the existing `backstory` pattern: generated on demand and
// cached. If the engine is unreachable the endpoint degrades to an explicit
// `_unavailable` payload instead of failing the article.

function comicEngineBase(): string | null {
  const base = process.env.COMIC_ENGINE_URL;
  if (!base) return null;
  return base.trim().replace(/\/+$/, "");
}

async function fetchJson(url: string, body: any, timeoutMs = 90000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Comic engine HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export interface MetaphorPackage {
  topic: string;
  protocol_id: string | null;
  core_tension: string | null;
  mappings: any[];
  beat_structure: any[];
  codex_scores: any;
  _unavailable?: boolean;
}

function fallbackPackage(topic: string): MetaphorPackage {
  return {
    topic,
    protocol_id: null,
    core_tension: null,
    mappings: [],
    beat_structure: [],
    codex_scores: null,
    _unavailable: true,
  };
}

export function getMetaphorCached(articleId: string): MetaphorPackage | null {
  const row = db.prepare("SELECT * FROM metaphors WHERE url_hash = ? LIMIT 1").get(articleId) as any;
  if (!row) return null;
  return {
    topic: row.topic,
    protocol_id: row.protocol_id,
    core_tension: row.core_tension,
    mappings: row.mappings ? safeParse(row.mappings, []) : [],
    beat_structure: row.beat_structure ? safeParse(row.beat_structure, []) : [],
    codex_scores: row.codex_scores ? safeParse(row.codex_scores, null) : null,
  };
}

export function getMetaphorByTopic(topic: string): MetaphorPackage | null {
  const row = db.prepare("SELECT * FROM metaphors WHERE topic = ? ORDER BY created_at DESC LIMIT 1").get(topic) as any;
  if (!row) return null;
  return {
    topic: row.topic,
    protocol_id: row.protocol_id,
    core_tension: row.core_tension,
    mappings: row.mappings ? safeParse(row.mappings, []) : [],
    beat_structure: row.beat_structure ? safeParse(row.beat_structure, []) : [],
    codex_scores: row.codex_scores ? safeParse(row.codex_scores, null) : null,
  };
}

function safeParse(data: string, fallback: any): any {
  if (!data) return fallback;
  try {
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

function deriveTopicFromArticle(articleId: string): { topic: string; title: string } | null {
  const article = db.prepare(`
    SELECT a.original_title, c.reframed_headline
    FROM articles a
    LEFT JOIN article_ai_cache c ON a.url_hash = c.url_hash
    WHERE a.url_hash = ?
    LIMIT 1
  `).get(articleId) as any;
  if (!article) return null;
  const title = article.reframed_headline || article.original_title || "";
  return { topic: title, title };
}

function saveMetaphor(pkg: MetaphorPackage, articleId: string | null) {
  db.prepare(`
    INSERT OR REPLACE INTO metaphors (id, url_hash, topic, protocol_id, core_tension, mappings, beat_structure, narrative, lesson, codex_scores)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
  `).run(
    crypto.createHash("sha256").update(`${articleId || "topic"}:${pkg.topic}`).digest("hex").slice(0, 24),
    articleId,
    pkg.topic,
    pkg.protocol_id,
    pkg.core_tension,
    JSON.stringify(pkg.mappings),
    JSON.stringify(pkg.beat_structure),
    pkg.codex_scores ? JSON.stringify(pkg.codex_scores) : null,
  );
}

export async function generateMetaphorForArticle(articleId: string): Promise<{ metaphor: MetaphorPackage | null; cached: boolean }> {
  try {
    const cached = getMetaphorCached(articleId);
    if (cached) return { metaphor: cached, cached: true };

    const derived = deriveTopicFromArticle(articleId);
    if (!derived) return { metaphor: null, cached: false };

    const base = comicEngineBase();
    if (!base) return { metaphor: fallbackPackage(derived.topic), cached: false };

    const mapping = await fetchJson(`${base}/api/map`, {
      topic: derived.topic,
      format: "blog_post",
      tone: "inspirational",
      top_k: 5,
    });
    const pkg = packageFromMapping(mapping, derived.topic);
    if (!pkg.protocol_id) return { metaphor: fallbackPackage(derived.topic), cached: false };
    saveMetaphor(pkg, articleId);
    return { metaphor: pkg, cached: false };
  } catch (e: any) {
    console.warn(`[metaphor] Engine unavailable for ${articleId}: ${e?.message}`);
    const topic = safeTopicForArticle(articleId);
    return { metaphor: fallbackPackage(topic), cached: false };
  }
}

export async function generateMetaphorForTopic(topic: string): Promise<{ metaphor: MetaphorPackage; cached: boolean }> {
  try {
    const cached = getMetaphorByTopic(topic);
    if (cached) return { metaphor: cached, cached: true };

    const base = comicEngineBase();
    if (!base) return { metaphor: fallbackPackage(topic), cached: false };

    const mapping = await fetchJson(`${base}/api/map`, {
      topic,
      format: "blog_post",
      tone: "inspirational",
      top_k: 5,
    });
    const pkg = packageFromMapping(mapping, topic);
    if (!pkg.protocol_id) return { metaphor: fallbackPackage(topic), cached: false };
    saveMetaphor(pkg, null);
    return { metaphor: pkg, cached: false };
  } catch (e: any) {
    console.warn(`[metaphor] Engine unavailable for topic "${topic}": ${e?.message}`);
    return { metaphor: fallbackPackage(topic), cached: false };
  }
}

function safeTopicForArticle(articleId: string): string {
  try {
    const derived = deriveTopicFromArticle(articleId);
    return derived?.topic || "Untitled story";
  } catch {
    return "Untitled story";
  }
}

function packageFromMapping(mapping: any, topic: string): MetaphorPackage {
  const scores = {
    trueness: mapping?.trueness_score ?? null,
    flow: mapping?.flow_score ?? null,
    pcs: mapping?.pcs_score ?? null,
    overall_fit: mapping?.overall_fit ?? null,
    tap: mapping?.tap_score ?? null,
    tap_weights: mapping?.tap_weights ?? null,
  };
  return {
    topic,
    protocol_id: mapping?.protocol_id || null,
    core_tension: mapping?.core_tension || null,
    mappings: Array.isArray(mapping?.mappings) ? mapping.mappings : [],
    beat_structure: Array.isArray(mapping?.beat_structure) ? mapping.beat_structure : [],
    codex_scores: scores,
  };
}