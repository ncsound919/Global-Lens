import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordSettledDonation, getSettledDonationStats, eventSeen, recordEvent } from './donations.js';

test('recordSettledDonation is idempotent per event', () => {
  recordSettledDonation({ eventId: 'evt_1', amount: 5000, campaign: 'oncology', recurring: 0 });
  recordSettledDonation({ eventId: 'evt_1', amount: 5000, campaign: 'oncology', recurring: 0 });
  const stats = getSettledDonationStats();
  assert.equal(stats.totalDonations, 1);
  assert.equal(stats.settledUsd, 50); // 5000 minor units -> $50
});

test('eventSeen/recordEvent guard duplicates', () => {
  assert.equal(eventSeen('evt_2'), false);
  recordEvent('evt_2');
  assert.equal(eventSeen('evt_2'), true);
});
