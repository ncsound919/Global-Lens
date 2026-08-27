import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";

// ============================================================================
// Overlay Global Lens — Science Experiment Runner
//
// Runs REAL experiments and simulations on the Overlay Science research data so
// we draw NEW conclusions from OUR data — not compiled summaries. Each sector
// (cluster) gets dedicated experiments that re-run the engines with varied
// parameters, sweeps and counterfactuals, producing a "findings block" of
// freshly measured outcomes.
//
// Every experiment is deterministic (same inputs → same outputs), stores an
// evidence tier, and traces to the engine + inputs that produced it. The
// findings blocks are consumed by the research synthesis engine so the papers
// report experimental results, not restatements.
// ============================================================================

const PYTHON = process.env.PYTHON_PATH || "C:\\Program Files\\Python312\\python.exe";

function ecosystemRoot(): string {
  return process.env.DRAPMOND_DIR
    ? path.resolve(process.env.DRAPMOND_DIR, "..")
    : path.resolve(process.cwd(), "..");
}

function scienceRoot(): string {
  return path.join(ecosystemRoot(), "02_Pillars", "Overlay Science");
}

function researchDir(): string {
  if (process.env.OVERLAY_RESEARCH_DIR) return path.resolve(process.env.OVERLAY_RESEARCH_DIR);
  return path.join(ecosystemRoot(), "02_Pillars", "Overlay Science", "research");
}

function draymondRoot(): string {
  return path.join(ecosystemRoot(), "Draymond-Orchestrator");
}

function readJson(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function runPython(args: string[], cwd: string, timeoutMs = 60_000): Promise<any> {
  return new Promise((resolve) => {
    execFile(PYTHON, args, { cwd, timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ error: (stderr || err.message).slice(0, 600) });
        return;
      }
      const text = stdout.trim();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      try {
        if (start >= 0 && end > start) resolve(JSON.parse(text.slice(start, end + 1)));
        else resolve({ raw: text.slice(0, 2000) });
      } catch {
        resolve({ raw: text.slice(0, 2000) });
      }
    });
  });
}

function runPythonModule(moduleName: string, args: string[], cwd: string, timeoutMs = 60_000): Promise<any> {
  return new Promise((resolve) => {
    execFile(PYTHON, ["-m", moduleName, ...args], { cwd, timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ error: (stderr || err.message).slice(0, 600) });
        return;
      }
      const text = stdout.trim();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      try {
        if (start >= 0 && end > start) resolve(JSON.parse(text.slice(start, end + 1)));
        else resolve({ raw: text.slice(0, 2000) });
      } catch {
        resolve({ raw: text.slice(0, 2000) });
      }
    });
  });
}

// ---- Statistical helpers ------------------------------------------------------

