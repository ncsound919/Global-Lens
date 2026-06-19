import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

describe('Basic Application Tests', () => {
  it('should pass a sanity check', () => {
    assert.equal(1 + 1, 2);
  });
});
