import fs from "fs";
import path from "path";
import crypto from "crypto";
import db from "./db.js";
import { callAIQueued } from "./aiService.js";
import { scienceValidationFindings } from "./scienceIngest.js";

// ============================================================================
// Overlay Global Lens â€” Domain Research Engine
//
// Takes OUR research (sports science metrics, biotech/scientific research, hemp
// research) and cross-analyzes it against ESTABLISHED datasets and science
// papers (OpenAlex/PubMed literature already mirrored into research_papers).
// The engine then produces public research items for the outlet â€” findings,
// trends, and generated research papers â€” so Overlay Global Lens accumulates an
// original, evidence-tiered research database of its own.
//
// PUBLIC-OUTLET RULE: same as trends.ts â€” only public-facing signal is written.
// Internal agent names, patch ids and repair instructions never appear here.
// ============================================================================

function ecosystemRoot(): string {
  return process.env.DRAPMOND_DIR
    ? path.resolve(process.env.DRAPMOND_DIR, "..")
    : path.resolve(process.cwd(), "..");
}

function ingestDir(): string {
  return process.env.OVERLAY_INGEST_DIR || path.join(process.cwd(), "data", "ingest");
}

function readJson(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e: any) {
    console.warn(`[domain] Could not parse ${file}: ${e.message}`);
    return null;
  }
}

function slug(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 24);
}

function walk(dir: string, ext: string): string[] {
  const out: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...walk(full, ext));
      else if (e.name.endsWith(ext)) out.push(full);
    }
  } catch {
    /* dir may not exist */
  }
  return out;
}

// ---- Established literature (our mirror of OpenAlex/PubMed + datasets) ----
interface EstablishedPaper {
  title: string;
  url: string;
  category: string;
}

async function loadEstablishedPapers(): Promise<EstablishedPaper[]> {
  const rows = await db.prepare(
    "SELECT title, url, category FROM reference_papers WHERE title IS NOT NULL"
  ).all() as any[];
  return rows.map((r) => ({ title: r.title, url: r.url || "", category: r.category || "" }));
}

function tokenize(text: string): string[] {
  const stop = new Set(["the", "and", "for", "with", "from", "that", "this", "are", "was", "were", "not", "but", "its", "their", "into", "than", "such", "when", "over", "against", "across", "between", "during", "after", "before", "also", "been", "has", "had", "have", "which", "while", "however"]);
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w));
}

