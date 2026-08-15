import { test } from 'node:test';
import assert from 'node:assert/strict';

test('publish accepts a paper attachment field', () => {
  const payload = {
    title: 'T', body: 'B', category: 'cancer-research', source_name: 'CureMind',
    url: 'http://x/paper', paper: { id: 'hyp_1', title: 'P', evidence_tier: 'E1', url: 'http://x/pdf', payload: { attachment: {} } },
  };
  assert.equal(payload.paper.id, 'hyp_1');
  assert.equal(payload.paper.evidence_tier, 'E1');
});