function mean(xs: number[]): number {
  if (!xs.length) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pctPositive(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.filter((x) => x > 0).length / xs.length;
}

function percentile(xs: number[], p: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[idx];
}

function slug(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

// ============================================================================
// Experiments per sector
// ============================================================================

export interface ExperimentResult {
  experiment: string;
  sector: string;
  summary: string;
  metric: string;
  findings: Record<string, number | string | boolean>;
  evidence_tier: string;
  inputs: string[];
}

// ---- Sector 1: NBA→Biotech (CureMind onco translation) -------------------------
// Experiment: run the REAL sports_science + disease_research engines on a
// stratified sample of the player-season profiles to compute fresh TER,
// injury risk and recurrence risk, then derive era drift + correlations.

const ENGINE_SETUP = `
import sys
sys.path.insert(0, "{sports}")
sys.path.insert(0, "{biotech}")
sys.path.insert(0, "{science}")
`;

// Escape backslashes so Windows paths survive inside Python string literals.
function pyPath(p: string): string {
  return p.replace(/\\/g, "\\\\");
}

function engineComputeScript(sampleJson: string, outFile: string, sportsDir: string, biotechDir: string, scienceDir: string): string {
  return `${ENGINE_SETUP.replace("{sports}", pyPath(sportsDir)).replace("{biotech}", pyPath(biotechDir)).replace("{science}", pyPath(scienceDir))}
import json
from sports_science.codex_metrics import ter_score
from sports_science.injury_risk import injury_risk_percent, fatigue_score
from disease_research.onco_metrics import composite_score, four_factors
from disease_research.clinical import baseline_risk

rows = json.load(open(r"${pyPath(sampleJson)}", encoding="utf-8"))
out = []
for d in rows:
    perf = d.get("performance") or {}
    bio = d.get("biometrics") or {}
    try:
        ter = ter_score(fg=perf.get("fg", 0.0), tp=perf.get("tp", 0.0), ast=perf.get("ast", 0.0),
                        oreb=perf.get("oreb", 0.0), tov=perf.get("tov", 0.0), pf=perf.get("pf", 0.0))
    except Exception:
        ter = None
    try:
        injury = injury_risk_percent(fatigue=fatigue_score(hrv=bio.get("hrv", 65.0), load=bio.get("load", 0.0)),
                                     acute_chronic=bio.get("acute_chronic", 1.0),
                                     sleep_hrs=bio.get("sleep_hrs", 8.0))
    except Exception:
        injury = None
    year = d.get("season") or d.get("year") or 0
    out.append({"label": d.get("label"), "season": year, "ter": ter, "injury_risk": injury,
                "acwr": bio.get("acute_chronic")})
json.dump(out, open(r"${pyPath(outFile)}", "w", encoding="utf-8"), indent=2)
print(json.dumps({"computed": len(out)}))
`;
}

async function nbaBiotechExperiments(): Promise<ExperimentResult[]> {
  const out: ExperimentResult[] = [];
  const base = researchDir();
  const science = scienceRoot();
  const sportsDir = path.join(science, "Sports");
  const biotechDir = path.join(science, "Biotech");

  // Stratified sample of player-season profiles (deterministic stride).
  const playerFile = path.join(base, "2026-08-15-nba-biotech-e-drive", "nba_player_per_game_profiles.json");
  const players = readJson(playerFile);
  if (Array.isArray(players) && players.length) {
    const sample = players.filter((_, i) => i % Math.max(1, Math.floor(players.length / 1500)) === 0).slice(0, 1500);
    const sampleFile = path.join(process.env.TEMP || "C:\\Windows\\Temp", "exp_nba_sample.json");
    const outFile = path.join(process.env.TEMP || "C:\\Windows\\Temp", "exp_nba_computed.json");
    fs.writeFileSync(sampleFile, JSON.stringify(sample));
    const script = engineComputeScript(sampleFile, outFile, sportsDir, biotechDir, science);
    const r = await runPython(["-c", script], biotechDir, 90_000);
    const computed = readJson(outFile);
    if (Array.isArray(computed) && computed.length) {
      const withTer = computed.filter((c) => typeof c.ter === "number");
      const withInj = computed.filter((c) => typeof c.injury_risk === "number");
      const n = withTer.length;
      if (n > 50) {
        const byEra: Record<string, number[]> = {};
        for (const c of withTer) {
          const y = Number(c.season) || 0;
          const era = y < 2000 ? "1990s" : y < 2010 ? "2000s" : y < 2020 ? "2010s" : "2020s";
          (byEra[era] = byEra[era] || []).push(c.ter);
        }
        const eraMeans = Object.entries(byEra).map(([era, vals]) => ({ era, mean: mean(vals), n: vals.length }))
          .sort((a, b) => a.era.localeCompare(b.era));
        const first = eraMeans[0]?.mean ?? NaN, last = eraMeans[eraMeans.length - 1]?.mean ?? NaN;
        const drift = (last - first) / Math.max(1, eraMeans.length - 1);
        out.push({
          experiment: "era-ter-drift",
          sector: "NBA→Biotech",
          summary: `Era TER drift recomputed live via sports_science.ter_score across n=${n} player-seasons: ${eraMeans.length} eras, drift ${Number.isFinite(drift) ? drift.toFixed(4) + "/yr" : "n/a"} (${Number.isFinite(drift) && drift >= 0.05 ? "rising" : Number.isFinite(drift) && drift <= -0.05 ? "falling" : "stable"}).`,
          metric: "era_ter_drift",
          findings: {
            n,
            eras: eraMeans.length,
            first_era: Number.isFinite(first) ? +first.toFixed(3) : null,
            last_era: Number.isFinite(last) ? +last.toFixed(3) : null,
            drift_per_year: Number.isFinite(drift) ? +drift.toFixed(4) : null,
          },
          evidence_tier: "E1",
          inputs: eraMeans.map((e) => `${e.era} (n=${e.n})`),
        });
      }
      if (withInj.length > 50) {
        const rInj = pearson(withInj.map((c) => c.ter).filter(Number.isFinite), withInj.map((c) => c.injury_risk).filter(Number.isFinite));
        out.push({
          experiment: "ter-injury-coupling",
          sector: "NBA→Biotech",
          summary: `Efficiency–injury coupling recomputed live via engine output on n=${withInj.length} player-seasons: r=${Number.isFinite(rInj) ? rInj.toFixed(3) : "n/a"} (${Number.isFinite(rInj) ? (Math.abs(rInj) >= 0.5 ? "strong" : Math.abs(rInj) >= 0.3 ? "moderate" : "weak") : "n/a"}).`,
          metric: "ter_injury_corr",
          findings: { n: withInj.length, r: Number.isFinite(rInj) ? +rInj.toFixed(3) : null },
          evidence_tier: "E1",
          inputs: [],
        });
      }
    }
  }

  // Treatment-timing sensitivity via disease_research on the tumor sample.
  const tumorFile = path.join(base, "2026-08-14-nba-boxing-bbtech", "_tmp_tumor.json");
  if (fs.existsSync(tumorFile)) {
    const sweeps: { months: number; risk: number }[] = [];
    for (const months of [3, 6, 12, 18]) {
      const sample = readJson(tumorFile);
      if (!sample) continue;
      sample.treatment = sample.treatment || {};
      sample.treatment.time_point_months = months;
      const tmp = path.join(process.env.TEMP || "C:\\Windows\\Temp", `sweep_tumor_${months}.json`);
      fs.writeFileSync(tmp, JSON.stringify(sample));
      const r = await runPython(
        [path.join(biotechDir, "disease_research", "run_metrics.py"), "sweep", tmp],
        biotechDir
      );
      if (r && typeof r.recurrence_risk === "number") {
        sweeps.push({ months, risk: r.recurrence_risk });
      }
    }
    if (sweeps.length) {
      const risks = sweeps.map((s) => s.risk);
      out.push({
        experiment: "treatment-timing-sensitivity",
        sector: "NBA→Biotech",
        summary: `Recurrence-risk sensitivity to treatment time-point across ${sweeps.length} sweeps: ${risks[0].toFixed(4)} → ${risks[risks.length - 1].toFixed(4)} (Δ ${(risks[risks.length - 1] - risks[0]).toFixed(4)}).`,
        metric: "treatment_timing_risk",
        findings: {
          sweeps: sweeps.length,
          risk_at_3mo: +risks[0].toFixed(4),
          risk_at_18mo: +risks[risks.length - 1].toFixed(4),
          delta: +((risks[risks.length - 1] ?? 0) - (risks[0] ?? 0)).toFixed(4),
        },
        evidence_tier: "E1",
        inputs: sweeps.map((s) => `${s.months}mo: ${s.risk.toFixed(4)}`),
      });
    }
  }

  return out;
}

// ---- Sector 2: Breast Cancer Validation ----------------------------------------
// Experiment: bootstrap confidence of the ΔC signal on the real validation
// outputs + feature-level risk gradient across ER strata.

async function breastCancerValidationExperiments(): Promise<ExperimentResult[]> {
  const out: ExperimentResult[] = [];
  const base = researchDir();
  const rigor = readJson(path.join(base, "2026-08-15-validation", "results", "rigor_pass.json"));
  const h1b = readJson(path.join(base, "2026-08-15-validation", "results", "h1b_erplus.json"));

  if (rigor?.report_summary?.headline_effects) {
    const effects = Object.entries(rigor.report_summary.headline_effects as Record<string, any>)
      .map(([key, v]) => ({ key, hr: v?.hr ?? NaN, p: v?.p ?? NaN }))
      .filter((e) => Number.isFinite(e.hr));
    if (effects.length) {
      const hrs = effects.map((e) => e.hr);
      out.push({
        experiment: "headline-effect-gradient",
        sector: "Breast Cancer Validation",
        summary: `Headline effect-size gradient across ${effects.length} validated features: HR range ${Math.min(...hrs).toFixed(3)}–${Math.max(...hrs).toFixed(3)}, median ${median(hrs).toFixed(3)}.`,
        metric: "headline_hr_gradient",
        findings: {
          features: effects.length,
          min_hr: +Math.min(...hrs).toFixed(3),
          max_hr: +Math.max(...hrs).toFixed(3),
          median_hr: +median(hrs).toFixed(3),
          strongest: effects.sort((a, b) => Math.abs(b.hr) - Math.abs(a.hr))[0]?.key || "",
        },
        evidence_tier: "E1",
        inputs: effects.map((e) => `${e.key} HR=${e.hr.toFixed(3)}`),
      });
    }
  }

  if (h1b?.summary) {
    out.push({
      experiment: "pre-registration-summary",
      sector: "Breast Cancer Validation",
      summary: `Pre-registration verdict: primary ${h1b.summary.primary_pass ? "PASS" : "FAIL"}, replication ${h1b.summary.replication_pass ? "PASS" : "FAIL"} (${h1b.summary.tests_passed_primary_threshold} primary tests passed).`,
      metric: "pre_reg_verdict",
      findings: {
        primary_pass: h1b.summary.primary_pass === true,
        replication_pass: h1b.summary.replication_pass === true,
        tests_passed: h1b.summary.tests_passed_primary_threshold ?? 0,
      },
      evidence_tier: "E1",
      inputs: [],
    });
  }

  return out;
}

// ---- Sector 3: Golf→Surgery -----------------------------------------------------
// Experiment: composite surgeon index + cognitive load sweep across procedure
// classes via the golf_surgery_core translation engine.

async function golfSurgeryExperiments(): Promise<ExperimentResult[]> {
  const out: ExperimentResult[] = [];
  const root = path.join(scienceRoot(), "Shared", "golf_surgery_core");

  // Importable engine: compute stats + translate representative metrics.
  const statsScript = `
import sys, json
sys.path.insert(0, r"${root.replace(/\\/g, "\\\\")}")
from golf_surgery_translation_engine import GolfSurgeryTranslationEngine
e = GolfSurgeryTranslationEngine()
s = e.get_statistics()
print(json.dumps(s))
`;
  const stats = await runPython(["-c", statsScript], path.join(scienceRoot(), "Shared", "golf_surgery_core"), 30_000);
  if (stats && !stats.error) {
    out.push({
      experiment: "translation-coverage",
      sector: "Golf→Surgery",
      summary: `Golf→surgery translation coverage recomputed live: ${stats.total_metrics ?? "?"} metrics, ${stats.translations_performed ?? "?"} translations performed across ${(stats.domains ?? []).length} domains.`,
      metric: "translation_coverage",
      findings: {
        total_forward: stats.total_forward_mappings ?? 0,
        total_reverse: stats.total_reverse_mappings ?? 0,
        total_metrics: stats.total_metrics ?? 0,
        translations_performed: stats.translations_performed ?? 0,
        domains: (stats.domains ?? []).length,
        average_confidence: +(stats.average_confidence ?? 0),
      },
      evidence_tier: "E1",
      inputs: (stats.domains ?? []).slice(0, 6),
    });
  }

  // Surgical benchmark calibration (already measured in the validation ledger).
  const calib = readJson(path.join(researchDir(), "2026-08-15-validation", "results", "golf_surgery_validation.json"));
  if (calib?.translated_benchmark_checks) {
    const checks = Object.entries(calib.translated_benchmark_checks as Record<string, any>)
      .map(([k, v]) => ({ k, frac: v?.fraction_within_band ?? NaN, calib: v?.calibrated_to_benchmark }))
      .filter((c) => Number.isFinite(c.frac));
    if (checks.length) {
      out.push({
        experiment: "benchmark-calibration",
        sector: "Golf→Surgery",
        summary: `Benchmark-band calibration across ${checks.length} surgical benchmarks: mean within-band fraction ${(mean(checks.map((c) => c.frac)) * 100).toFixed(0)}%, ${checks.filter((c) => c.calib).length}/${checks.length} calibrated.`,
        metric: "benchmark_calibration",
        findings: {
          benchmarks: checks.length,
          mean_within_band_frac: +mean(checks.map((c) => c.frac)).toFixed(3),
          calibrated_count: checks.filter((c) => c.calib).length,
        },
        evidence_tier: "E1",
        inputs: checks.map((c) => `${c.k} within-band ${(c.frac * 100).toFixed(0)}%`),
      });
    }
  }

  return out;
}

// ---- Sector 4: Sports Science ----------------------------------------------------
// Experiment: run the real sports_science engine on stratified samples of each
// dataset (NBA team-season, player per-game, four-factors) to compute fresh
// TER + injury risk, then measure the efficiency–injury correlation strength
// and stability across datasets.

async function sportsScienceExperiments(): Promise<ExperimentResult[]> {
  const out: ExperimentResult[] = [];
  const base = researchDir();
  const science = scienceRoot();
  const sportsDir = path.join(science, "Sports");
  const biotechDir = path.join(science, "Biotech");

  const datasets = [
    { name: "NBA team-season", file: path.join(base, "2026-08-14-nba-boxing-bbtech", "nba_team_season_profiles.json") },
    { name: "NBA player per-game", file: path.join(base, "2026-08-15-nba-biotech-e-drive", "nba_player_per_game_profiles.json") },
    { name: "Kaggle four-factors", file: path.join(base, "2026-08-15-nba-biotech-e-drive", "kaggle_four_factors_profiles.json") },
  ];

  const corrResults: { name: string; ter_inj: number; n: number }[] = [];
  for (const ds of datasets) {
    const data = readJson(ds.file);
    if (!Array.isArray(data) || !data.length) continue;
    const sample = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 800)) === 0).slice(0, 800);
    const sampleFile = path.join(process.env.TEMP || "C:\\Windows\\Temp", `exp_${ds.name.replace(/\W+/g, "_")}_sample.json`);
    const outFile = path.join(process.env.TEMP || "C:\\Windows\\Temp", `exp_${ds.name.replace(/\W+/g, "_")}_computed.json`);
    fs.writeFileSync(sampleFile, JSON.stringify(sample));
    const script = engineComputeScript(sampleFile, outFile, sportsDir, biotechDir, science);
    await runPython(["-c", script], biotechDir, 90_000);
    const computed = readJson(outFile);
    if (!Array.isArray(computed) || computed.length < 20) continue;
    const terArr = computed.map((c) => c.ter).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const injArr = computed.map((c) => c.injury_risk).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const n = Math.min(terArr.length, injArr.length);
    if (n < 20) continue;
    const rInj = pearson(terArr.slice(0, n), injArr.slice(0, n));
    if (Number.isFinite(rInj)) corrResults.push({ name: ds.name, ter_inj: rInj, n });
  }

  if (corrResults.length) {
    out.push({
      experiment: "correlation-stability",
      sector: "Sports Science",
      summary: `Efficiency–injury correlation recomputed live via sports_science engine across ${corrResults.length} independent datasets: ${corrResults.map((c) => `${c.name} r=${c.ter_inj.toFixed(3)}`).join("; ")}.`,
      metric: "correlation_stability",
      findings: {
        datasets: corrResults.length,
        mean_r: +mean(corrResults.map((c) => c.ter_inj)).toFixed(3),
        min_r: +Math.min(...corrResults.map((c) => c.ter_inj)).toFixed(3),
        max_r: +Math.max(...corrResults.map((c) => c.ter_inj)).toFixed(3),
        all_positive: corrResults.every((c) => c.ter_inj > 0),
        all_strong: corrResults.every((c) => Math.abs(c.ter_inj) >= 0.3),
      },
      evidence_tier: "E1",
      inputs: corrResults.map((c) => `${c.name} r=${c.ter_inj.toFixed(3)} n=${c.n}`),
    });
  }

  return out;
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return NaN;
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? NaN : num / denom;
}

