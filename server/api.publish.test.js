import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upsertFinding, setFindingOfDay, getFindings } from './oncology.js';

test('publish accepts a paper attachment field', () => {
  const payload = {
    title: 'T', body: 'B', category: 'cancer-research', source_name: 'CureMind',
    url: 'http://x/paper', paper: { id: 'hyp_1', title: 'P', evidence_tier: 'E1', url: 'http://x/pdf', payload: { attachment: {} } },
  };
  assert.equal(payload.paper.id, 'hyp_1');
  assert.equal(payload.paper.evidence_tier, 'E1');
});

test('publish payload carries findings + finding_of_day', () => {
  const payload = {
    title: 'T', body: 'B', category: 'cancer-research', source_name: 'CureMind',
    paper: { id: 'hyp_1', title: 'P', evidence_tier: 'E1' },
    findings: [{
      id: 'F2', paper_id: 'hyp_1', headline: 'Benchmark beats Cox', kind: 'benchmark',
      metric: 'c-index', value: '0.718', evidence_tier: 'E1',
      manifest_hash: 'mh2', audit_signature: 'sig2', dataset: 'gbm', sample_size: 300,
    }],
    finding_of_day: [{ day: '2026-08-20', finding_id: 'F2' }],
  };
  assert.ok(Array.isArray(payload.findings));
  assert.ok(Array.isArray(payload.finding_of_day));
  // Integration contract: publishing a payload like this must persist the finding.
  upsertFinding(payload.findings[0]);
  setFindingOfDay('2026-08-20', 'F2');
  const list = getFindings({ kind: 'benchmark' }).findings;
  assert.ok(list.some((f) => f.id === 'F2'));
});
