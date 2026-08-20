import fs from "fs";
import path from "path";
import crypto from "crypto";
import db from "./db";

// Overlay Global Lens — research papers ingestion.
// Reads research papers produced by the ecosystem (Draymond research-papers.json)
// from a local ingest dir, a Draymond checkout, or an HTTP endpoint. Never the
// source of truth for research state: the outlet is a reader.
//
// IMPORTANT (public-outlet rule): the ecosystem's research-papers.json mirrors
// ESTABLISHED literature (OpenAlex/PubMed). We do NOT republish others' work.
// Those rows land in the `reference_papers` table — a reference pool used ONLY
// to cross-reference OUR conclusions. `research_papers` holds Overlay's own
// research exclusively and is what the publication surfaces.

const GOAL_TO_PILLAR: Record<string, string> = {
  biotech: "science",
  sports: "sport",
  finance: "wealth",
  music: "music",
  writing: "writing",
  justice: "justice",
  health: "health",
};

export function pillarForGoal(goalKey: string): string {
  const prefix = (goalKey || "").split("-")[0].toLowerCase();
  return GOAL_TO_PILLAR[prefix] || "research";
}

function ingestDir(): string {
  return process.env.OVERLAY_INGEST_DIR || path.join(process.cwd(), "data", "ingest");
}

function draymondDir(): string {
  return process.env.DRAPMOND_DIR || path.resolve(process.cwd(), "..", "Draymond-Orchestrator");
}

function candidateFiles(): string[] {
  return [
    path.join(ingestDir(), "research-papers.json"),
    path.join(draymondDir(), ".draymond", "research-papers.json"),
  ].filter((p) => fs.existsSync(p));
}

function loadResearchDoc(): { doc: any; source: string } | null {
  for (const file of candidateFiles()) {
    try {
      const doc = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (doc && doc.papers) return { doc, source: `file:${file}` };
    } catch (e: any) {
      console.warn(`[research] Could not parse ${file}: ${e.message}`);
    }
  }
  return null;
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.DRAPMOND_API_KEY;
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadResearchDocHttp(): Promise<{ doc: any; source: string } | null> {
  const httpBase = process.env.DRAPMOND_URL;
  if (!httpBase) return null;
  try {
    const url = `${httpBase.replace(/\/$/, "")}/api/research/papers`;
    const doc = await fetchWithTimeout(url);
    if (doc && (doc as any).papers) return { doc, source: url };
  } catch (e: any) {
    console.warn(`[research] HTTP source unavailable: ${e.message}`);
  }
  return null;
}

function extractDoi(url: string): string {
  if (!url) return "";
  const m = url.match(/doi\.org\/(.+)/i);
  return m ? m[1].trim() : "";
}

const upsertPaper = db.prepare(`
  INSERT INTO reference_papers (id, source, title, url, year, authors, abstract, summary, category, pillar, evidence_tier, payload, pub_date)
  VALUES (@id, @source, @title, @url, @year, @authors, @abstract, @summary, @category, @pillar, @evidence_tier, @payload, @pub_date)
  ON CONFLICT(id) DO UPDATE SET
    source = excluded.source,
    title = excluded.title,
    url = excluded.url,
    year = excluded.year,
    authors = excluded.authors,
    abstract = excluded.abstract,
    summary = excluded.summary,
    category = excluded.category,
    pillar = excluded.pillar,
    evidence_tier = 'REF',
    payload = excluded.payload,
    pub_date = excluded.pub_date
`);

export function syncResearchPapers(): { inserted: number; updated: number; total: number; source: string | null } {
  const loaded = loadResearchDoc();
  if (!loaded) return { inserted: 0, updated: 0, total: 0, source: null };

  const { doc, source } = loaded;
  let inserted = 0;
  let updated = 0;
  const nowIso = new Date().toISOString();

  const papersByGoal: Record<string, any[]> = doc.papers || {};
  for (const [goalKey, papers] of Object.entries(papersByGoal)) {
    if (!Array.isArray(papers)) continue;
    const pillar = pillarForGoal(goalKey);
    for (const p of papers) {
      if (!p || !p.title) continue;
      const id = p.id || p.url || crypto.createHash("sha256").update(`${goalKey}:${p.title}`).digest("hex");
      const doi = extractDoi(p.url || "");
      const pubDate = p.year ? `${p.year}-01-01T00:00:00.000Z` : nowIso;
      const info = upsertPaper.run({
        id,
        source: p.source || "openalex",
        title: String(p.title || "Untitled"),
        url: p.url || "",
        year: p.year || null,
        authors: Array.isArray(p.authors) ? p.authors.join(", ") : String(p.authors || ""),
        abstract: p.abstract || "",
        summary: p.summary || "",
        category: goalKey,
        pillar,
        evidence_tier: 'REF',
        payload: JSON.stringify({ doi, ...p }),
        pub_date: pubDate,
      });
      if (info.changes > 0) {
        if (info.changes === 2) updated++;
        else inserted++;
      }
    }
  }

  return { inserted, updated, total: inserted + updated, source };
}

export function getPaperStats() {
  const count = db.prepare("SELECT COUNT(*) as c FROM research_papers").get() as any;
  const byPillar = db.prepare("SELECT pillar, COUNT(*) as c FROM research_papers GROUP BY pillar").all() as any[];
  const refCount = db.prepare("SELECT COUNT(*) as c FROM reference_papers").get() as any;
  return { count: count?.c || 0, referenceCount: refCount?.c || 0, byPillar };
}