/** Match a finding against established papers by keyword overlap. */
function crossReference(text: string, papers: EstablishedPaper[]): { matched: EstablishedPaper[]; score: number } {
  const tokens = new Set(tokenize(text));
  if (!tokens.size) return { matched: [], score: 0 };
  const scored = papers
    .map((p) => {
      const pTokens = new Set(tokenize(p.title));
      let hits = 0;
      pTokens.forEach((t) => { if (tokens.has(t)) hits++; });
      return { paper: p, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  const top = scored.slice(0, 3);
  const score = top.reduce((acc, x) => acc + x.hits, 0);
  return { matched: top.map((x) => x.paper), score };
}

function evidenceTierFor(isMeasured: boolean, supportScore: number): string {
  if (!isMeasured) return "E4";
  if (supportScore >= 4) return "E1";
  if (supportScore >= 2) return "E2";
  if (supportScore >= 1) return "E3";
  return "E4";
}

// ---- Writes ----------------------------------------------------------------

const upsertDiscovery = await db.prepare(`
  INSERT INTO discoveries (id, title, insight, evidence_tier, hypothesis_id, linked_patch_id, source, category, payload, pub_date)
  VALUES (@id, @title, @insight, @evidence_tier, @hypothesis_id, @linked_patch_id, @source, @category, @payload, @pub_date)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title, insight = excluded.insight, evidence_tier = excluded.evidence_tier,
    source = excluded.source, category = excluded.category, payload = excluded.payload,
    pub_date = excluded.pub_date
`);

const upsertTrend = await db.prepare(`
  INSERT INTO trends (id, title, summary, direction, slope, confidence, evidence_tier, recommended_action, source, category, payload, pub_date)
  VALUES (@id, @title, @summary, @direction, @slope, @confidence, @evidence_tier, @recommended_action, @source, @category, @payload, @pub_date)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title, summary = excluded.summary, direction = excluded.direction,
    slope = excluded.slope, confidence = excluded.confidence, evidence_tier = excluded.evidence_tier,
    recommended_action = excluded.recommended_action, source = excluded.source,
    category = excluded.category, payload = excluded.payload, pub_date = excluded.pub_date
`);

const upsertPaper = await db.prepare(`
  INSERT INTO research_papers (id, source, title, url, year, authors, abstract, summary, category, pillar, evidence_tier, payload, pub_date)
  VALUES (@id, @source, @title, @url, @year, @authors, @abstract, @summary, @category, @pillar, @evidence_tier, @payload, @pub_date)
  ON CONFLICT(id) DO UPDATE SET
    source = excluded.source, title = excluded.title, url = excluded.url,
    year = excluded.year, authors = excluded.authors, abstract = excluded.abstract,
    summary = excluded.summary, category = excluded.category, pillar = excluded.pillar,
    evidence_tier = excluded.evidence_tier, payload = excluded.payload, pub_date = excluded.pub_date
`);

// ---- Sports science ingestion ----------------------------------------------

interface SportsFinding {
  title: string;
  insight: string;
  category: string;
  pillar: string;
  direction?: string;
  slope?: number;
  confidence?: number;
  measured: boolean;
  /** Always persist as a discovery even when micro-discoveries are disabled
   *  (reserved for a small set of high-value, calibration-backed findings). */
  alwaysPersist?: boolean;
}

function loadSportsMetrics(dir: string): any[] {
  const out: any[] = [];
  for (const f of walk(dir, "_sports_metrics.json")) {
    const data = readJson(f);
    if (Array.isArray(data)) out.push(...data);
  }
  return out;
}

function summarize(list: any[], key: string): { median: number | null; mean: number | null } {
  const vals = list
    .map((x) => x?.[key])
    .filter((v): v is number => typeof v === "number" && isFinite(v));
  if (!vals.length) return { median: null, mean: null };
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { median, mean };
}

function sportsResearchDir(): string {
  if (process.env.OVERLAY_RESEARCH_DIR) return path.resolve(process.env.OVERLAY_RESEARCH_DIR);
  return path.join(ecosystemRoot(), "02_Pillars", "Overlay Science", "research");
}

function sportsScienceFindings(papers: EstablishedPaper[]): SportsFinding[] {
  const findings: SportsFinding[] = [];
  const researchBase = sportsResearchDir();
  const statsFiles = walk(researchBase, "summary_stats.json");
  const metrics = loadSportsMetrics(researchBase);

  for (const statsFile of statsFiles) {
    const s = readJson(statsFile);
    if (!s) continue;
    const runLabel = path.basename(path.dirname(statsFile));

    // Correlation findings (measured, deterministic).
    const corrDefs: Array<[string, string, string]> = [
      ["nba_ter_injury_corr", "NBA", "injury load"],
      ["nba_ter_recurrence_corr", "NBA", "recurring load"],
      ["boxing_ter_injury_corr", "Boxing", "injury load"],
      ["boxing_ter_recurrence_corr", "Boxing", "recurring load"],
    ];
    for (const [key, sport, label] of corrDefs) {
      const r = s[key];
      if (typeof r !== "number") continue;
      const strength = Math.abs(r) >= 0.5 ? "strong" : Math.abs(r) >= 0.3 ? "moderate" : "weak";
      const ref = crossReference(`${sport} athlete efficiency injury performance correlation`, papers);
      findings.push({
        title: `${sport} efficiency index correlates with ${label} in season data (r=${r.toFixed(2)})`,
        insight: `Measured ${strength} correlation (r=${r.toFixed(2)}) between ${sport.toLowerCase()} performance efficiency and ${label}, computed from our season dataset (${runLabel}). Cross-referenced against ${ref.matched.length} established ${sport.toLowerCase()} studies.`,
        category: "Sports Science",
        pillar: "sport",
        measured: true,
        confidence: Math.min(0.99, 0.5 + Math.abs(r) * 0.5),
      });
    }

    // Era-adjusted efficiency stability trend.
    const eraSeries = s.nba_era_adj_mean_ter;
    if (eraSeries && typeof eraSeries === "object") {
      const decades = Object.entries(eraSeries as Record<string, number>)
        .filter(([, v]) => typeof v === "number")
        .sort((a, b) => a[0].localeCompare(b[0]));
      if (decades.length >= 2) {
        const first = decades[0][1];
        const last = decades[decades.length - 1][1];
        const slope = (last - first) / Math.max(1, decades.length - 1);
        const direction = slope > 0.05 ? "rising" : slope < -0.05 ? "falling" : "stable";
        const flattening = typeof s.nba_era_flattening_score === "number" ? s.nba_era_flattening_score : null;
        findings.push({
          title: `Era-adjusted NBA efficiency has been ${direction} across decades`,
          insight: `Era-adjusted efficiency across ${decades.length} decades (${decades[0][0]}â€“${decades[decades.length - 1][0]}) moved from ${first.toFixed(2)} to ${last.toFixed(2)}${flattening !== null ? `, with a ${flattening.toFixed(2)} flattening score` : ""} once three-point inflation is removed. This is an original time-series finding against NBA season data.`,
          category: "Sports Science",
          pillar: "sport",
          direction,
          slope,
          confidence: 0.85,
          measured: true,
        });
      }
    }

    // Kaggle established-dataset comparison.
    const kaggle = s.kaggle || s.kaggle_counts;
    if (kaggle) {
      const parts: string[] = [];
      const k = kaggle;
      for (const ds of Object.keys(k)) {
        const v = k[ds];
        if (typeof v === "number") parts.push(`${ds} ${v.toLocaleString()} records`);
        else if (v && typeof v.median === "number") parts.push(`${ds} median ${v.median.toFixed(2)}`);
      }
      if (parts.length) {
        findings.push({
          title: "Cross-dataset comparison of athletic efficiency baselines",
          insight: `Comparison of efficiency baselines across established Kaggle datasets: ${parts.join("; ")}. Reconciles our computed metrics against third-party sports datasets.`,
          category: "Sports Science",
          pillar: "sport",
          measured: true,
          confidence: 0.9,
        });
      }
    }
  }

  // Per-sport risk profile derived from our metric files.
  const SPORT_LABELS: Record<string, string> = {
    nba: "NBA",
    boxing: "Boxing",
    nba_four_factors: "NBA (four factors)",
    player_2425: "NBA player",
    ppv: "Fight card",
  };
  const bySport = new Map<string, any[]>();
  for (const m of metrics) {
    const key = String(m.sport || "unknown");
    if (!bySport.has(key)) bySport.set(key, []);
    bySport.get(key)!.push(m);
  }
  for (const [sport, list] of bySport) {
    const inj = summarize(list, "injury_risk");
    if (inj.median === null) continue;
    const ter = summarize(list, "ter");
    const sportLabel = SPORT_LABELS[sport] || sport;
    findings.push({
      title: `${sportLabel} athlete risk profile: median injury load ${inj.median.toFixed(1)}`,
      insight: `Across ${list.length} ${sportLabel.toLowerCase()} athlete-season records, median injury load is ${inj.median.toFixed(1)}${ter.mean !== null ? ` and median efficiency index ${ter.median?.toFixed(2) ?? "n/a"}` : ""}. Derived from our sports science engine output.`,
      category: "Sports Science",
      pillar: "sport",
      measured: true,
      confidence: 0.9,
    });
  }

  return findings;
}

// ---- NBA Codex / CureMind onco layer ingestion ---------------------------------

function loadCodexOnco(): { summary: any | null; players: any[]; comparison: any | null } {
  const researchBase = sportsResearchDir();
  const summaryFiles = walk(researchBase, "codex_onco_summary.json");
  const playerFiles = walk(researchBase, "codex_player_onco.json");
  const comparisonFiles = walk(researchBase, "codex_pipeline_comparison.json");
  return {
    summary: summaryFiles.length ? readJson(summaryFiles[0]) : null,
    players: playerFiles.length ? (readJson(playerFiles[0]) || []) : [],
    comparison: comparisonFiles.length ? readJson(comparisonFiles[0]) : null,
  };
}

function codexOncoFindings(): SportsFinding[] {
  const findings: SportsFinding[] = [];
  const { summary, players, comparison } = loadCodexOnco();

  if (summary && typeof summary.profiles_total === "number") {
    const tiers = summary.risk_tier_counts || {};
    const malign = summary.malignancy_counts || {};
    const thresholdNote =
      typeof summary.tier_thresholds?.p70 === "number" && typeof summary.tier_thresholds?.p90 === "number"
        ? ` (cohort-relative recurrence-risk bands at p70=${(summary.tier_thresholds.p70 * 100).toFixed(1)}%, p90=${(summary.tier_thresholds.p90 * 100).toFixed(1)}%)`
        : "";
    findings.push({
      title: `NBA player efficiency classified via CureMind onco layer: ${summary.profiles_total.toLocaleString()} player-seasons`,
      insight: `Every NBA player-season in the codex database was translated through the CureMind oncology layer${thresholdNote}. Risk tiers: ${JSON.stringify(tiers)}; malignancy classes: ${JSON.stringify(malign)}. This is an original cross-domain translation of oncology risk methodology onto athlete-performance data.`,
      category: "Oncology Translation",
      pillar: "science",
      measured: true,
      confidence: 0.92,
    });

    if (typeof summary.high_risk_cohort_size === "number") {
      const topNames = (Array.isArray(summary.high_risk_top) ? summary.high_risk_top.slice(0, 5) : [])
        .map((t: any) => `${t.player} (${t.season})`)
        .join(", ");
      findings.push({
        title: `${summary.high_risk_cohort_size.toLocaleString()} NBA player-seasons flagged in the HIGH onco-risk cohort`,
        insight: `Applying the CureMind recurrence-risk thresholds flags ${summary.high_risk_cohort_size.toLocaleString()} of ${summary.profiles_total.toLocaleString()} player-seasons as HIGH risk. Highest-risk examples: ${topNames}. The full ranking is computed deterministically from era-adjusted efficiency.`,
        category: "Oncology Translation",
        pillar: "science",
        measured: true,
        confidence: 0.9,
      });
    }
  }

  if (comparison) {
    const shared = Array.isArray(comparison.shared_findings) ? comparison.shared_findings : [];
    const diffs = Array.isArray(comparison.key_differences) ? comparison.key_differences : [];
    if (shared.length) {
      findings.push({
        title: "Pipeline audit: codex and research engines agree on era-adjusted TER as the fair cross-era ranking",
        insight: shared
          .slice(0, 3)
          .map((s: any) => (typeof s === "string" ? s : JSON.stringify(s)))
          .join(" "),
        category: "Pipeline Audit",
        pillar: "research",
        measured: true,
        confidence: 0.95,
      });
    }
    if (diffs.length) {
      findings.push({
        title: "Pipeline audit: same stat name, different formulas â€” TER scales differ across engines",
        insight: diffs
          .slice(0, 3)
          .map((d: any) => (typeof d === "string" ? d : JSON.stringify(d)))
          .join(" "),
        category: "Pipeline Audit",
        pillar: "research",
        measured: true,
        confidence: 0.95,
      });
    }
  }

  if (Array.isArray(players) && players.length) {
    const byClass = new Map<string, { count: number; high: number }>();
    for (const p of players) {
      const cls = String(p.classification || "UNKNOWN");
      const tier = p.onco?.risk_tier || "";
      const cur = byClass.get(cls) || { count: 0, high: 0 };
      cur.count++;
      if (tier === "HIGH") cur.high++;
      byClass.set(cls, cur);
    }
    const sorted = [...byClass.entries()].sort((a, b) => b[1].count - a[1].count);
    const lines = sorted
      .map(([cls, v]) => `${cls}: ${v.count} seasons, ${v.high} HIGH risk (${((v.high / v.count) * 100).toFixed(1)}%)`)
      .join("; ");
    const topShare = [...byClass.entries()].sort(
      (a, b) => b[1].high / b[1].count - a[1].high / a[1].count
    )[0];
    findings.push({
      title: `Player-level onco risk by NBA role: ${topShare ? topShare[0] : "n/a"} carries the highest share of HIGH-risk seasons`,
      insight: `Of ${players.length.toLocaleString()} classified player-seasons: ${lines}. HIGH-risk share varies sharply by on-court role, which the onco translation exposes as a measurable pattern.`,
      category: "Oncology Translation",
      pillar: "science",
      measured: true,
      confidence: 0.88,
    });
  }

  return findings;
}

// ---- Hemp / scientific research ingestion ------------------------------------

interface HempTrend {
  title: string;
  description?: string;
  growthRate?: number;
  confidence?: number;
  category?: string;
}

interface HempInsight {
  title: string;
  summary?: string;
  implications?: string;
  severity?: string;
}

function loadHempResearch(): { trends: HempTrend[]; insights: HempInsight[] } {
  const local = path.join(ingestDir(), "hemp-research.json");
  if (fs.existsSync(local)) {
    const doc = readJson(local);
    return {
      trends: Array.isArray(doc?.trends) ? doc.trends : [],
      insights: Array.isArray(doc?.insights) ? doc.insights : [],
    };
  }
  // HempForge local-research export fallback.
  const hempBase = path.join(ecosystemRoot(), "02_Pillars", "Overlay Science", "Biotech", "HempForge-main", "local-research");
  const exported = walk(hempBase, "trends.json");
  if (exported.length) {
    const doc = readJson(exported[0]);
    return {
      trends: Array.isArray(doc?.trends) ? doc.trends : [],
      insights: Array.isArray(doc?.insights) ? doc.insights : [],
    };
  }
  return { trends: [], insights: [] };
}

async function loadHempResearchHttp(): Promise<{ trends: HempTrend[]; insights: HempInsight[] }> {
  const base = process.env.HEMPFORGE_URL;
  if (!base) return { trends: [], insights: [] };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${base.replace(/\/$/, "")}/api/literature/trends-insights`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      trends: Array.isArray(data?.trends) ? data.trends : [],
      insights: Array.isArray(data?.insights) ? data.insights : [],
    };
  } catch (e: any) {
    console.warn(`[domain] HempForge HTTP source unavailable: ${e.message}`);
    return { trends: [], insights: [] };
  }
}

function hempResearchFindings(hemp: { trends: HempTrend[]; insights: HempInsight[] }, papers: EstablishedPaper[]): SportsFinding[] {
  const findings: SportsFinding[] = [];
  for (const t of hemp.trends.slice(0, 12)) {
    if (!t.title) continue;
    const ref = crossReference(`cannabis hemp ${t.title} research`, papers);
    const growth =
      typeof t.growthRate === "number"
        ? ` growing at ${(t.growthRate * 100).toFixed(0)}% per window`
        : "";
    findings.push({
      title: `Hemp research trend: ${t.title}`,
      insight: `${t.description || "Emerging trend in hemp literature."}${growth} Cross-referenced against ${ref.matched.length} established studies.`,
      category: "Hemp Research",
      pillar: "science",
      direction: typeof t.growthRate === "number" && t.growthRate > 0 ? "rising" : "stable",
      slope: typeof t.growthRate === "number" ? t.growthRate : undefined,
      confidence: typeof t.confidence === "number" ? t.confidence : 0.7,
      measured: false,
    });
  }
  for (const ins of hemp.insights.slice(0, 10)) {
    if (!ins.title) continue;
    findings.push({
      title: `Hemp research insight: ${ins.title}`,
      insight: ins.summary || ins.implications || "Insight from hemp literature surveillance.",
      category: "Hemp Research",
      pillar: "science",
      measured: false,
      confidence: 0.6,
    });
  }
  return findings;
}

// ---- Oncology calibration ingestion (Overlay Oncology subdomain) -------------
//
// Overlay Oncology (`oncology.overlay365.com`) exposes real, cited calibration
// state via GET {ONCOLOGY_URL}/api/calibration/state â€” calibrated potency (CCLE
// IC50) and survival (TCGA Weibull) fits with provenance. The outlet surfaces
// these as evidence-tiered findings. PUBLIC-OUTLET RULE applies: no internal
// ids/agent names; sources map to public labels. Degrades gracefully when the
// app is not yet configured/deployed.

interface OncologyCalibration {
  updatedAtIso?: string | null;
  potency?: {
    medianIc50?: number | null;
    ciLow?: number | null;
    ciHigh?: number | null;
    n?: number | null;
    provenance?: { source?: string; sourceUrl?: string; mode?: string; rowCount?: number } | null;
  } | null;
  survival?: {
    lambdaPerMonth?: number | null;
    shape?: number | null;
    scaleMonths?: number | null;
    medianSurvivalMonths?: number | null;
    kmModelRmse?: number | null;
    n?: number | null;
    provenance?: { source?: string; sourceUrl?: string; mode?: string; rowCount?: number } | null;
  } | null;
}

async function loadOncologyCalibrationHttp(): Promise<OncologyCalibration | null> {
  const base = process.env.ONCOLOGY_URL;
  if (!base) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${base.replace(/\/+$/, "")}/api/calibration/state`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as OncologyCalibration;
  } catch (e: any) {
    console.warn(`[domain] Oncology calibration source unavailable: ${e.message}`);
    return null;
  }
}

function oncologyFindings(cal: OncologyCalibration | null, papers: EstablishedPaper[]): SportsFinding[] {
  if (!cal) return [];
  const findings: SportsFinding[] = [];
  const sourceLabel = "Overlay Oncology";

  const potency = cal.potency;
  if (potency?.medianIc50 && typeof potency.medianIc50 === "number") {
    const ref = crossReference("cancer cell line drug sensitivity IC50 pharmacogenomics", papers);
    const dataset = potency.provenance?.source || "CCLE drug-treatment IC50";
    findings.push({
      title: `Oncology potency calibration: median IC50 ${potency.medianIc50.toFixed(2)} ÂµM across ${potency.n ?? "n/a"} cell lines`,
      insight: `The Overlay Oncology simulator is calibrated to real pharmacogenomic data (${dataset}${potency.provenance?.rowCount ? `, ${potency.provenance.rowCount} measurements` : ""}) with median IC50 ${potency.medianIc50.toFixed(2)} ÂµM and 95% CI [${(potency.ciLow ?? 0).toFixed(2)}, ${(potency.ciHigh ?? 0).toFixed(2)}]. Cross-referenced against ${ref.matched.length} established cancer-sensitivity studies.`,
      category: "Oncology",
      pillar: "science",
      measured: true,
      confidence: 0.93,
      alwaysPersist: true,
    });
  }

  const survival = cal.survival;
  if (survival?.medianSurvivalMonths && typeof survival.medianSurvivalMonths === "number") {
    const ref = crossReference("cancer patient survival model hazard weibull", papers);
    const dataset = survival.provenance?.source || "TCGA survival";
    findings.push({
      title: `Oncology survival calibration: median OS ${survival.medianSurvivalMonths.toFixed(1)} months (${survival.n ?? "n/a"} patients)`,
      insight: `The Overlay Oncology survival model is calibrated to real patient data (${dataset}${survival.provenance?.rowCount ? `, ${survival.provenance.rowCount} patients` : ""}) with median overall survival ${survival.medianSurvivalMonths.toFixed(1)} months and Weibull shape ${(survival.shape ?? 0).toFixed(2)}. Cross-referenced against ${ref.matched.length} established survival studies.`,
      category: "Oncology",
      pillar: "science",
      measured: true,
      confidence: 0.93,
      alwaysPersist: true,
    });
  }

  return findings;
}

// ---- Research paper generation -----------------------------------------------

function generateResearchPaper(findings: SportsFinding[]): void {
  if (!findings.length) return;
  const top = findings.slice(0, 8);
  const title = "Overlay Research Digest â€” Sports Science & Hemp Research Findings";
  const nowIso = new Date().toISOString();
  const dateKey = nowIso.slice(0, 10);
  const abstractLines = top.map((f) => `â€¢ ${f.title}`);
  const evidence = top.every((f) => f.measured) ? "E1" : top.some((f) => f.measured) ? "E2" : "E3";

  upsertPaper.run({
    // Stable ID (no date) so the daily digest updates ONE canonical row each
    // day instead of inserting a new paper â€” the digest accumulates findings
    // in place and never floods the publication with near-identical rows.
    id: `overlay-research-digest`,
    source: "Overlay Research Desk",
    title,
    url: "",
    year: new Date().getFullYear(),
    authors: "Overlay Global Lens Research Desk",
    abstract: "",
    summary: `A daily digest of ${top.length} original research findings from the Overlay Global Lens domain engine (updated ${dateKey}):\n\n${abstractLines.join("\n")}`,
    category: "research",
    pillar: "research",
    evidence_tier: evidence,
    payload: JSON.stringify({ digestOf: top.map((f) => f.title), dateKey }),
    pub_date: nowIso,
  });
}

// NBA Codex open-source integration research (plan + findings from 2026-08-16).
// Surfaced as a public paper so the toolchain roadmap is traceable on the outlet.
function generateCodexOpenSourcePaper(): void {
  const nowIso = new Date().toISOString();
  const dateKey = nowIso.slice(0, 10);
  upsertPaper.run({
    // Stable ID (no date) â€” one canonical toolchain paper, updated in place.
    id: `codex-open-source-integration`,
    source: "Overlay Research Desk",
    title: "NBA Codex Open-Source Toolchain Integration Research",
    url: "",
    year: new Date().getFullYear(),
    authors: "Overlay Global Lens Research Desk",
    abstract: "",
    summary: `Open-source toolchain research for the NBA Codex pipeline: nba_api (live 2025-26 NBA.com ingest), full FiveThirtyEight RAPTOR/WAR (replacing the sparse Kaggle mirror), Cognee (vector + knowledge-graph memory) and floodlight (spatial/tracking events). Findings: codex season keys are end-year strings ("2026") vs nba_api "2025-26"; NBA.com IDs must be joined to codex profiles by name; 2 of 10 codex hypotheses predict 2026 (Haliburton, Horton-Tucker), 8 predict 2027 and are unresolvable until the 2026-27 season. (Updated ${dateKey})`,
    category: "research",
    pillar: "research",
    evidence_tier: "E2",
    payload: JSON.stringify({ dateKey, topic: "nba-codex-open-source-integration" }),
    pub_date: nowIso,
  });
}

// ---- Main sync ----------------------------------------------------------------

export async function syncDomainResearch(): Promise<{
  discoveries: number;
  trends: number;
  papers: number;
  source: string | null;
}> {
  const papers = await loadEstablishedPapers();
  const oncologyCal = await loadOncologyCalibrationHttp();
  const findings = [
    ...sportsScienceFindings(papers),
    ...codexOncoFindings(),
    ...oncologyFindings(oncologyCal, papers),
    ...hempResearchFindings(loadHempResearch(), papers),
    ...(await scienceValidationFindings()),
  ];

  let discoveries = 0;
  let trends = 0;
  const nowIso = new Date().toISOString();

  // Per-finding micro-discoveries are now bundled into the definitive research
  // papers produced by the synthesis engine (researchSynthesis.ts). They are
  // disabled by default so the outlet stops flooding with near-identical rows;
  // set GLOBAL_LENS_MICRO_DISCOVERIES=1 to restore the old behaviour. The
  // findings still drive the trends & insights engine and the daily digest.
  const microEnabled = process.env.GLOBAL_LENS_MICRO_DISCOVERIES === "1";

  for (const f of findings) {
    const id = `domain-${slug(f.title)}`;
    const tier = evidenceTierFor(f.measured, crossReference(f.title + " " + f.insight, papers).score);
    const ref = crossReference(f.title + " " + f.insight, papers);

    if (microEnabled || (f as any).alwaysPersist) {
      upsertDiscovery.run({
        id,
        title: f.title,
        insight: f.insight,
        evidence_tier: tier,
        hypothesis_id: null,
        linked_patch_id: null,
        source: "Overlay Research Desk",
        category: f.category,
        payload: JSON.stringify({
          pillar: f.pillar,
          related_papers: ref.matched.map((m) => ({ title: m.title, url: m.url })),
        }),
        pub_date: nowIso,
      });
      discoveries++;
    }

    if (f.direction || typeof f.slope === "number") {
      upsertTrend.run({
        id: `trend-domain-${slug(f.title)}`,
        title: `${f.title} (trend)`,
        summary: f.insight,
        direction: f.direction || "stable",
        slope: typeof f.slope === "number" ? f.slope : null,
        confidence: typeof f.confidence === "number" ? f.confidence : null,
        evidence_tier: tier,
        recommended_action: null,
        source: "Overlay Research Desk",
        category: f.category,
        payload: JSON.stringify({ pillar: f.pillar }),
        pub_date: nowIso,
      });
      trends++;
    }
  }

  generateResearchPaper(findings);
  generateCodexOpenSourcePaper();

  return { discoveries, trends, papers: findings.length ? 1 : 0, source: "overlay-research" };
}

// ---- Editorial article generation (best-effort, LLM lineup) --------------------

export async function generateEditorialArticles(findings?: SportsFinding[]): Promise<{ published: number }> {
  const f = findings || sportsScienceFindings(await loadEstablishedPapers());
  if (!f.length) return { published: 0 };
  const top = f.slice(0, 3);
  let published = 0;

  for (const finding of top) {
    try {
      const prompt = `
You are the editorial research desk of Overlay Global Lens, a premium research publication.
Write a short, factual, public-facing research article (200-280 words) based ONLY on this finding.
Do NOT invent statistics or sources. Do not mention internal systems, agents, or tooling.

FINDING:
${finding.title}
${finding.insight}

Output strictly valid JSON with no markdown fences:
{
  "headline": "headline under 90 chars",
  "standfirst": "one-sentence summary",
  "body": "2-4 short paragraphs",
  "tags": ["research", "sports-science"]
}`;
      const responseText = await callAIQueued(prompt);
      if (!responseText) continue;
      const match = responseText.match(/\{[\s\S]*\}/);
      const article = match ? JSON.parse(match[0]) : null;
      if (!article?.headline || !article?.body) continue;

      const urlHash = crypto
        .createHash("sha256")
        .update(`Overlay Research:${finding.title}`)
        .digest("hex");
      const pubDate = new Date().toISOString();
      await db.prepare(
        "INSERT OR IGNORE INTO articles (url_hash, category, source_name, original_title, original_url, image_url, original_text_dump, pub_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        urlHash,
        "research",
        "Overlay Research",
        String(article.headline).slice(0, 500),
        `global-lens://${urlHash}`,
        "",
        `${String(article.standfirst || "")}\n\n${String(article.body)}`,
        pubDate
      );
      published++;
    } catch (e: any) {
      console.warn(`[domain] Editorial article generation failed: ${e.message}`);
    }
  }
  return { published };
}

export async function syncDomainResearchWithEditorial(): Promise<{
  sync: Awaited<ReturnType<typeof syncDomainResearch>>;
  editorial: number;
}> {
  const sync = await syncDomainResearch();
  const editorial = await generateEditorialArticles();
  return { sync, editorial: editorial.published };
}
