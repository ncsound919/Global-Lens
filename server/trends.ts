import fs from "fs";
import path from "path";
import crypto from "crypto";
import db from "./db";

// Overlay Global Lens â€” trends & discoveries ingestion.
// Sources (file-first, HTTP fallback):
//   1. Benchmark Olympics discovery loop  -> .discovery-loop/state.json
//   2. Draymond research hypotheses       -> .draymond/hypotheses.json
//   3. HempForge / OmniResearch / Draymond HTTP endpoints (when configured)
//
// PUBLIC-OUTLET RULE: this module is the boundary where internal ecosystem
// signals become public research content. Internal identifiers (candidate
// names, patch ids, hypothesis ids, weakness/predicted-gain scores and
// "apply patch" instructions) are NEVER written here â€” the outlet only ever
// carries the public-facing signal (domain, direction, slope, confidence,
// evidence tier) framed as editorial research. Records carry evidence tiers
// (E1â€“E4) so the outlet never presents speculation as fact â€” determinism &
// auditability are preserved.

function ingestDir(): string {
  return process.env.OVERLAY_INGEST_DIR || path.join(process.cwd(), "data", "ingest");
}

function ecosystemRoot(): string {
  return path.resolve(process.cwd(), "..");
}

function discoveryLoopCandidates(): string[] {
  return [
    path.join(ingestDir(), "discovery-loop.json"),
    path.join(ecosystemRoot(), "Benchmark Olympics", ".discovery-loop", "state.json"),
  ].filter((p) => fs.existsSync(p));
}

function hypothesesCandidates(): string[] {
  return [
    path.join(ingestDir(), "hypotheses.json"),
    path.join(ecosystemRoot(), "Draymond-Orchestrator", ".draymond", "hypotheses.json"),
  ].filter((p) => fs.existsSync(p));
}

function readJsonFile(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e: any) {
    console.warn(`[trends] Could not parse ${file}: ${e.message}`);
    return null;
  }
}

function slug(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 24);
}

const upsertTrend = await db.prepare(`
  INSERT INTO trends (id, title, summary, direction, slope, confidence, evidence_tier, recommended_action, source, category, payload, pub_date)
  VALUES (@id, @title, @summary, @direction, @slope, @confidence, @evidence_tier, @recommended_action, @source, @category, @payload, @pub_date)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title, summary = excluded.summary, direction = excluded.direction,
    slope = excluded.slope, confidence = excluded.confidence, evidence_tier = excluded.evidence_tier,
    recommended_action = excluded.recommended_action, source = excluded.source,
    category = excluded.category, payload = excluded.payload, pub_date = excluded.pub_date
`);

const upsertDiscovery = await db.prepare(`
  INSERT INTO discoveries (id, title, insight, evidence_tier, hypothesis_id, linked_patch_id, source, category, payload, pub_date)
  VALUES (@id, @title, @insight, @evidence_tier, @hypothesis_id, @linked_patch_id, @source, @category, @payload, @pub_date)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title, insight = excluded.insight, evidence_tier = excluded.evidence_tier,
    source = excluded.source, category = excluded.category, payload = excluded.payload,
    pub_date = excluded.pub_date
`);

// ---- Public-facing framing helpers -------------------------------------
// Internal engine signals must never surface verbatim. These helpers turn raw
// discovery-loop fields into editorial research copy the outlet can publish.

function publicTitle(candidateName: string | undefined, upgradeKind: string | undefined, category: string, evidenceTier: string): string {
  const domain = category && category !== "research" ? category : "Research";
  if (upgradeKind === "monitor") return `${domain} â€” watch item (Evidence ${evidenceTier})`;
  return `${domain} â€” research signal (Evidence ${evidenceTier})`;
}

function publicInsight(ins: any, category: string, evidenceTier: string): string {
  const domain = category && category !== "research" ? category : "the research space";
  const direction = ins.trendDirection || "stable";
  const directionText =
    direction === "rising" ? "rising" : direction === "falling" ? "falling" : "holding steady";
  const confidence =
    typeof ins.confidence === "number" ? `, ${Math.round(ins.confidence * 100)}% confidence` : "";
  const trendLine = `A ${evidenceTier} evidence-tier signal in ${domain} appears to be ${directionText}${confidence}.`;
  if (upgradeKind(ins) === "monitor") {
    return `${trendLine} Performance remains below the publication threshold; continued monitoring is advised.`;
  }
  return `${trendLine} The signal warrants further review by the editorial research desk before broader conclusions are drawn.`;
}

