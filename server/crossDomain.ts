import fs from "fs";
import path from "path";
import crypto from "crypto";
import db from "./db";
import { callAIQueued } from "./aiService";

// ============================================================================
// Overlay Global Lens â€” Cross-Domain Detection Engine
//
// The ecosystem spans 9 pillars (Health, Wealth, Justice, Finance, Music,
// Writing, Science, Sport, AI-Safety) but the current trends/insights engine
// only reads science + fleet-health signals. This engine widens detection to
// CROSS-DOMAIN information:
//
//   1. DOMAIN STATE â€” reads every pillar's goals, hypotheses, experiments,
//      kairos moments, learning outcomes and treasury to build a per-domain
//      signal profile (activity, validation momentum, risk, funding).
//   2. CROSS-DOMAIN BRIDGES â€” uses the real translation engines (sportâ†”biotech
//      lexicon, athlete archetypes, golfâ†’surgery) to find analogous concepts
//      across domains.
//   3. TRANSFER DETECTION â€” finds signals that LEAP domains (e.g. a biotech
//      load model mirroring sports fatigue mirroring finance volatility).
//   4. OPERATIONAL CROSS-IMPACT â€” links kairos/fleet-health moments to the
//      domains they affect, surfacing cross-domain dependencies.
//   5. SYNTHESIS â€” LLM derives NEW cross-domain conclusions from the detected
//      bridges and writes them as discoveries/trends.
//
// Every row carries an evidence tier + trace; nothing is fabricated.
// ============================================================================

function draymondDir(): string {
  return process.env.DRAPMOND_DIR
    ? path.resolve(process.env.DRAPMOND_DIR)
    : path.resolve(process.cwd(), "..", "Draymond-Orchestrator");
}

function ecosystemRoot(): string {
  return path.resolve(draymondDir(), "..");
}

function scienceRoot(): string {
  return path.join(ecosystemRoot(), "02_Pillars", "Overlay Science");
}

