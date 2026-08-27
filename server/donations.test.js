import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordSettledDonation, getSettledDonationStats, eventSeen, recordEvent, handleDonationEvent } from './donations.js';

test('recordSettledDonation is idempotent per event', async () => {
  await recordSettledDonation({ eventId: 'evt_1', amount: 5000, campaign: 'oncology', recurring: 0 });
  await recordSettledDonation({ eventId: 'evt_1', amount: 5000, campaign: 'oncology', recurring: 0 });
  const stats = await getSettledDonationStats();
  assert.equal(stats.totalDonations, 1);
  assert.equal(stats.settledUsd, 50); // 5000 minor units -> $50
});

test('eventSeen/recordEvent guard duplicates', async () => {
  assert.equal(await eventSeen('evt_2'), false);
  await recordEvent('evt_2');
  assert.equal(await eventSeen('evt_2'), true);
});

test('one-time checkout.session.completed records a settled donation', async () => {
  const before = (await getSettledDonationStats()).totalDonations;
  await handleDonationEvent({
    id: 'evt_ot',
    type: 'checkout.session.completed',
    data: { object: { mode: 'payment', amount_total: 2500, currency: 'usd', metadata: { campaign: 'oncology' } } },
  });
  assert.equal((await getSettledDonationStats()).totalDonations, before + 1);
});

test('subscription charge recorded once via invoice.paid (not session.completed)', async () => {
  const before = (await getSettledDonationStats()).totalDonations;
  await handleDonationEvent({
    id: 'evt_sub_checkout',
    type: 'checkout.session.completed',
    data: { object: { mode: 'subscription', amount_total: 9900, currency: 'usd', metadata: {} } },
  });
  assert.equal((await getSettledDonationStats()).totalDonations, before, 'subscription session.completed must not record');
  await handleDonationEvent({
    id: 'evt_sub_invoice',
    type: 'invoice.paid',
    data: { object: { amount_paid: 9900, currency: 'usd' } },
  });
  assert.equal((await getSettledDonationStats()).totalDonations, before + 1, 'subscription charge recorded exactly once via invoice.paid');
});