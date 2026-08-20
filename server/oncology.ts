import db from "./db";

export interface FindingInput {
  id: string;
  paper_id?: string;
  headline: string;
  kind: string;
  metric?: string;
  value?: string;
  unit?: string;
  reference_claim?: string;
  evidence_tier?: string;
  manifest_hash?: string;
  audit_signature?: string;
  dataset?: string;
  sample_size?: number;
  pub_date?: string;
  payload?: Record<string, unknown>;
}

const upsertFindingStmt = db.prepare(`
  INSERT INTO research_findings
    (id, paper_id, headline, kind, metric, value, unit, reference_claim, evidence_tier,
     manifest_hash, audit_signature, dataset, sample_size, pub_date, payload)
  VALUES
    (@id, @paper_id, @headline, @kind, @metric, @value, @unit, @reference_claim, @evidence_tier,
     @manifest_hash, @audit_signature, @dataset, @sample_size, @pub_date, @payload)
  ON CONFLICT(id) DO UPDATE SET
    headline = excluded.headline,
    kind = excluded.kind,
    metric = excluded.metric,
    value = excluded.value,
    unit = excluded.unit,
    reference_claim = excluded.reference_claim,
    evidence_tier = excluded.evidence_tier,
    manifest_hash = excluded.manifest_hash,
    audit_signature = excluded.audit_signature,
    dataset = excluded.dataset,
    sample_size = excluded.sample_size,
    pub_date = excluded.pub_date,
    payload = excluded.payload
`);

export function upsertFinding(f: FindingInput): void {
  upsertFindingStmt.run({
    id: f.id,
    paper_id: f.paper_id || null,
    headline: f.headline,
    kind: f.kind,
    metric: f.metric || "",
    value: f.value != null ? String(f.value) : "",
    unit: f.unit || "",
    reference_claim: f.reference_claim || "",
    evidence_tier: f.evidence_tier || "",
    manifest_hash: f.manifest_hash || "",
    audit_signature: f.audit_signature || "",
    dataset: f.dataset || "",
    sample_size: f.sample_size ?? null,
    pub_date: f.pub_date || new Date().toISOString(),
    payload: JSON.stringify(f.payload || {}),
  });
}

export function setFindingOfDay(day: string, findingId: string): void {
  db.prepare("INSERT OR REPLACE INTO findings_of_day (day, finding_id) VALUES (?, ?)").run(day, findingId);
}

function rowToFinding(r: any): any {
  return {
    id: r.id,
    paper_id: r.paper_id,
    headline: r.headline,
    kind: r.kind,
    metric: r.metric,
    value: r.value,
    unit: r.unit,
    reference_claim: r.reference_claim,
    evidence_tier: r.evidence_tier,
    manifest_hash: r.manifest_hash,
    audit_signature: r.audit_signature,
    dataset: r.dataset,
    sample_size: r.sample_size,
    pub_date: r.pub_date,
    payload: safeParse(r.payload, null),
  };
}

export function getFindingOfDay(day: string): { finding: any; day: string } {
  const explicit = db.prepare(`
    SELECT f.* FROM findings_of_day fod
    JOIN research_findings f ON f.id = fod.finding_id
    WHERE fod.day = ? LIMIT 1
  `).get(day) as any;

  const fallback = db.prepare(`
    SELECT * FROM research_findings
    WHERE pub_date <= ? ORDER BY pub_date DESC LIMIT 1
  `).get(`${day}T23:59:59.999Z`) as any;

  const row = explicit || fallback;
  return { day, finding: row ? rowToFinding(row) : null };
}

export function getFindings(opts: { kind?: string; limit?: number } = {}): { findings: any[]; total: number } {
  const limit = Math.min(opts.limit || 50, 100);
  let where = "";
  const params: any[] = [];
  if (opts.kind) { where = "WHERE kind = ?"; params.push(opts.kind); }
  params.push(limit);
  const rows = db.prepare(`
    SELECT * FROM research_findings ${where}
    ORDER BY COALESCE(pub_date, created_at) DESC LIMIT ?
  `).all(...params) as any[];
  return { findings: rows.map(rowToFinding), total: rows.length };
}

export function getFindingsForPaper(paperId: string): any[] {
  const rows = db.prepare(`
    SELECT * FROM research_findings WHERE paper_id = ?
    ORDER BY COALESCE(pub_date, created_at) DESC
  `).all(paperId) as any[];
  return rows.map(rowToFinding);
}

function safeParse(data: string, fallback: any): any {
  if (!data) return fallback;
  try { return JSON.parse(data); } catch { return fallback; }
}