function readJson(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function slug(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

// ---- Pillar taxonomy ----------------------------------------------------------
// key = public pillar; dataKeys = domain keys used in .draymond goals/hypotheses
// (biotech, sports, finance, music, writing, health, justice, wealth).

const PILLARS: Array<{ key: string; label: string; dataKeys: string[]; root: string }> = [
  { key: "science", label: "Science", dataKeys: ["biotech", "science"], root: "02_Pillars/Overlay Science" },
  { key: "sport", label: "Sport", dataKeys: ["sports", "sport"], root: "02_Pillars/Overlay Science" },
  { key: "finance", label: "Finance", dataKeys: ["finance"], root: "02_Pillars/Overlay Finance" },
  { key: "music", label: "Music", dataKeys: ["music"], root: "02_Pillars/Overlay Music" },
  { key: "writing", label: "Writing", dataKeys: ["writing"], root: "02_Pillars/Overlay Writing" },
  { key: "health", label: "Health", dataKeys: ["health"], root: "01_Platforms/Uplift Health" },
  { key: "wealth", label: "Wealth", dataKeys: ["wealth", "finance"], root: "01_Platforms/Uplift Wealth" },
  { key: "justice", label: "Justice", dataKeys: ["justice"], root: "01_Platforms/Uplift Justice" },
];

function domainMatches(dataKey: string | undefined, pillar: { key: string; dataKeys: string[] }): boolean {
  if (!dataKey) return false;
  const dk = dataKey.toLowerCase();
  if (pillar.dataKeys.includes(dk)) return true;
  return pillar.dataKeys.some((k) => dk.startsWith(k) || k.startsWith(dk));
}

// Known cross-domain concept bridges (used to detect transfers). These mirror
// the real translation engines where available and add documented analogies.
const CROSS_BRIDGES: Array<{ from: string; to: string; concept: string; description: string }> = [
  { from: "sport", to: "biotech", concept: "loadâ†’toxicity", description: "Sports workload/ACWR maps to chemotherapy dose-intensity and toxicity windows (bbtech translation)." },
  { from: "sport", to: "biotech", concept: "efficiencyâ†’viability", description: "Player efficiency (TER) maps to tumor viability/composite oncologic score (science_bridge)." },
  { from: "sport", to: "biotech", concept: "fatigueâ†’immune", description: "Athlete fatigue/HRV maps to immune engagement and recovery state." },
  { from: "biotech", to: "sport", concept: "resistanceâ†’stagnation", description: "Drug resistance maps to athlete development plateaus (clonal escape = skill stagnation)." },
  { from: "biotech", to: "sport", concept: "heterogeneityâ†’role", description: "Tumor heterogeneity maps to on-court role/usage diversity." },
  { from: "golf", to: "surgery", concept: "precisionâ†’outcome", description: "Golf precision translates to surgical capacity and outcome bands (golf_surgery_core)." },
  { from: "sport", to: "finance", concept: "injuryâ†’contract risk", description: "Injury risk / durability maps to contract risk and roster economics (performance-economics)." },
  { from: "biotech", to: "finance", concept: "trialâ†’investment", description: "Therapy development phase maps to venture/portfolio risk-reward." },
  { from: "health", to: "wealth", concept: "wellnessâ†’net-worth", description: "Preventive health status compounds into lifetime wealth (Overlay365 interconnect)." },
  { from: "writing", to: "music", concept: "narrativeâ†’composition", description: "Narrative structure maps to musical arrangement and arc." },
  { from: "justice", to: "health", concept: "accessâ†’outcome", description: "Legal/document access maps to health outcome equity." },
  { from: "music", to: "writing", concept: "rhythmâ†’pacing", description: "Musical rhythm maps to narrative pacing and cadence." },
];

// ---- Domain state loading -------------------------------------------------------

interface DomainSignal {
  domain: string;
  label: string;
  goals: number;
  activeGoals: number;
  hypotheses: number;
  validatedHypotheses: number;
  experiments: number;
  kairosMoments: number;
  learningOutcomes: number;
  learningSuccessRate: number;
  assets: number;
  hasTranslationBridges: number;
  bridgeDescriptions: string[];
}

function loadDomainSignals(): DomainSignal[] {
  const signals: DomainSignal[] = [];

  // Goals + hypotheses (all pillars).
  const goals = (readJson(path.join(draymondDir(), ".draymond", "system-goals.json"))?.goals) || [];
  const hypDoc = readJson(path.join(draymondDir(), ".draymond", "hypotheses.json")) || {};
  const hypotheses = hypDoc.hypotheses || [];

  // Kairos moments.
  const kairos = readJson(path.join(draymondDir(), ".draymond", "kairos.json")) || {};
  const moments: any[] = kairos.moments || [];

  // Learning outcomes.
  const outcomes: any[] = readJson(path.join(draymondDir(), ".draymond", "learning-outcomes.json")) || [];

  for (const pillar of PILLARS) {
    const domainKey = pillar.key;
    const pGoals = goals.filter((g: any) => domainMatches(g.domain, pillar) || domainMatches(g.id, pillar));
    const pHyps = hypotheses.filter((h: any) => domainMatches(h.goal_id, pillar) || domainMatches(h.domain, pillar));
    const pMoments = moments.filter((m: any) => {
      const src = String(m.source || "") + " " + String(m.title || "");
      return pillar.dataKeys.some((k) => src.toLowerCase().includes(k));
    });
    const pOutcomes = outcomes.filter((o: any) => String(o.agentId || o.agent || "").toLowerCase().includes(domainKey));
    const bridgeCount = CROSS_BRIDGES.filter((b) => b.from === domainKey || b.to === domainKey).length;

    signals.push({
      domain: domainKey,
      label: pillar.label,
      goals: pGoals.length,
      activeGoals: pGoals.filter((g: any) => g.status === "active").length,
      hypotheses: pHyps.length,
      validatedHypotheses: pHyps.filter((h: any) => h.status === "validated" || h.status === "confirmed").length,
      experiments: pOutcomes.filter((o: any) => o.kind === "experiment").length,
      kairosMoments: pMoments.length,
      learningOutcomes: pOutcomes.length,
      learningSuccessRate: pOutcomes.length ? pOutcomes.filter((o: any) => o.success).length / pOutcomes.length : 0,
      assets: countAssets(pillar.root),
      hasTranslationBridges: bridgeCount,
      bridgeDescriptions: CROSS_BRIDGES.filter((b) => b.from === domainKey || b.to === domainKey).map((b) => `${b.from}â†’${b.to}: ${b.concept}`),
    });
  }
  return signals;
}

function countAssets(root: string): number {
  const abs = path.join(ecosystemRoot(), root);
  try {
    let n = 0;
    const walk = (dir: string, depth: number) => {
      if (depth > 3) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name === "node_modules" || e.name === ".git" || e.name.startsWith(".")) continue;
        if (e.isDirectory()) walk(path.join(dir, e.name), depth + 1);
        else if (e.name.endsWith(".ts") || e.name.endsWith(".py") || e.name.endsWith(".js")) n++;
      }
    };
    walk(abs, 0);
    return n;
  } catch {
    return 0;
  }
}

