import { test } from 'node:test';
import assert from 'node:assert';
import { repairMojibake } from '../server/encoding.ts';

function makeMojibake(s: string): string {
  // Encode UTF-8, decode as Windows-1252 — the corruption chain that happens
  // when a UTF-8 feed is mis-decoded.
  return new TextDecoder('windows-1252').decode(Buffer.from(s, 'utf8'));
}

test('repairs curly quote mojibake', () => {
  const clean = '\u201cFunerals commence for 14 infants killed in a fire at Islamabad\u2019s Institute of Medical Sciences.\u201d';
  assert.equal(repairMojibake(makeMojibake(clean)), clean);
});

test('repairs en/em dash mojibake', () => {
  assert.equal(repairMojibake(makeMojibake('E1\u2013E4 mark every research item')), 'E1\u2013E4 mark every research item');
  assert.equal(repairMojibake(makeMojibake('a \u2014 b')), 'a \u2014 b');
});

test('repairs accented mojibake', () => {
  assert.equal(repairMojibake(makeMojibake('caf\u00e9')), 'caf\u00e9');
  assert.equal(repairMojibake(makeMojibake('\u00a9 2026')), '\u00a9 2026');
});

test('passes clean text through untouched', () => {
  const clean = 'Plain text, no special characters.';
  assert.equal(repairMojibake(clean), clean);
  assert.equal(repairMojibake('Real euro \u20ac50, legit'), 'Real euro \u20ac50, legit');
  assert.equal(repairMojibake(''), '');
  assert.equal(repairMojibake('中文 headline 漢字'), '中文 headline 漢字');
});

test('idempotent on already-repaired text', () => {
  const clean = '\u201cQuoted\u201d \u2014 dash \u00e9';
  const once = repairMojibake(makeMojibake(clean));
  assert.equal(repairMojibake(once), once);
});