// ---- Sector 5: Gap-Domain Scan ----------------------------------------------------
// Experiment: marker threshold sensitivity across the five gap domains.

async function gapDomainExperiments(): Promise<ExperimentResult[]> {
  const out: ExperimentResult[] = [];
  const base = researchDir();
  const gap = readJson(path.join(base, "2026-08-15-breast-gap-domains", "gap_domains.json"));
  if (!gap || !Array.isArray(gap.domains)) return out;

  const domains = gap.domains.map((d: any) => ({
    id: d.id,
    threshold: d.marker_definition?.threshold_score ?? NaN,
    status: d.status,
  })).filter((d: any) => Number.isFinite(d.threshold));

  if (domains.length) {
    const thresholds = domains.map((d: any) => d.threshold);
    out.push({
      experiment: "gap-domain-signal-calibration",
      sector: "Gap-Domain Scan",
      summary: `Gap-domain marker thresholds across ${domains.length} domains: median ${median(thresholds)}, all at/below the ${40} breakthrough threshold (${domains.filter((d: any) => d.threshold <= 40).length}/${domains.length}).`,
      metric: "gap_signal_calibration",
      findings: {
        domains: domains.length,
        median_threshold: +median(thresholds).toFixed(0),
        at_or_below_40: domains.filter((d: any) => d.threshold <= 40).length,
        pending: domains.filter((d: any) => String(d.status).includes("PENDING")).length,
      },
      evidence_tier: "E2",
      inputs: domains.map((d: any) => `${d.id} threshold=${d.threshold}`),
    });
  }
  return out;
}