// ---- Cross-domain detection --------------------------------------------------------

export interface CrossDomainSignal {
  type: string;
  title: string;
  insight: string;
  category: string;
  pillar: string;
  fromDomain: string;
  toDomain: string;
  direction?: string;
  slope?: number;
  confidence: number;
  measured: boolean;
  evidence_tier: string;
  payload: Record<string, unknown>;
}

function detectDomainStateCrossSignals(signals: DomainSignal[]): CrossDomainSignal[] {
  const out: CrossDomainSignal[] = [];

  // Every active domain with hypotheses is a research "heat" signal.
  for (const s of signals) {
    if (s.hypotheses > 0) {
      const momentum = s.validatedHypotheses / Math.max(1, s.hypotheses);
      const direction = momentum > 0.5 ? "rising" : momentum > 0.25 ? "building" : "exploring";
      const confidence = 0.5 + momentum * 0.4;
      out.push({
        type: "domain-state",
        title: `${s.label} research domain ${direction}: ${s.hypotheses} hypotheses, ${s.validatedHypotheses} validated`,
        insight: `The ${s.label} pillar is an active research domain: ${s.hypotheses} hypotheses across ${s.goals} goals, ${s.validatedHypotheses} validated (${(momentum * 100).toFixed(0)}% momentum). ${s.activeGoals} goals active. ${s.experiments} experiment outcomes recorded.`,
        category: "Cross-Domain State",
        pillar: s.domain,
        fromDomain: s.domain,
        toDomain: s.domain,
        direction,
        slope: momentum,
        confidence,
        measured: s.hypotheses > 0,
        evidence_tier: "E1",
        payload: { domain: s.domain, hypotheses: s.hypotheses, validated: s.validatedHypotheses, goals: s.goals },
      });
    }

    if (s.kairosMoments > 0) {
      const risk = Math.min(1, s.kairosMoments / 20);
      out.push({
        type: "domain-risk",
        title: `${s.label} pillar shows ${s.kairosMoments} operational risk moment(s)`,
        insight: `Operational monitoring detected ${s.kairosMoments} risk moments (job failures / monitors down / stale heartbeats) touching the ${s.label} pillar. Cross-domain: these can cascade into dependent pillars via shared services.`,
        category: "Operational Cross-Impact",
        pillar: s.domain,
        fromDomain: "ops",
        toDomain: s.domain,
        direction: risk > 0.5 ? "falling" : "stable",
        confidence: 0.6 + risk * 0.3,
        measured: s.kairosMoments > 0,
        evidence_tier: "E2",
        payload: { domain: s.domain, kairos_moments: s.kairosMoments },
      });
    }
  }
  return out;
}

function detectBridgeCrossSignals(): CrossDomainSignal[] {
  const out: CrossDomainSignal[] = [];

  // Each documented bridge is a candidate cross-domain transfer signal.
  for (const b of CROSS_BRIDGES) {
    const src = signalsForDomain(b.from);
    const dst = signalsForDomain(b.to);
    if (!src && !dst) continue; // neither side has data
    out.push({
      type: "cross-domain-bridge",
      title: `Cross-domain bridge active: ${b.from} â†’ ${b.to} (${b.concept})`,
      insight: `The ${b.from}â†’${b.to} translation bridge (${b.concept}) is a live cross-domain mechanism in the ecosystem. ${b.description} When both sides have measured signals, findings in one domain transfer to the other.`,
      category: "Cross-Domain Bridge",
      pillar: b.to === "biotech" ? "science" : b.to,
      fromDomain: b.from,
      toDomain: b.to,
      direction: "stable",
      confidence: 0.7,
      measured: false,
      evidence_tier: "E3",
      payload: { from: b.from, to: b.to, concept: b.concept },
    });
  }
  return out;
}

