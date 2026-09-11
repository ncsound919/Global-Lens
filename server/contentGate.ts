/**
 * contentGate.ts — shared SQL gate for the PUBLIC research surface.
 *
 * The outlet publishes research, not the ecosystem's inner workings. This is
 * the single deterministic blocklist applied to every public papers/trends/
 * discoveries query so internal pipeline artifacts can never surface:
 *   - prompt text stored as a paper title (deterministic fallback dumps)
 *   - CureMind sandbox/daemon output (runs on seeds [42,1337], tcga skipped)
 *     previously published as E1 "Measured" — theater, not measured data
 *   - "Grade harness" + "brain-" repair-loop titles from the internal fleet
 *
 * Anything matching is internal. If a real, verified finding ever needs to be
 * published, it goes through the findings/ResultSig path (real manifest_hash +
 * audit_signature), not through these raw pipeline rows.
 */

/** SQL fragment (AND-able) that excludes internal pipeline artifacts. */
export const PUBLIC_PAPER_GATE_SQL = `
  (title NOT LIKE 'Ingest and process%')
  AND (title NOT LIKE 'Return as JSON%')
  AND (source IS NULL OR source NOT LIKE 'CureMind%')
  AND (title IS NULL OR title NOT LIKE 'Grade harness%')
  AND (title IS NULL OR title NOT LIKE 'brain-%')
  AND (title IS NULL OR title NOT LIKE 'Multi-Engine Study%')
`;

/** Same gate, for queries that also filter discoveries/trends by source. */
export const PUBLIC_TREND_SOURCE = "Overlay Research%";

/**
 * News surface gate: only real news sources. The /api/publish path and
 * internal research writers insert articles under internal source names
 * ("Overlay365 Science", "Deterministic Brain", ...). Those are ecosystem
 * publications, not the outlet's news feed — they must not appear here unless
 * a human moderates them to is_moderated=1.
 */
export const PUBLIC_NEWS_SOURCE_GATE_SQL = `
  (a.is_moderated = 1)
  OR (a.source_name NOT LIKE 'Overlay365%' AND a.source_name NOT LIKE 'Overlay Global Lens%'
      AND a.source_name NOT LIKE 'Deterministic Brain%' AND a.source_name NOT LIKE 'CureMind%'
      AND a.source_name NOT LIKE 'Overlay Research%')
`;

/** Medical disclaimer attached to every oncology surface (no clinical claims). */
export const ONCOLOGY_DISCLAIMER =
  "Research only. This content is a research/education artifact and is NOT medical advice. " +
  "Always consult a qualified physician or oncology professional for any medical decision.";
