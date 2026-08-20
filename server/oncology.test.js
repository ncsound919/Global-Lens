import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upsertFinding, setFindingOfDay, getFindingOfDay, getFindings, getFindingsForPaper } from './oncology.js';

test('upsertFinding is idempotent on id', () => {
  const f = { id: 'F1', paper_id: 'P1', headline: 'Calibrated vs TCGA', kind: 'calibration',
    metric: 'rho', value: '0.81', unit: '', reference_claim: 'TCGA LUAD survival',
    evidence_tier: 'E1', manifest_hash: 'mh1', audit_signature: 'sig1', dataset: 'TCGA',
    sample_size: 505, pub_date: '2026-08-18T00:00:00.000Z', payload: {} };
  upsertFinding(f);
  upsertFinding(f);
  const list = getFindingsForPaper('P1');
  assert.equal(list.length, 1);
  assert.equal(list[0].headline, 'Calibrated vs TCGA');
});

test('setFindingOfDay + getFindingOfDay returns today else latest past', () => {
  setFindingOfDay('2026-08-20', 'F1');
  const today = getFindingOfDay('2026-08-20');
  assert.equal(today.finding.id, 'F1');
  const fallback = getFindingOfDay('2026-08-19');
  assert.equal(fallback.finding.id, 'F1');
});

test('getFindings filters by kind', () => {
  const kinds = getFindings({ kind: 'calibration' }).findings.map((f) => f.id);
  assert.ok(kinds.includes('F1'));
});