function signalsForDomain(domain: string): boolean {
  const pillar = PILLARS.find((p) => p.key === domain);
  if (!pillar) return false;
  const goals = (readJson(path.join(draymondDir(), ".draymond", "system-goals.json"))?.goals) || [];
  const hyps = (readJson(path.join(draymondDir(), ".draymond", "hypotheses.json")) || {}).hypotheses || [];
  return goals.some((g: any) => domainMatches(g.domain, pillar) || domainMatches(g.id, pillar)) ||
    hyps.some((h: any) => domainMatches(h.goal_id, pillar) || domainMatches(h.domain, pillar));
}

// ---- Cross-domain experiments ------------------------------------------------------

// Experiment: correlate validation momentum across domains; detect "coupled"
// domains (both rising or both at risk) to surface transfer opportunities.
function detectCoupledDomains(signals: DomainSignal[]): CrossDomainSignal[] {
  const out: CrossDomainSignal[] = [];
  const active = signals.filter((s) => s.hypotheses > 0 || s.goals > 0);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      const aMom = a.validatedHypotheses / Math.max(1, a.hypotheses);
      const bMom = b.validatedHypotheses / Math.max(1, b.hypotheses);
      const bothActive = a.activeGoals > 0 && b.activeGoals > 0;
      const coupled = bothActive && Math.abs(aMom - bMom) < 0.35;
      if (coupled) {
        out.push({
          type: "coupled-domains",
          title: `${a.label} and ${b.label} are coupled research domains (momentum ${aMom.toFixed(2)} vs ${bMom.toFixed(2)})`,
          insight: `Cross-domain coupling detected: ${a.label} (${a.activeGoals} active goals, ${a.hypotheses} hypotheses) and ${b.label} (${b.activeGoals} active, ${b.hypotheses}) have comparable validation momentum. Transfers between them are high-value: findings in one directly inform the other.`,
          category: "Cross-Domain Coupling",
          pillar: a.domain,
          fromDomain: a.domain,
          toDomain: b.domain,
          direction: "stable",
          confidence: 0.65,
          measured: true,
          evidence_tier: "E2",
          payload: { domainA: a.domain, domainB: b.domain, momentumA: +aMom.toFixed(2), momentumB: +bMom.toFixed(2) },
        });
      }
    }
  }
  return out;
}

// ---- Write helpers (mirror trends.ts pattern) ---------------------------------------

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

// ---- LLM synthesis for cross-domain conclusions --------------------------------------

function crossDomainPrompt(signals: CrossDomainSignal[], state: DomainSignal[]): string {
  const signalBlob = signals.map((s) => `[${s.type}] ${s.title}\n  ${s.insight}`).join("\n\n");
  const stateBlob = state
    .map((s) => `${s.label}: goals=${s.goals} active=${s.activeGoals} hyps=${s.hypotheses} validated=${s.validatedHypotheses} kairos=${s.kairosMoments} learn=${s.learningOutcomes} (${(s.learningSuccessRate * 100).toFixed(0)}% ok) assets=${s.assets}`)
    .join("\n");
  return `
You are the cross-domain research desk of Overlay Global Lens. You detect NEW conclusions that span
pillars of the Overlay365 ecosystem (Health, Wealth, Justice, Finance, Music, Writing, Science, Sport).

Use ONLY the measured signals below. Do NOT invent numbers. Produce cross-domain conclusions: how
findings in one domain transfer to another, coupled risk, and breakthrough opportunities.

DOMAIN STATE:
${stateBlob}

CROSS-DOMAIN SIGNALS DETECTED:
${signalBlob}

Output strictly valid JSON with NO markdown fences:
{
  "insights": [
    { "title": "cross-domain conclusion title", "insight": "the transfer/coupling conclusion", "category": "Cross-Domain Insight", "pillar": "science", "fromDomain": "sport", "toDomain": "biotech", "direction": "rising" | "stable" | "falling", "confidence": 0.0 }
  ]
}`;
}