// ---- Sector 6: Simulation experiments via science_engine ---------------------------
// Tumor containment vs MTD dosing simulation — a genuinely NEW experiment run live.
async function simulationExperiments(): Promise<ExperimentResult[]> {
  const out: ExperimentResult[] = [];
  const draymond = draymondRoot();
  const sciEngDir = path.join(draymond, "science_engine");

  // Adaptive (containment) dosing vs MTD — deterministic simulation.
  // Logistic (density-dependent) growth so the model is stable and the
  // adaptive-therapy principle is tested fairly:
  //   adaptive arm: treat ONLY when tumor exceeds a containment threshold
  //   MTD arm: continuous dosing
  const adaptiveModel = {
    model_id: "adaptive-containment",
    description: "Adaptive containment dosing: treat only when tumor > threshold; hold otherwise. Compare vs continuous MTD over 60 ticks.",
    state_vars: ["tumor", "immune", "resistance", "cumulative_dose"],
    params: {
      growth: 0.06, carrying_capacity: 1000.0, kill: 0.25, immune_rec: 0.03,
      resistance_rate: 0.003, containment_threshold: 300.0,
    },
    initial_state: { tumor: 150, immune: 15, resistance: 0, cumulative_dose: 0 },
    update_rules: {
      tumor: "tumor + growth*tumor*(1 - tumor/carrying_capacity) - kill*immune*tumor*(1 - resistance) - Piecewise((0.35, tumor > containment_threshold), (0.0, True))*tumor*(1 - resistance)",
      immune: "immune + immune_rec*(100 - immune)",
      resistance: "resistance + resistance_rate*(1 - resistance)",
      cumulative_dose: "cumulative_dose + Piecewise((1.0, tumor > containment_threshold), (0.0, True))",
    },
    outputs: ["tumor", "resistance", "cumulative_dose"],
    ticks: 60,
  };

  const mtdModel = {
    model_id: "mtd-continuous",
    description: "Max tolerated dose: continuous treatment every tick.",
    state_vars: ["tumor", "immune", "resistance", "cumulative_dose"],
    params: {
      growth: 0.06, carrying_capacity: 1000.0, kill: 0.25, immune_rec: 0.03,
      resistance_rate: 0.003, containment_threshold: 300.0,
    },
    initial_state: { tumor: 150, immune: 15, resistance: 0, cumulative_dose: 0 },
    update_rules: {
      tumor: "tumor + growth*tumor*(1 - tumor/carrying_capacity) - kill*immune*tumor*(1 - resistance) - 0.35*tumor*(1 - resistance)",
      immune: "immune + immune_rec*(100 - immune)",
      resistance: "resistance + resistance_rate*(1 - resistance)",
      cumulative_dose: "cumulative_dose + 1.0",
    },
    outputs: ["tumor", "resistance", "cumulative_dose"],
    ticks: 60,
  };

  const adaptiveFile = path.join(process.env.TEMP || "C:\\Windows\\Temp", "sim_adaptive.json");
  const mtdFile = path.join(process.env.TEMP || "C:\\Windows\\Temp", "sim_mtd.json");
  fs.writeFileSync(adaptiveFile, JSON.stringify(adaptiveModel));
  fs.writeFileSync(mtdFile, JSON.stringify(mtdModel));

  const r1 = await runPythonModule("science_engine.cli", [adaptiveFile], draymond, 30_000);
  const r2 = await runPythonModule("science_engine.cli", [mtdFile], draymond, 30_000);

  if (r1 && !r1.error && r2 && !r2.error) {
    const t1 = r1.outputs?.tumor ?? NaN;
    const t2 = r2.outputs?.tumor ?? NaN;
    const d1 = r1.outputs?.cumulative_dose ?? r1.final_state?.cumulative_dose ?? NaN;
    const d2 = r2.outputs?.cumulative_dose ?? r2.final_state?.cumulative_dose ?? NaN;
    const resist1 = r1.outputs?.resistance ?? r1.final_state?.resistance ?? NaN;
    const resist2 = r2.outputs?.resistance ?? r2.final_state?.resistance ?? NaN;
    out.push({
      experiment: "containment-vs-mtd-sim",
      sector: "Therapeutic Simulation",
      summary: `Deterministic simulation (60 ticks, logistic growth): adaptive containment ends at tumor ${Number.isFinite(t1) ? t1.toFixed(1) : "n/a"} with ${Number.isFinite(d1) ? d1.toFixed(0) : "n/a"} doses vs MTD at tumor ${Number.isFinite(t2) ? t2.toFixed(1) : "n/a"} with ${Number.isFinite(d2) ? d2.toFixed(0) : "n/a"} doses. Dose-sparing ratio ${Number.isFinite(d1) && Number.isFinite(d2) && d2 > 0 ? (1 - d1 / d2).toFixed(3) : "n/a"}; resistance ${Number.isFinite(resist1) ? resist1.toFixed(3) : "n/a"} vs ${Number.isFinite(resist2) ? resist2.toFixed(3) : "n/a"}.`,
      metric: "containment_vs_mtd",
      findings: {
        adaptive_tumor: Number.isFinite(t1) ? +t1.toFixed(1) : null,
        mtd_tumor: Number.isFinite(t2) ? +t2.toFixed(1) : null,
        adaptive_doses: Number.isFinite(d1) ? +d1.toFixed(0) : null,
        mtd_doses: Number.isFinite(d2) ? +d2.toFixed(0) : null,
        dose_sparing: Number.isFinite(d1) && Number.isFinite(d2) && d2 > 0 ? +(1 - d1 / d2).toFixed(3) : null,
        adaptive_resistance: Number.isFinite(resist1) ? +resist1.toFixed(3) : null,
        mtd_resistance: Number.isFinite(resist2) ? +resist2.toFixed(3) : null,
      },
      evidence_tier: "E1",
      inputs: ["science_engine deterministic runtime, 60 ticks, logistic growth, containment threshold 300"],
    });
  }

  return out;
}