function upgradeKind(ins: any): string {
  return ins.upgradeKind || "signal";
}

function publicSourceLabel(engineSource: string): string {
  const map: Record<string, string> = {
    "discovery-loop": "Overlay Research Engine",
    hypotheses: "Overlay Research",
    "fleet-trend": "Overlay Trends",
    hempforge: "Hemp Research",
    omniresearch: "Omni Research",
  };
  return map[engineSource] || engineSource || "Overlay Research";
}

const GOAL_TO_DOMAIN: Record<string, string> = {
  biotech: "Biotech",
  sports: "Sports Science",
  finance: "Wealth",
  music: "Music",
  writing: "Writing",
  justice: "Justice",
  health: "Health",
};

function publicDomainForGoal(goalId: string): string {
  const prefix = (goalId || "").split("-")[0].toLowerCase();
  return GOAL_TO_DOMAIN[prefix] || goalId || "Research";
}

function publicTrendTitle(ins: any, category: string, evidenceTier: string): string {
  const domain = category && category !== "research" ? category : "Research";
  const direction = ins.trendDirection || "stable";
  const directionText =
    direction === "rising" ? "rising" : direction === "falling" ? "falling" : "holding steady";
  return `${domain} â€” ${directionText} trend (Evidence ${evidenceTier})`;
}

function publicTrendSummary(ins: any, category: string, evidenceTier: string): string {
  const domain = category && category !== "research" ? category : "the research space";
  const direction = ins.trendDirection || "stable";
  const directionText =
    direction === "rising" ? "rising" : direction === "falling" ? "falling" : "holding steady";
  const confidence =
    typeof ins.confidence === "number" ? `, ${Math.round(ins.confidence * 100)}% confidence` : "";
  const slope = typeof ins.slope === "number" ? ` (slope ${ins.slope.toFixed(3)})` : "";
  return `An ${evidenceTier} evidence-tier signal in ${domain} is ${directionText}${slope}${confidence}.`;
}