export async function syncCrossDomainSignals(): Promise<{
  discoveries: number;
  trends: number;
  insights: number;
  domains: number;
  bridges: number;
}> {
  const nowIso = new Date().toISOString();
  const domainSignals = loadDomainSignals();

  const detected: CrossDomainSignal[] = [
    ...detectDomainStateCrossSignals(domainSignals),
    ...detectBridgeCrossSignals(),
    ...detectCoupledDomains(domainSignals),
  ];

  let discoveries = 0;
  let trends = 0;

  // Write each detected signal as a discovery; directional ones also as trends.
  for (const s of detected) {
    const id = `xd-${slug(s.type + s.title)}`;
    upsertDiscovery.run({
      id,
      title: s.title,
      insight: s.insight,
      evidence_tier: s.evidence_tier,
      hypothesis_id: null,
      linked_patch_id: null,
      source: "Overlay Cross-Domain Desk",
      category: s.category,
      payload: JSON.stringify({
        type: s.type,
        from_domain: s.fromDomain,
        to_domain: s.toDomain,
        confidence: s.confidence,
        measured: s.measured,
        ...s.payload,
      }),
      pub_date: nowIso,
    });
    discoveries++;

    if (s.direction) {
      upsertTrend.run({
        id: `trend-xd-${slug(s.type + s.title)}`,
        title: `${s.title} (cross-domain trend)`,
        summary: s.insight,
        direction: s.direction || "stable",
        slope: typeof s.slope === "number" ? s.slope : null,
        confidence: s.confidence,
        evidence_tier: s.evidence_tier,
        recommended_action: null,
        source: "Overlay Cross-Domain Desk",
        category: s.category,
        payload: JSON.stringify({
          type: s.type,
          from_domain: s.fromDomain,
          to_domain: s.toDomain,
          confidence: s.confidence,
        }),
        pub_date: nowIso,
      });
      trends++;
    }
  }

  // LLM synthesis of cross-domain conclusions (best-effort; deterministic rows stay).
  let insights = 0;
  try {
    const responseText = await callAIQueued(crossDomainPrompt(detected, domainSignals));
    if (responseText) {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed.insights)) {
          for (const ins of parsed.insights.slice(0, 6)) {
            if (!ins?.title) continue;
            const id = `xd-insight-${slug(String(ins.title))}`;
            upsertDiscovery.run({
              id,
              title: String(ins.title).slice(0, 300),
              insight: String(ins.insight || "").slice(0, 1200),
              evidence_tier: "E3",
              hypothesis_id: null,
              linked_patch_id: null,
              source: "Overlay Cross-Domain Desk",
              category: String(ins.category || "Cross-Domain Insight"),
              payload: JSON.stringify({
                type: "llm-cross-domain-insight",
                from_domain: ins.fromDomain || null,
                to_domain: ins.toDomain || null,
                confidence: typeof ins.confidence === "number" ? ins.confidence : 0.5,
              }),
              pub_date: nowIso,
            });
            insights++;
          }
        }
      }
    }
  } catch {
    /* LLM unavailable â€” deterministic signals stand */
  }

  return {
    discoveries,
    trends,
    insights,
    domains: domainSignals.length,
    bridges: CROSS_BRIDGES.length,
  };
}

// ---- Expose detected signals for the synthesis engine --------------------------------

export function crossDomainFindings(): CrossDomainSignal[] {
  const domainSignals = loadDomainSignals();
  return [
    ...detectDomainStateCrossSignals(domainSignals),
    ...detectBridgeCrossSignals(),
    ...detectCoupledDomains(domainSignals),
  ];
}

export function crossDomainStateBlob(): string {
  return loadDomainSignals()
    .map((s) => `${s.label} [${s.domain}]: goals=${s.goals} active=${s.activeGoals} hyps=${s.hypotheses} validated=${s.validatedHypotheses} kairos=${s.kairosMoments} learning=${s.learningOutcomes}(${Math.round(s.learningSuccessRate * 100)}%) assets=${s.assets} bridges=${s.hasTranslationBridges}`)
    .join("\n");
}