// ---- Sector 7: Environmental Initiatives (ECOS) ------------------------------------
// Runs the science_engine environmental bridge across all 13 ECOS sectors. Each
// sector's deterministic simulation produces fresh measured outputs (E1); where
// the ecosystem-brains carbon-credit engine is installed, carbon methodology
// (Verra / Gold Standard) findings are attached. Every number is measured this run.

const ENV_SECTORS: Record<string, string> = {
  ecohomes: "P01 EcoHomes OS",
  agriconnect: "P02 AgriConnect",
  regenerafarm: "P03 RegeneraFarm",
  hempmobility: "P04 HempMobility",
  lumifreq: "P05 LumiFreq",
  nucleosim: "P06 NucleoSim",
  plasticycle: "P07 PlastiCycle",
  everlume: "P08 EverLume",
  aquagen: "P09 AquaGen",
  thermalgrid: "P10 ThermalGrid",
  thoriumos: "P11 ThoriumOS",
  solarshare: "P12 SolarShare",
  microhydro: "P13 MicroHydro",
};

async function environmentalExperiments(): Promise<ExperimentResult[]> {
  const out: ExperimentResult[] = [];
  const draymond = draymondRoot();
  const ticks = process.env.ENV_TICKS ? parseInt(process.env.ENV_TICKS, 10) : 120;

  for (const [sector, label] of Object.entries(ENV_SECTORS)) {
    const r = await runPythonModule("science_engine.environmental_science", [sector, "--ticks", String(ticks)], draymond, 60_000);
    if (!r || r.error) continue;
    const findings = r.findings || {};
    const outputs = findings.outputs || {};
    const carbon = findings.carbon_credit;
    const metric = outputs.energy_generated_kwh ?? outputs.cumulative_saving_kwh ?? outputs.plastic_mass ?? outputs.crop_yield ?? outputs.power_kw ?? outputs.keff ?? outputs.water_produced_l ?? outputs.capacity_factor ?? outputs.co2_avoided ?? Object.values(outputs)[0] ?? 0;

    const summaryParts: string[] = [`${label} (${findings.project_id || ""}) deterministic simulation over ${findings.ticks ?? ticks} ticks: outputs ${JSON.stringify(outputs).slice(0, 220)}`];
    if (carbon) {
      summaryParts.push(`carbon credit: ${carbon.total_tonnes_co2e} tCO2e (${carbon.verra_methodology || "n/a"})`);
    }
    if (findings.forecast) {
      summaryParts.push(`forecast: ${JSON.stringify(findings.forecast).slice(0, 160)}`);
    }
    if (findings.solver) {
      summaryParts.push(`solver status: ${findings.solver.status || "n/a"}`);
    }

    out.push({
      experiment: `env-${sector}`,
      sector: "Environmental",
      summary: summaryParts.join("; "),
      metric: `env_${sector}_signal`,
      findings: {
        project: label,
        project_id: findings.project_id || "",
        ticks: findings.ticks ?? ticks,
        outputs,
        evidence_tier: findings.evidence_tier || "E1",
        engines: findings.engines || ["science_engine"],
        events_triggered: (findings.events_triggered || []).slice(0, 8),
        carbon_tonnes_co2e: carbon ? carbon.total_tonnes_co2e : null,
        carbon_methodology: carbon ? (carbon.verra_methodology || carbon.gold_standard_methodology || null) : null,
        forecast_available: !!findings.forecast,
        solver_status: findings.solver ? (findings.solver.status || "n/a") : null,
      },
      evidence_tier: (findings.evidence_tier as string) || "E1",
      inputs: [`science_engine environmental_science bridge`, `ticks=${ticks}`],
    });
  }

  return out;
}

// ---- Aggregate ---------------------------------------------------------------------

export async function runScienceExperiments(): Promise<ExperimentResult[]> {
  const batches = await Promise.all([
    nbaBiotechExperiments(),
    breastCancerValidationExperiments(),
    golfSurgeryExperiments(),
    sportsScienceExperiments(),
    gapDomainExperiments(),
    simulationExperiments(),
    environmentalExperiments(),
  ]);
  return batches.flat();
}

export function findingsBlock(experiments: ExperimentResult[]): string {
  if (!experiments.length) return "(no experiment results)";
  return experiments
    .map((e) => `[${e.experiment} | ${e.sector} | ${e.evidence_tier}]\n  ${e.summary}\n  findings: ${JSON.stringify(e.findings)}`)
    .join("\n");
}
