// Ecosystem manual — the source of truth for the interactive explainer on
// overlay365.org. Every claim here traces to a repo README, AGENTS.md, STATUS
// doc, or audit file. Status is deliberately honest: "live" means deployed,
// tested code; "development" means active but unfinished; "concept" means
// design docs and prototypes only. Do not upgrade a status without evidence.
//
// The "overview" and "architecture" fields carry the deep explanation. They
// are written to survive scrutiny: fabricated or quarantined outputs are
// named as such, not laundered into marketing copy.

export type ManualStatus = 'live' | 'development' | 'concept';

export interface ManualComponent {
  name: string;
  /** One-line summary shown collapsed. */
  description: string;
  /** Deeper explanation shown when the component is expanded. */
  detail: string;
}

export interface ManualArchitectureLayer {
  name: string;
  role: string;
  detail: string;
}

export interface ManualSite {
  id:
    | 'health'
    | 'wealth'
    | 'justice'
    | 'bbtech'
    | 'hempforge'
    | 'oncology'
    | 'fieldbridge'
    | 'recourse'
    | 'ecos';
  name: string;
  shortName: string;
  tagline: string;
  mission: string;
  status: ManualStatus;
  statusNote: string;
  /** Public URL, when one exists. Concept systems have none yet. */
  url?: string;
  /** Brand mark served from public/brands/. */
  logo?: string;
  /** Accent keys match lib/site.ts: teal = health/sport, gold = wealth/materials, cyan = justice/science. */
  accent: 'teal' | 'gold' | 'cyan';
  /** Deep-dive prose. Each entry is a paragraph. */
  overview: string[];
  /** How the pieces fit together, top to bottom. */
  architecture: ManualArchitectureLayer[];
  components: ManualComponent[];
  /** How this site plugs into the wider Overlay365 ecosystem. */
  connections: string[];
  /** What is actually built and verifiable. */
  real: string[];
  /** What is planned, prototyped, or quarantined. Never present this as shipped. */
  planned: string[];
}