export async function syncTrendsAndDiscoveries(): Promise<{ trends: number; discoveries: number; source: string | null }> {
  let trends = 0;
  let discoveries = 0;
  let source: string | null = null;
  const nowIso = new Date().toISOString();
  const writtenDiscoveryIds: string[] = [];
  const writtenTrendIds: string[] = [];

  // ---- Source 1: discovery loop quick-upgrade insights ----
  const loopFile = discoveryLoopCandidates()[0];
  if (loopFile) {
    const state = readJsonFile(loopFile);
    if (state && Array.isArray(state.iterations)) {
      source = `file:${loopFile}`;
      // Deduplicate per (category, evidence tier): internal candidate rows all
      // collapse to a single public signal so the outlet never shows a wall of
      // near-identical items. Keep the strongest confidence for the row.
      const byKey = new Map<string, any>();
      for (const iter of state.iterations) {
        if (!Array.isArray(iter.quickUpgradeInsights)) continue;
        for (const ins of iter.quickUpgradeInsights) {
          if (!ins || !ins.id) continue;
          const category = ins.category || iter.category || "research";
          const evidenceTier = ins.evidenceTier || "E4";
          const key = `${category}|${evidenceTier}`;
          const existing = byKey.get(key);
          if (!existing) {
            byKey.set(key, { ...ins, category, evidenceTier, createdAt: ins.createdAt || iter.completedAt });
          } else if (typeof ins.confidence === "number" && (typeof existing.confidence !== "number" || ins.confidence > existing.confidence)) {
            byKey.set(key, { ...existing, ...ins, category, evidenceTier });
          }
        }
      }

      for (const ins of byKey.values()) {
        const category = ins.category;
        const evidenceTier = ins.evidenceTier;
        const pubDate = ins.createdAt || nowIso;

        // A quick-upgrade insight is surfaced as a discovery (public signal),
        // framed with editorial copy â€” never the raw internal fields.
        upsertDiscovery.run({
          id: `discovery-${category}-${evidenceTier}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          title: publicTitle(ins.candidateName, ins.upgradeKind, category, evidenceTier),
          insight: publicInsight(ins, category, evidenceTier),
          evidence_tier: evidenceTier,
          hypothesis_id: null,
          linked_patch_id: null,
          source: publicSourceLabel("discovery-loop"),
          category,
          payload: JSON.stringify({
            direction: ins.trendDirection,
            slope: ins.slope,
            confidence: ins.confidence,
            evidence_tier: evidenceTier,
          }),
          pub_date: pubDate,
        });
        writtenDiscoveryIds.push(`discovery-${category}-${evidenceTier}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
        discoveries++;

        // And it also describes a trend (direction + slope over iterations).
        upsertTrend.run({
          id: `trend-${category}-${evidenceTier}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          title: publicTrendTitle(ins, category, evidenceTier),
          summary: publicTrendSummary(ins, category, evidenceTier),
          direction: ins.trendDirection || "flat",
          slope: typeof ins.slope === "number" ? ins.slope : null,
          confidence: typeof ins.confidence === "number" ? ins.confidence : null,
          evidence_tier: evidenceTier,
          recommended_action: null,
          source: publicSourceLabel("discovery-loop"),
          category,
          payload: JSON.stringify({
            direction: ins.trendDirection,
            slope: ins.slope,
            confidence: ins.confidence,
          }),
          pub_date: pubDate,
        });
        writtenTrendIds.push(`trend-${category}-${evidenceTier}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
        trends++;
      }
    }
  }

  // ---- Source 2: Draymond research hypotheses ----
  const hypFile = hypothesesCandidates()[0];
  if (hypFile) {
    const hypDoc = readJsonFile(hypFile);
    if (hypDoc && Array.isArray(hypDoc.hypotheses)) {
      source = source || `file:${hypFile}`;
      // Group hypotheses by research goal so the outlet surfaces one discovery
      // per goal (internal hypothesis ids and goal codes never appear).
      const byGoal = new Map<string, any[]>();
      for (const h of hypDoc.hypotheses) {
        if (!h || !h.id) continue;
        const goal = h.goal_id || "research";
        if (!byGoal.has(goal)) byGoal.set(goal, []);
        byGoal.get(goal)!.push(h);
      }
      for (const [goal, list] of byGoal) {
        const validated = list.some((h) => h.status === "validated");
        const inProgress = list.some((h) => h.status === "in_progress");
        const status = validated ? "validated" : inProgress ? "in_progress" : list.some((h) => h.status === "refuted") ? "refuted" : "untested";
        const claims = list.map((h) => h.claim).filter(Boolean);
        const headline = claims[0]?.slice(0, 80) || "Research hypothesis under study";
        upsertDiscovery.run({
          id: `hyp-goal-${goal}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          title: `Research hypothesis: ${headline}`,
          insight: claims.join(" ") || "",
          evidence_tier: validated ? "E2" : status === "refuted" ? "E3" : inProgress ? "E3" : "E4",
          hypothesis_id: null,
          linked_patch_id: null,
          source: publicSourceLabel("hypotheses"),
          category: publicDomainForGoal(goal),
          payload: JSON.stringify({
            status,
            goal_id: goal,
            claim_count: claims.length,
            claims: claims.slice(0, 8).map((c) => c.slice(0, 400)),
          }),
          pub_date: list.reduce((max: string | null, h) => (h.updatedAt && (!max || h.updatedAt > max) ? h.updatedAt : max), null) || nowIso,
        });
        writtenDiscoveryIds.push(`hyp-goal-${goal}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
        discoveries++;
      }
    }
  }

  // Prune orphaned rows from previous sync runs (old id schemes / stale engine
  // signals) so the outlet only ever carries current public content.
  if (writtenDiscoveryIds.length) {
    const placeholders = writtenDiscoveryIds.map(() => "?").join(",");
    await db.prepare(`DELETE FROM discoveries WHERE source IN (?,?) AND id NOT IN (${placeholders})`)
      .run("Overlay Research Engine", "Overlay Research", ...writtenDiscoveryIds);
  }
  if (writtenTrendIds.length) {
    const placeholders = writtenTrendIds.map(() => "?").join(",");
    await db.prepare(`DELETE FROM trends WHERE source IN (?,?) AND id NOT IN (${placeholders})`)
      .run("Overlay Research Engine", "Overlay Research", ...writtenTrendIds);
  }

  return { trends, discoveries, source };
}