export const MANUAL_SITES: ManualSite[] = [
  {
    id: 'health',
    name: 'Overlay Health',
    shortName: 'Health',
    tagline: 'A culturally-rooted personal wellness OS.',
    mission:
      'Provide actionable tools to manage personal wellness, advocate for better care, and close health disparity gaps — rooted in ancestral nutrition and heritage remedies.',
    status: 'live',
    statusNote:
      'Deployed (uplift-health.vercel.app) with a Docker/Render blueprint, tests, and a fully rule-based engine — no AI keys required.',
    url: 'https://uplift-health.vercel.app',
    logo: '/brands/health.webp',
    accent: 'teal',
    overview: [
      'Overlay Health is a personal wellness operating system built for Black individuals and rooted in ancestral nutrition, structured fitness, botanical remedies, and heritage practice. It is deliberately not an AI product: the whole experience — assessment, dashboard, meal prep, fitness, herbal index, and the printable book — is computed by a local deterministic rulebook and plan-composer. The same inputs always produce the same plan, which makes the system auditable and free to run.',
      'The design choice matters. A rule-based engine can be read, tested, and explained; a model cannot promise the same reproducibility. That is why Health runs without any Gemini or model endpoint, and why it ships as a free, no-card experience.',
      'The platform shares one Overlay365 identity with the rest of the ecosystem. Its current integration point is the ecosystem event ledger: activity is emitted to the hub and converted into points, though Health still uses an ecosystem key rather than a full token session.',
    ],
    architecture: [
      {
        name: 'Health Assessment',
        role: 'Structured intake',
        detail: 'Collects the baseline — goals, constraints, and history — that every downstream module reads from. Nothing is generated until the assessment is complete.',
      },
      {
        name: 'Deterministic Rulebook + Plan Composer',
        role: 'The engine',
        detail: 'The DETERMINISTIC_RULEBOOK encodes the decision rules and the plan-composer assembles them into a concrete plan. This is the core of the system and the reason no AI keys are needed.',
      },
      {
        name: 'Domain Modules',
        role: 'Delivery',
        detail: 'Meal prep, fitness programs, and the herbal index each render the plan for their domain, drawing on ancestral-nutrition and heritage-remedy reference data.',
      },
      {
        name: 'Personal Dashboard',
        role: 'Tracking',
        detail: 'Tracks progress against the generated plan over time.',
      },
      {
        name: 'Printable Book',
        role: 'Export',
        detail: 'Exports the full plan for offline use — important for users without reliable device access.',
      },
      {
        name: 'Ecosystem Bridge',
        role: 'Integration',
        detail: 'Emits activity to the hub event ledger using an ecosystem key, which is converted into ecosystem points.',
      },
    ],
    components: [
      {
        name: 'Health Assessment',
        description: 'Structured intake that establishes the baseline before any plan is generated.',
        detail: 'Captures the inputs the rulebook needs. Because the engine is deterministic, the quality of the assessment directly bounds the quality of the plan — there is no model to "fill gaps".',
      },
      {
        name: 'Deterministic Health Engine',
        description: 'Plans are computed by a local rulebook and plan-composer — same inputs, same plan.',
        detail: 'The DETERMINISTIC_RULEBOOK and plan-composer are the single source of truth for every plan. No model, no randomness, no rate-limited endpoint. This is what makes the free tier sustainable and the output auditable.',
      },
      {
        name: 'Personal Dashboard',
        description: 'Tracks progress against the generated plan.',
        detail: 'Progress surface for the plan; keeps the user oriented without introducing scoring that the engine cannot justify.',
      },
      {
        name: 'Meal Prep',
        description: 'Ancestral-nutrition-driven meal planning built off the assessment.',
        detail: 'Derives meal structure from the assessment and heritage nutrition references rather than generic diet templates.',
      },
      {
        name: 'Fitness Programs',
        description: 'Structured, goal-aligned training blocks.',
        detail: 'Goal-aligned training blocks generated from the same rulebook, so fitness and nutrition stay consistent with one plan.',
      },
      {
        name: 'Herbal Index',
        description: 'Heritage remedies reference tied into the rulebook.',
        detail: 'A reference of heritage remedies that the rulebook can draw on; it is reference material, not a clinical recommendation.',
      },
      {
        name: 'Printable Book',
        description: 'The whole plan exported for offline use.',
        detail: 'Produces a portable version of the plan for users who need it away from a screen.',
      },
    ],
    connections: [
      'Shares one Overlay365 identity with the hub, Wealth, and Justice (single Supabase project).',
      'Publishes research items into Overlay Global Lens through the Overlay Science desk.',
    ],
    real: [
      'Assessment → plan → dashboard flow.',
      'Deterministic rulebook and plan-composer.',
      'Herbal index and printable export.',
    ],
    planned: [
      'Full ledger-based points integration (un-repointed platforms emit with an ecosystem key today).',
    ],
  },
  {
    id: 'wealth',
    name: 'Overlay Wealth',
    shortName: 'Wealth',
    tagline: 'Interactive financial education, beginner to expert.',
    mission:
      'Deliver strategies and resources for financial literacy, economic growth, and generational wealth through courses, simulators, and gamified learning.',
    status: 'live',
    statusNote:
      'Deployed (uplift-wealth.vercel.app) with 1,824 tests across 83 files, a Vite frontend, and an Express API. Note: the file-backed store is ephemeral on Render without a persistent disk.',
    url: 'https://uplift-wealth.vercel.app',
    logo: '/brands/wealth.webp',
    accent: 'gold',
    overview: [
      'Overlay Wealth is a full-stack financial literacy platform that teaches modern money end to end — banking, payments, credit, stocks, insurance, crypto, DeFi, regulatory compliance, AI in finance, and embedded finance — through 15 modules, wealth-building chapters, simulations, and games.',
      'It is one of the more thoroughly tested platforms in the ecosystem: 1,824 unit and integration tests across 83 files, TypeScript strict, and a verify script that chains typecheck, build, and test.',
      'The architecture is a Vite single-page frontend over an Express API backed by a file-backed JSON store. That store is the platform\'s main operational caveat — on Render it is ephemeral unless a persistent disk or a Postgres migration is added.',
    ],
    architecture: [
      {
        name: 'Curriculum Data',
        role: 'Content',
        detail: 'Fifteen modules and 80+ lessons, plus a library of lecture class plans, authored as data so the viewer stays generic.',
      },
      {
        name: 'Module Viewer',
        role: 'Learning surface',
        detail: 'Renders lessons with KaTeX math, Mermaid sequence diagrams, React Flow architecture diagrams, and Markmap mind maps.',
      },
      {
        name: 'Interactive Games',
        role: 'Practice',
        detail: 'Five games: a stock trading simulator (Zustand store), underwriting, parametric insurance, fraud detection, and a Millionaire-style pop quiz.',
      },
      {
        name: 'Quant Toolkit',
        role: 'Analytics',
        detail: 'Black-Scholes options pricing, modern portfolio theory optimization, and risk analytics (Sharpe, Sortino, VaR) implemented as pure utilities.',
      },
      {
        name: 'Gamification Layer',
        role: 'Motivation',
        detail: 'XP, levels, badges, streaks, and progress tracking layered over the curriculum.',
      },
      {
        name: 'Express API + Store',
        role: 'Backend',
        detail: 'Serves the app with a per-IP rate limiter (120 req/min) and a file-backed JSON database that must be made durable for production.',
      },
    ],
    components: [
      {
        name: '15-Module Curriculum',
        description: 'Banking through embedded finance, beginner to expert.',
        detail: 'The core content spine. Modules are authored as data, which keeps the lesson viewer generic and lets new material be added without touching rendering code.',
      },
      {
        name: 'Stock Trading Simulator',
        description: 'Zustand-backed simulator with synthetic fallback.',
        detail: 'Uses real quotes when an Alpha Vantage key is configured and falls back to synthetic data otherwise, so the simulator never blocks on a missing key.',
      },
      {
        name: 'Four More Games',
        description: 'Underwriting, parametric insurance, fraud detection, and a pop quiz.',
        detail: 'Each game targets a different decision skill, turning the curriculum into practice rather than passive reading.',
      },
      {
        name: 'Quant Toolkit',
        description: 'Black-Scholes, MPT, and risk analytics.',
        detail: 'Real, tested implementations of standard models — the same math a professional would use, made approachable through the lesson layer.',
      },
      {
        name: 'Gamification Layer',
        description: 'XP, levels, badges, streaks, and progress.',
        detail: 'Progress is persisted per user and drives the streaks and badge system.',
      },
      {
        name: 'Diagram Engine',
        description: 'KaTeX, Mermaid, React Flow, and Markmap.',
        detail: 'A shared rendering stack so lessons can express math, sequences, architecture, and concept maps without bespoke components.',
      },
    ],
    connections: [
      'Shares the ecosystem identity and points ledger with the hub and sibling platforms.',
      'Feeds research and trend items into Overlay Global Lens.',
    ],
    real: [
      '15 modules and 80+ lessons.',
      '5 interactive games and the quant toolkit.',
      '1,824 passing unit/integration tests.',
    ],
    planned: [
      'Durable state (move from file-backed store to Postgres or a Render persistent disk).',
    ],
  },
  {
    id: 'justice',
    name: 'Overlay Justice',
    shortName: 'Justice',
    tagline: 'Pro se legal AI — deterministic and auditable.',
    mission:
      'Equip people to navigate the legal system, advocate for their rights, and drive systemic fairness — intake a case, understand the law, prepare documents, and export a professional package.',
    status: 'live',
    statusNote:
      'Deployed with a paid flow: $5 per case via Stripe Checkout, one-time, no subscription. All analysis is deterministic and auditable; AI is optional and limited to OCR/translation.',
    url: 'https://uplift-justice.vercel.app',
    logo: '/brands/justice.webp',
    accent: 'cyan',
    overview: [
      'Overlay Justice is a browser-based legal self-help application for self-represented litigants and lawyers. It walks a case from raw documents to a professional, exportable case package: intake, procedural analysis, legal research, document drafting, discovery, and a trial binder.',
      'The design principle is auditable determinism. The procedural engine and research pipeline are rule-based, so a user can see exactly why a deadline, fee, or filing was suggested. The only AI dependency is an optional Gemini key for OCR and translation — it is not in the reasoning path.',
      'The procedural engine ships hand-authored rule packs for a growing set of states, with all 50 states plus DC and Federal covered at the library level. Where a state lacks a deep hand-authored pack, the engine falls back to federal guidelines and flags the result as an estimate rather than pretending to certainty.',
    ],
    architecture: [
      {
        name: 'Case Intake & OCR',
        role: 'Ingestion',
        detail: 'Accepts uploaded or pasted documents and extracts parties, dates, categories, defenses, and a timeline. OCR uses an optional Gemini key; without it, pasted text still works.',
      },
      {
        name: 'Procedural Engine',
        role: 'Rules',
        detail: 'Court-specific rule packs produce answer deadlines, filing fees, IFP eligibility, statute-of-limitations warnings, suggested filings, and a calendar (.ics) export. Missing packs fall back to federal guidance, flagged as estimates.',
      },
      {
        name: 'Research Lab & Citator',
        role: 'Authority',
        detail: 'A deterministic pipeline maps issues, discovers cases/statutes/rules, verifies authority with the live CourtListener citator, and formats Bluebook-style citations.',
      },
      {
        name: 'Document Assembly',
        role: 'Drafting',
        detail: 'Produces the IRAC memorandum, issues statement, theory of the case, and a persuasive case brief in Markdown and PDF.',
      },
      {
        name: 'Discovery & Trial Binder',
        role: 'Preparation',
        detail: 'Generates RFPs, RFAs, and interrogatories, a witness matrix and declarations, an exhibit register, and a Bates-numbered trial binder with a visual timeline.',
      },
      {
        name: 'Export',
        role: 'Output',
        detail: 'Packages everything into a ZIP (pleading, memo, procedural analysis, spreadsheets) plus a 28-line pleading-paper PDF.',
      },
    ],
    components: [
      {
        name: 'Case Intake & OCR',
        description: 'Extract parties, dates, categories, defenses, and a timeline.',
        detail: 'The entry point for every case. Deterministic extraction keeps the rest of the pipeline explainable; OCR is the only optional AI touchpoint.',
      },
      {
        name: 'Procedural Engine',
        description: 'Court-specific rule packs for 50 states + DC + Federal.',
        detail: 'The most jurisdiction-sensitive part of the system. It is explicit about its limits: non-hand-authored states return federal fallback guidance labeled as estimates.',
      },
      {
        name: 'Research Lab & Citator',
        description: 'Issue mapping, authority discovery, and CourtListener-verified citations.',
        detail: 'Verifies that cited authority is still good law using the live CourtListener citator, and formats citations in Bluebook style.',
      },
      {
        name: 'IRAC Memorandum',
        description: 'Per-issue Issue/Rule/Analysis/Conclusion memo.',
        detail: 'Bundled into the case package so the reasoning behind the documents is visible.',
      },
      {
        name: 'Case Documents',
        description: 'Issues statement, theory of the case, and persuasive brief.',
        detail: 'Draft court documents in Markdown and PDF, ready for a user or attorney to review and refine.',
      },
      {
        name: 'Discovery & Trial Binder',
        description: 'Discovery requests, witness matrix, and a Bates-numbered binder.',
        detail: 'Covers the preparation phase — the part of litigation that most often overwhelms self-represented litigants.',
      },
    ],
    connections: [
      'Shares the ecosystem identity with the hub and sibling platforms.',
      'Feeds legal-policy research into Overlay Global Lens.',
    ],
    real: [
      'Deterministic procedural and research pipeline.',
      '50-state statute library with real anchors.',
      'CourtListener citator and ZIP/PDF export.',
    ],
    planned: [
      'Deep hand-authored rule packs for remaining states (currently federal fallback).',
      'AI features beyond OCR/translation.',
    ],
  },
  {
    id: 'bbtech',
    name: 'Overlay BBTech',
    shortName: 'BBTech',
    tagline: 'A validated transcriptomic signature — with a basketball analogy on top.',
    mission:
      'Use basketball analytics as a structured modeling language for biological and clinical research, making systems biology accessible, reproducible, and actionable.',
    status: 'development',
    statusNote:
      'Two different halves. A real, pre-registered transcriptomic signature has been run on real cohorts (METABRIC, TCGA, PanCancer, GSE20685) with published effect sizes and honest nulls. The basketball framing around it is a labeled analogy (E3), not a model. An earlier self-awarded "100/100" grade was retracted in September 2026.',
    url: 'https://bbtech.overlay365.online',
    logo: '/brands/bbtech.webp',
    accent: 'teal',
    overview: [
      'BBTech began as an idea: use basketball as a formal modeling language for biology. Elite players become disease archetypes, game systems become experimental protocols. As a conceptual framework it is extensive — nine archetypes and seven playbook volumes. But that framing is presentation, not method, and it is now labeled as an analogy rather than a model.',
      'Underneath the framing there is a real research program. A five-module transcriptomic signature — proliferation, invasion, immune, angiogenesis, apoptosis — is scored per sample and tested for incremental prognostic value over a clinical baseline. The pipeline is pre-registered, uses real public cohorts, and reports effect sizes with confidence intervals.',
      'The results are real and deliberately modest. Across five cohorts the pooled random-effects incremental C-index is +0.032 [0.008, 0.056] (I²=54%). It replicated in one genuinely independent cohort — GSE20685 (Taiwan, Affymetrix), ΔC +0.145 [0.061, 0.233], p=0.003 — and produced honest nulls along the way, including TCGA ER+ OS where the interval includes zero. The project claims no cure, no clinical tool, and no peer review.',
      'The sports side is real in exactly one way: a win-probability model is backtested against real NBA closing money lines. It loses to the market — model C-index 0.639 versus the market\'s 0.748 — and that negative result is reported rather than hidden.',
      'BBTech also has a documented theater history. The legacy tree contained a synthetic "Phase 1 Validation Report", fake Polygon transaction hashes, random-number "Monte Carlo" SVIs, and invented r²/p-values. Those artifacts are quarantined and marked, and an earlier self-awarded "100/100" grade was retracted. What remains is the part that survives an external comparator.',
    ],
    architecture: [
      {
        name: 'Transcriptomic Signature',
        role: 'REAL',
        detail: 'Five a priori gene modules (proliferation, invasion, immune, angiogenesis, apoptosis) scored per sample from real expression data. This is the object that is actually validated.',
      },
      {
        name: 'Survival & Validation Pipeline',
        role: 'REAL',
        detail: 'Cox models against a clinical baseline, bootstrap incremental C-index (ΔC) with confidence intervals, cross-platform harmonization, fixed/random-effects meta-analysis, decision-curve analysis, and FDR. Pre-registered per hypothesis.',
      },
      {
        name: 'Real Cohorts',
        role: 'REAL data',
        detail: 'METABRIC (2509 patients, via cBioPortal), TCGA (1101) and PanCancer, plus the independent GSE20685 (Taiwan, Affymetrix). Acquired through the cBioPortal API with a committed provenance manifest.',
      },
      {
        name: 'Sports Model + Market Benchmark',
        role: 'REAL comparator',
        detail: 'A win-probability and totals model backtested against real NBA closing lines and player game logs, with block-bootstrap ROI. The comparator is the betting market, and the model currently loses to it.',
      },
      {
        name: 'Evidence Governance',
        role: 'Infrastructure',
        detail: 'The overlay_evidence package assigns a tier (E0–E4) to every value and gate_clinical() blocks E3/E4 from clinical use. A missing dataset raises ProvenanceError instead of falling back to synthetic data.',
      },
      {
        name: 'Sports→Oncology Analogy',
        role: 'E3 analogy',
        detail: 'The player→disease mapping, Codex metrics, and translation engine. Deterministic and reproducible, but rhetorical: it carries no tier above E3 and is consumed by nothing that produces a result.',
      },
      {
        name: 'Quarantined Legacy',
        role: 'Removed',
        detail: 'The fabricated validation report, fake Polygon bridge, random-number SVI, and invented frontend data. Documented in 08_Archive/bbtech-theater-2026-09-16/QUARANTINE.md and marked in-tree.',
      },
    ],
    components: [
      {
        name: 'Five-Module Signature',
        description: 'The validated object: a per-sample transcriptomic score.',
        detail: 'Proliferation, invasion, immune, angiogenesis, and apoptosis modules built from a fixed gene list. The modules are standard biology; the "sports translation" attached to them is not part of the validation.',
      },
      {
        name: 'Pre-Registered Validation',
        description: 'Hypotheses locked before analysis, with ΔC and CIs.',
        detail: 'Each cohort test has a pre-registration file. Effect sizes are reported with bootstrap confidence intervals, and the pass criteria (ΔC ≥ 0.02, CI excludes zero, LR p < 0.05) were fixed in advance.',
      },
      {
        name: 'Independent Replication',
        description: 'GSE20685 — a different country and platform.',
        detail: 'The strongest result: an independent Taiwanese Affymetrix cohort reproduced the incremental value (ΔC +0.145 [0.061, 0.233], p=0.003). Its larger ΔC reflects a weak age-only baseline, which the report states plainly.',
      },
      {
        name: 'Sports Market Benchmark',
        description: 'Win-probability model vs real NBA money lines.',
        detail: 'The honest headline is a loss: model C-index 0.639 against a market C-index of 0.748. The value is that the comparator is real, so the negative result is meaningful.',
      },
      {
        name: 'Evidence Tiers',
        description: 'E0–E4 governance with a clinical gate.',
        detail: 'Every metric carries a tier and a provenance record. Analogy outputs are E3 and blocked from clinical gating; a null result is now E2, not E1 (an earlier version inflated this).',
      },
      {
        name: 'Pathogen Archetypes & Playbooks',
        description: 'The analogy layer — nine archetypes, seven volumes.',
        detail: 'Curry as a virus, Jordan as a malignant system, Draymond as the immune coordinator, and so on. It is a pedagogical analogy with defined metrics; only a keyword matcher uses it in code. Never a result.',
      },
      {
        name: 'Quarantined Artifacts',
        description: 'Fabricated outputs, retained only as reference.',
        detail: 'The synthetic Phase 1 Validation Report, the SHA-256-as-"tx hash" Polygon bridge, random-number Monte Carlo, and invented r²/p-values. Quarantined, marked in-tree, and excluded from every product surface.',
      },
    ],
    connections: [
      'Feeds sport-science research items into Overlay Global Lens (Overlay Sport desk).',
      'Shares biomolecular subject matter with Overlay Oncology research.',
    ],
    real: [
      'A pre-registered five-module transcriptomic signature replicated across METABRIC, TCGA, PanCancer, and GSE20685.',
      'Pooled random-effects ΔC +0.032 [0.008, 0.056]; independent GSE20685 ΔC +0.145 [0.061, 0.233].',
      'A real market-relative sports backtest (model C=0.639 vs market C=0.748), reported as a loss.',
      'Evidence-tier governance with a clinical gate that blocks E3/E4.',
    ],
    planned: [
      'A unified, deployed BBTech platform — none exists today.',
      'Generalization beyond breast cancer: the pan-cancer replication script is currently not reproducible end-to-end (stale path, missing output directory).',
      'External peer review — none has occurred.',
      'Physical relocation of the quarantined legacy trees.',
    ],
  },
  {
    id: 'hempforge',
    name: 'HempForge',
    shortName: 'HempForge',
    tagline: 'Compliance, COA verification, and a deterministic science kernel.',
    mission:
      'Operate a compliance and verification workspace for regulated hemp operations, backed by a deterministic scientific kernel so that every processing result is reproducible.',
    status: 'development',
    statusNote:
      'Two related codebases: HempForge (the compliance/COA front-end and integration hub) and Hemp-OS (the deterministic science kernel it calls). HempForge is the more mature and self-auditing of the two; the kernel\'s credibility claims outrun its current evidence.',
    url: 'https://hempforge.overlay365.online',
    logo: '/brands/hempforge.webp',
    accent: 'gold',
    overview: [
      'HempForge is two systems wearing one name. HempForge itself is a B2B compliance workspace for hemp testing labs, vertically-integrated brands, and compliance consultants: it ingests Certificates of Analysis, verifies them against regulatory thresholds, and keeps a tamper-evident audit trail. Hemp-OS is the deterministic scientific kernel behind it — a process-simulation engine that HempForge can cross-check COAs against.',
      'The distinction matters because it is easy to mistake HempForge for a simulator. It is not. HempForge is the compliance and integration layer: an Express API with 26 routers over a React SPA, using Firestore (with a dev-only local JSON fallback) and Supabase RLS migrations. Its relationship to science is through the kernel, which it calls over HTTP and records as an audit entry.',
      'What is genuinely built in HempForge is solid and unusually honest. The compliance engine does real math — total THC as THCa × 0.877 + Δ9-THC, North Carolina\'s 0.3% non-compliant and 0.25% at-risk lines, the FDA 0.4 mg/serving rule. The decision engine is a pure rule layer with no LLM in the loop. The audit ledger is a SHA-256 hash chain with sequence numbers and previous-hash links, and COAs carry HMAC-SHA256 signatures. The trend engine ingests live literature from PubMed, Europe PMC, Semantic Scholar, OpenAlex, bioRxiv, and CORE, and computes Mann-Kendall trends, Kleinberg-style burst detection, and Shannon-entropy cross-source agreement.',
      'It also documents its own weak points. A repository audit notes that the "BlackMind" scientific engines are injectable stubs, that the "swarm" debate is a single model call with role-conditioned prompts, that the 3D scene is a static node graph rather than a simulation, and that pricing is defined inconsistently between a Supabase migration and the application code.',
      'Hemp-OS is where the scientific ambition lives, and where the honesty gap opens. It contains a real deterministic kernel: four process models (extraction, decarboxylation, winterization, distillation) built on Fickian diffusion, Arrhenius kinetics, and Clausius-Clapeyron, with cited literature, unit conversion, input validation, and a topological workflow executor that enforces extraction → winterization → decarboxylation → distillation while tracking mass balance. It also ships a Python microservice with real Biopython, RDKit, and SciPy endpoints. But several claims do not survive inspection: the "benchmark certification" tests the kernel against its own outputs, the winterization constants are self-described engineering estimates, the energy balance is labeled a placeholder, the Hemp-DB corpus is explicitly marked synthetic, the "Lean 4 formal verification" is a string check, and the Hemp-Agent\'s "BigQuery/Neo4j" stores are in-memory arrays populated by simulated ingestion.',
      'So the correct reading is layered: HempForge\'s compliance layer is real and testable; the Hemp-OS kernel is a credible deterministic prototype with partially unvalidated constants; and the surrounding agent/verification theater should be treated as scaffolding until it is validated.',
    ],
    architecture: [
      {
        name: 'HempForge Front-End',
        role: 'UI',
        detail: 'A React 19 + Vite SPA with routes for intake, agent, vault, lab, workflows, and per-COA verification (/verify/:id).',
      },
      {
        name: 'Compliance & Decision Layer',
        role: 'Rules (no LLM)',
        detail: 'complianceEngine.ts does the threshold math (total THC, decarb kinetics fitted to Wang et al. 2016, FDA serving limits). decisionEngine.ts is a pure rule layer for batch release, alert severity, disposition, and GxP stage transitions. No model is involved.',
      },
      {
        name: 'Audit Ledger',
        role: 'Tamper-evidence',
        detail: 'A SHA-256 hash chain with sequenceNumber and previousHash, persisted across restarts, plus HMAC-SHA256 COA signatures. This is the system of record for verification.',
      },
      {
        name: 'Literature & Trend Intelligence',
        role: 'Ingest + analytics',
        detail: 'Live ingestion from six literature sources with real statistical trend math (Mann-Kendall, Kleinberg burst detection, Shannon entropy, z-score anomalies).',
      },
      {
        name: 'Deterministic Autonomy',
        role: 'Automation',
        detail: 'An 11-skill agent engine (ingest-literature, run-simulations, score-risk, verify-audit-chain, benchmark-experiments, and more) driven by a loop with no LLM in the cycle.',
      },
      {
        name: 'Hemp-OS Kernel (external)',
        role: 'Science',
        detail: 'Called via hempOsKernel.ts against /api/kernel/{verify,profiles,process}. If the kernel is unreachable the client reports "unavailable" and never fakes a passed check — a deliberate honest-degrade.',
      },
      {
        name: 'Integration Hub',
        role: 'Sidecars',
        detail: 'HTTP clients to ResearchClaw and mem0, a real Metrc v2 client (packages, on-hold, lab results), and Stripe billing.',
      },
      {
        name: 'Data & Tenancy',
        role: 'Storage',
        detail: 'A TenantRepository filters by tenantId at the storage layer; Firestore rules are deny-all; Supabase RLS keys off tenant claims.',
      },
    ],
    components: [
      {
        name: 'Hemp-OS Deterministic Kernel',
        description: 'Four cited process models with a topological workflow executor.',
        detail: 'Extraction (Fickian diffusion + Arrhenius), decarboxylation (first-order Arrhenius for THCA→THC, CBDA→CBD, CBGA→CBG), winterization, and distillation (Clausius-Clapeyron vapor pressure, condenser partitioning). The executor topologically sorts the process graph, enforces the canonical order, and tracks mass and energy balance. Caveat: several constants are self-described estimates and the energy model is a placeholder.',
      },
      {
        name: 'COA Intake & Verification',
        description: 'Parse Certificates of Analysis and check them against limits.',
        detail: 'Gemini structured-output parsing, a local Ollama path, or a regex fallback; Tesseract.js for OCR. Verification runs against the compliance engine and can be cross-checked against the kernel.',
      },
      {
        name: 'Compliance Engine',
        description: 'Total THC, NC 0.3%/0.25% lines, FDA serving limits.',
        detail: 'The regulatory heart of the product. Decarboxylation kinetics are fitted to Wang et al. 2016 and explicitly labeled a central estimate rather than a certified constant.',
      },
      {
        name: 'Audit Ledger',
        description: 'SHA-256 hash chain with ALCOA++ entries.',
        detail: 'Each entry links to the previous hash and carries a sequence number, so tampering is detectable. COA signatures use HMAC-SHA256 with a signing secret.',
      },
      {
        name: 'Literature & Trend Engine',
        description: 'Six-source ingestion with real trend statistics.',
        detail: 'Combines live literature APIs with Mann-Kendall trend tests, Kleinberg burst detection, and cross-source agreement via Shannon entropy.',
      },
      {
        name: 'Hemp-Agent',
        description: 'An 8-agent deterministic pipeline plus an orchestrator.',
        detail: 'brain_kernel.ts runs GoalPlanner → SemanticSearch → Structuring → Verification → Simulation → Safety → MetaEvaluator → Interface, and an orchestrator spawns forked workers with heartbeat/timeout. Caveat: its data stores are in-memory arrays and its ingestion stages are simulated.',
      },
      {
        name: 'Hemp-DB',
        description: 'Drizzle/Postgres knowledge layer for strains and insights.',
        detail: 'A schema spanning strains, studies, terpenes, effects, experiments, simulations, insights, and provenance, plus ingestion and experiment-runner services. Caveat: the bundled 220-file local corpus is explicitly marked synthetic: true.',
      },
      {
        name: 'Python Microservice',
        description: 'FastAPI endpoints for real chemistry and statistics.',
        detail: 'PubMed search via Biopython Entrez, RDKit chemical descriptors and Tanimoto similarity, Welch t-test with Cohen\'s d, and Pearson correlation with Fisher-Z confidence intervals.',
      },
      {
        name: 'BlackMind Engines',
        description: 'A ported "scientific engine" library.',
        detail: 'Largely stubbed. The brain defines stub command, security, metabolic-modeling, and quantum engines that return empty or placeholder results. Treat as scaffolding, not science.',
      },
    ],
    connections: [
      'Shares biomanufacturing and materials science with Overlay Science.',
      'Publishes research items into Overlay Global Lens.',
    ],
    real: [
      'HempForge compliance math, decision rules, and SHA-256 audit chain.',
      'Live six-source literature ingestion with real trend statistics.',
      'Metrc v2 client, Stripe billing, and Supabase RLS schema.',
      'Hemp-OS kernel: four cited process models, workflow executor, and mass-balance checks.',
      'Python microservice with real Biopython/RDKit/SciPy endpoints.',
    ],
    planned: [
      'Validation of kernel constants against external lab data (winterization and energy models are self-described estimates/placeholders).',
      'Real BlackMind engines (current ones are stubs).',
      'A real multi-agent debate (current "swarm" is one model call).',
      'Resolution of the pricing inconsistency between the Supabase migration and application code.',
      'Production deployment under the HempForge name.',
    ],
  },
  {
    id: 'oncology',
    name: 'Overlay Oncology',
    shortName: 'Oncology',
    tagline: 'In-silico research and validation — honestly labeled.',
    mission:
      'Run deterministic in-silico cancer research paired with real-data validation, publishing results — including negative ones — instead of clinical claims.',
    status: 'development',
    statusNote:
      'An active Next.js research-orchestration showcase with real engines and real cohorts. Explicitly not a clinical platform: no wet-lab work, no patient care, and several pages are labeled UI demos of a planned architecture.',
    url: 'https://oncology.overlay365.online',
    logo: '/brands/oncology.webp',
    accent: 'cyan',
    overview: [
      'Overlay Oncology is the ecosystem\'s most evidence-disciplined research project. It pairs deterministic TypeScript science engines with a real-data validation stack and publishes the results — including the cases where the engines lose to a simple baseline.',
      'The engines are pinned by a registry with a CI drift gate, so a change in output is a build failure rather than a silent shift. Validation runs against real cohorts: cBioPortal/CCLE IC50 fits, TCGA and METABRIC survival cohorts, GEO external validation, and scikit-survival benchmarks. Negative results are published rather than hidden.',
      'The project is explicit about its boundaries. It performs no wet-lab work, makes no clinical decisions, and provides no patient care. Several pages are UI demos of a planned architecture, and they carry amber disclosure banners so they are never mistaken for working systems.',
    ],
    architecture: [
      {
        name: 'Deterministic Engines',
        role: 'Simulation',
        detail: 'Tumor–immune ODE (Runge–Kutta), reaction–diffusion PDE, a multiscale agent-based simulator, spatial ligand–receptor models, and evolution/sector sweeps — all pure and reproducible.',
      },
      {
        name: 'Engine Registry + Drift Gate',
        role: 'Integrity',
        detail: 'Pins engine outputs and fails CI on drift, so results cannot change unnoticed.',
      },
      {
        name: 'Validation & Calibration',
        role: 'Grounding',
        detail: 'Fits and benchmarks against cBioPortal/CCLE, TCGA, METABRIC, and GEO, with losses versus Cox published honestly.',
      },
      {
        name: 'EvidenceHub',
        role: 'Literature',
        detail: 'Versioned cohort snapshots plus Europe PMC / bioRxiv ingestion into a file-backed vector store.',
      },
      {
        name: 'Orchestration',
        role: 'Scale',
        detail: 'Roughly 70 API routes, an event bus, a Python swarm executor, and SaaS/marketplace scaffolding.',
      },
      {
        name: 'Labeled Demo Surfaces',
        role: 'Disclosure',
        detail: 'Science Agent OS layers, Chem Lab heuristics, and infrastructure cards are UI demos with amber banners — not live systems.',
      },
    ],
    components: [
      {
        name: 'Deterministic Science Engines',
        description: 'ODE, PDE, ABM, ligand–receptor, and evolution sweeps.',
        detail: 'The modeling core. Because the engines are deterministic and registry-pinned, every published number can be replayed exactly.',
      },
      {
        name: 'Real-Data Validation',
        description: 'cBioPortal/CCLE, TCGA, METABRIC, GEO, scikit-survival.',
        detail: 'Where the project earns credibility: engines are fitted and benchmarked against real patient-level cohorts, and the comparisons — including losses — are published.',
      },
      {
        name: 'EvidenceHub',
        description: 'Versioned cohorts and literature ingestion.',
        detail: 'Keeps a versioned record of cohort snapshots and ingests Europe PMC and bioRxiv into a vector store for retrieval.',
      },
      {
        name: 'Swarm Executor',
        description: 'Python orchestrator for parallel research jobs.',
        detail: 'Runs many engine evaluations in parallel so sweeps and calibration are practical.',
      },
      {
        name: '~70 API Routes + Event Bus',
        description: 'Research orchestration surface.',
        detail: 'The programmatic surface for running and inspecting research, with SaaS/marketplace scaffolding around it.',
      },
    ],
    connections: [
      'Produces the research items published on Overlay Global Lens (Overlay Science desk).',
      'Shares biomolecular modeling with BBTech and HempForge.',
    ],
    real: [
      'Deterministic engines with a CI drift gate.',
      'Real cohorts and external validation with published negative results.',
      'EvidenceHub literature ingestion.',
    ],
    planned: [
      'Science Agent OS layers, Chem Lab heuristics, and infrastructure pages — currently labeled UI demos.',
      'Any wet-lab or clinical capability (out of scope by design).',
    ],
  },
  {
    id: 'fieldbridge',
    name: 'Overlay FieldBridge',
    shortName: 'FieldBridge',
    tagline: 'A brand kit built before the application.',
    mission:
      'Establish the canonical brand and identity for Overlay FieldBridge so any future application launches on-brand from day one.',
    status: 'concept',
    statusNote:
      'Only the brand kit exists today. The repository states plainly: "No application shell exists here yet." Treat this as an identity, not a product.',
    logo: '/brands/fieldbridge.webp',
    accent: 'cyan',
    overview: [
      'FieldBridge is a brand-first project. Rather than scaffold an app and retrofit an identity, the repository was created to hold the canonical brand kit so that any future application can reference it from its first commit.',
      'There is no application shell, no server, and no feature code. The directory contains a README, a primary logo lockup, a favicon, a social image, and a web manifest, plus documented wiring instructions for HTML and Next.js. Everything beyond that is a plan.',
    ],
    architecture: [
      {
        name: 'Primary Lockup',
        role: 'Identity',
        detail: 'The cyan-and-gold bridge mark intended for headers, mastheads, and sidebars.',
      },
      {
        name: 'Favicon & Social Card',
        role: 'Distribution',
        detail: 'Derived images for browser tabs and link unfurls, so shared links stay on-brand.',
      },
      {
        name: 'App Manifest',
        role: 'Installability',
        detail: 'A web manifest prepared so a future app can be installed without re-doing identity work.',
      },
      {
        name: 'Future Application',
        role: 'Not built',
        detail: 'The tool itself. The README is explicit that no shell exists yet; the brand kit is the only deliverable.',
      },
    ],
    components: [
      {
        name: 'Primary Lockup',
        description: 'The canonical bridge mark.',
        detail: 'The single source of truth for the FieldBridge identity, intended to be referenced rather than recreated.',
      },
      {
        name: 'Favicon',
        description: 'Browser tab / shortcut icon.',
        detail: 'Derived from the lockup so the identity is consistent at small sizes.',
      },
      {
        name: 'Social Card',
        description: 'Open Graph / link-unfurl image.',
        detail: 'Ensures shared FieldBridge links present correctly in feeds and messages.',
      },
      {
        name: 'App Manifest',
        description: 'Web manifest for a future installable app.',
        detail: 'Prepared ahead of the application so installability is not an afterthought.',
      },
    ],
    connections: [
      'A reserved system in the Overlay365 brand family.',
      'Brand kit is versioned so future scaffolding references it from the start.',
    ],
    real: [
      'Canonical logo lockup, favicon, social image, and manifest.',
      'Documented wiring instructions for HTML and Next.js.',
    ],
    planned: [
      'The FieldBridge application itself — no code shell exists yet.',
    ],
  },
  {
    id: 'recourse',
    name: 'Recourse',
    shortName: 'Recourse',
    tagline: 'An autonomous, self-developing architecture experiment.',
    mission:
      'Explore template-driven component building, self-healing code repair, and a recursive learner — where every promoted version is backed by a real, sandboxed test suite.',
    status: 'development',
    statusNote:
      'A de-theatred experiment: verifiers execute the real code in an isolated sandbox, and promotions require a green test suite. Its own audit still lists open security hardening.',
    logo: '/brands/recourse.webp',
    accent: 'gold',
    overview: [
      'Recourse is an experiment in software that develops itself: template-driven component construction, self-healing repair, and a recursive learner that evolves candidate "genes" and keeps only those that pass a real test suite.',
      'It is notable for having been partially de-theatred. The README states that the codebase "was originally a demo with mocked autonomous behavior" and has since been reworked so that every verifier executes the actual code under test in an isolated sandbox. A promotion now means the code\'s own tests ran green — not that a fixture was satisfied.',
      'It is also honest about its own state. Its audit report flags critical items, including unauthenticated mutating serverless routes and an SSRF vector in the PDF sidecar, and notes there is no CI. Those are tracked problems, not hidden ones.',
    ],
    architecture: [
      {
        name: 'Template Engine',
        role: 'Construction',
        detail: 'Builds components from templates rather than free-form generation, which keeps output structured and reviewable.',
      },
      {
        name: 'Generator & Mutator',
        role: 'Learning',
        detail: 'The evolve/mutate/chat paths go through a configured OpenAI-compatible provider (Ollama by default). When the model is offline the app reports "offline" instead of inventing results.',
      },
      {
        name: 'Sandboxed Verifier',
        role: 'Gate',
        detail: 'Runs the real code under test in isolated-vm behind a lint gate. No fixture constants are injected, so a test referencing an undeclared symbol genuinely fails.',
      },
      {
        name: 'Registry',
        role: 'Promotion',
        detail: 'Stores the test suite that verified each promoted tool version and re-verifies the live version at boot.',
      },
      {
        name: 'Sidecars & MCP',
        role: 'Capability',
        detail: 'FastAPI sidecars for a knowledge graph, PDF handling, and fuzzing, plus an MCP server and LanceDB vector memory.',
      },
    ],
    components: [
      {
        name: 'Template-Driven Builder',
        description: 'Constructs components from templates.',
        detail: 'Templates constrain the search space, making generated code easier to verify than free-form generation.',
      },
      {
        name: 'Self-Healing Repair',
        description: 'Detects and repairs broken code paths.',
        detail: 'Repair is gated by the same sandboxed verification as generation, so a "fix" must pass real tests to be kept.',
      },
      {
        name: 'Recursive Learner',
        description: 'Property-based "gene" evaluation.',
        detail: 'Evolves and mutates candidates and evaluates them against properties; only verified candidates advance.',
      },
      {
        name: 'Sandboxed Registry',
        description: 'Test-gated promotion with boot-time re-verification.',
        detail: 'The integrity core: every promoted version stores its verifying suite, and the live version is re-checked at startup.',
      },
      {
        name: 'Sidecars & MCP',
        description: 'Knowledge graph, PDF, and fuzz services plus MCP.',
        detail: 'Provides retrieval, document handling, and adversarial input testing as separate services.',
      },
    ],
    connections: [
      'Developed inside the Draymond orchestrator workspace as an internal capability experiment.',
      'Shares the ecosystem identity model with the wider Overlay365 family.',
    ],
    real: [
      'Sandboxed, test-gated promotion (isolated-vm plus a lint gate).',
      '39 vitest files, including honesty-contract tests.',
    ],
    planned: [
      'Security hardening flagged by its own audit (auth on mutating routes, PDF sidecar SSRF).',
      'Continuous integration (none today).',
    ],
  },
  {
    id: 'ecos',
    name: 'Overlay ECOS',
    shortName: 'ECOS',
    tagline: 'Thirteen climate-tech businesses, one ecosystem.',
    mission:
      'Operate 13 interconnected climate-tech businesses on shared infrastructure — one "brain" (forecasting and optimization libraries), one "body" (database and auth), and one home in the RegenCity compound.',
    status: 'development',
    statusNote:
      'Self-reported 70% readiness: Levels 1–4 complete, Level 5 (scale and monetization) in progress. Structure validation passes 53/53 required files.',
    logo: '/brands/ecos.webp',
    accent: 'teal',
    overview: [
      'ECOS is a climate-tech portfolio built as a single monorepo rather than 13 separate startups. The premise is shared infrastructure: one "brain" of forecasting and optimization libraries, one "body" of database and auth, and one physical home in the RegenCity compound.',
      'The portfolio spans an infrastructure layer of IoT and utility businesses — including EverLume (lighting-as-a-service), MicroHydro (containerized hydro), and AquaGen (atmospheric water) — each described with a business model, a software "brain", and a role in the compound.',
      'It reports 70% readiness, with Levels 1–4 complete and Level 5 (SaaS tiers, multi-tenancy, compliance, and advanced analytics) in progress, and a structure validator confirming 53 of 53 required files. The shared kernel and FastAPI gateway exist; the physical RegenCity deployment is the part still ahead.',
    ],
    architecture: [
      {
        name: 'ECOS Kernel',
        role: 'Shared brain',
        detail: 'Python libraries for forecasting (Prophet/LSTM) and optimization (OR-Tools) reused across energy, water, and farming projects.',
      },
      {
        name: 'Shared Body',
        role: 'Platform',
        detail: 'One PostgreSQL schema and an Auth0/Web3 login layer serving every project.',
      },
      {
        name: 'Utility Layer',
        role: 'Businesses',
        detail: 'IoT-linked ventures such as EverLume, MicroHydro, and AquaGen, each with its own predictive or optimization model.',
      },
      {
        name: 'API Gateway',
        role: 'Integration',
        detail: 'A FastAPI gateway exposing 11+ operational endpoints across the portfolio.',
      },
      {
        name: 'RegenCity Integration',
        role: 'Physical',
        detail: 'Zone deployment and cross-project synergies in the compound — the Level 4 milestone.',
      },
      {
        name: 'Venture Foundry Engine',
        role: 'Growth',
        detail: 'Turns ideas into revenue-generating assets through gamified collaboration.',
      },
    ],
    components: [
      {
        name: 'ECOS Kernel',
        description: 'Shared forecasting and optimization libraries.',
        detail: 'The "brain" every business shares, avoiding 13 separate implementations of forecasting and optimization.',
      },
      {
        name: 'Shared Body',
        description: 'Single Postgres schema and auth layer.',
        detail: 'One identity and data layer for the whole portfolio, which is what makes it an ecosystem rather than a folder of startups.',
      },
      {
        name: 'Utility Layer',
        description: 'IoT-linked ventures like EverLume, MicroHydro, and AquaGen.',
        detail: 'Each business pairs a physical system with a software model — for example, predictive maintenance for EverLume and flow forecasting for MicroHydro.',
      },
      {
        name: 'RegenCity Integration',
        description: 'Zone deployment and cross-project synergies.',
        detail: 'The physical compound where the businesses reinforce each other; Level 4 of the roadmap.',
      },
      {
        name: 'Venture Foundry Engine',
        description: 'Gamified collaboration for new ventures.',
        detail: 'A newer addition focused on turning ideas into revenue-generating assets.',
      },
    ],
    connections: [
      'A platform under the Overlay365 ecosystem umbrella.',
      'Shares environmental research themes with Overlay Global Lens.',
    ],
    real: [
      'Monorepo with shared packages and a FastAPI gateway (11+ endpoints).',
      'Structure validation: 53/53 required files present.',
    ],
    planned: [
      'Level 5: SaaS tiers, multi-tenancy, compliance, and advanced analytics.',
      'Full RegenCity physical deployment.',
    ],
  },
];

export const STATUS_META: Record<ManualStatus, { label: string; description: string; className: string; text: string; dot: string }> = {
  live: {
    label: 'Live',
    description: 'Deployed, tested code you can use today.',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    text: 'text-emerald-300',
    dot: 'bg-emerald-400',
  },
  development: {
    label: 'In development',
    description: 'Active, working code that is not yet a finished product.',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    text: 'text-amber-300',
    dot: 'bg-amber-400',
  },
  concept: {
    label: 'Concept',
    description: 'Design documents and prototypes. Not shipped.',
    className: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
    text: 'text-zinc-300',
    dot: 'bg-zinc-400',
  },
};

export function getManualSite(id: string | null | undefined): ManualSite | undefined {
  if (!id) return undefined;
  return MANUAL_SITES.find((s) => s.id === id);
}
