import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subtotal, grandTotal, paymentSummary, validatePayment, profit, formatNaira } from '../src/lib/money.ts';
import { generatePortalToken, hashPortalToken, looksLikePortalToken, defaultExpiry } from '../src/lib/portal-token.ts';
import { normalizeNgPhone, whatsappLink, templates } from '../src/lib/whatsapp.ts';
import { buildJourney } from '../src/lib/status.ts';
import { daysUntil, countdownText, addDaysStr } from '../src/lib/dates.ts';
import { cateringResult, chopsResult } from '../src/lib/costing.ts';

const wedding = [
  { quantity: 350, unit_price: 1000 }, // catering 350,000
  { quantity: 350, unit_price: 400 },  // small chops 140,000
];

test('spec scenario: ₦500,000 total, ₦300,000 paid, balance ₦200,000, then paid in full', () => {
  const total = grandTotal(wedding, { service_fee: 10000 });
  assert.equal(total, 500000);
  let s = paymentSummary(total, [{ amount: 200000 }, { amount: 100000 }]);
  assert.deepEqual([s.paid, s.balance, s.status], [300000, 200000, 'partially_paid']);
  s = paymentSummary(total, [{ amount: 200000 }, { amount: 100000 }, { amount: 200000 }]);
  assert.deepEqual([s.paid, s.balance, s.status], [500000, 0, 'paid_in_full']);
});

test('no payments => awaiting payment; total never negative', () => {
  assert.equal(paymentSummary(100, []).status, 'awaiting_payment');
  assert.equal(grandTotal([{ quantity: 1, unit_price: 100 }], { discount: 500 }), 0);
});

test('overpayment and invalid amounts are rejected', () => {
  assert.ok(validatePayment(200001, 200000));
  assert.equal(validatePayment(200000, 200000), null);
  assert.ok(validatePayment(0, 100));
  assert.ok(validatePayment(-5, 100));
  assert.ok(validatePayment(NaN, 100));
  assert.equal(validatePayment(250000, 200000, true), null);
});

test('floating point: 0.1 + 0.2 style sums stay exact to 2dp', () => {
  assert.equal(subtotal([{ quantity: 3, unit_price: 0.1 }]), 0.3);
  assert.equal(paymentSummary(0.3, [{ amount: 0.1 }, { amount: 0.2 }]).balance, 0);
});

test('profit example: revenue 500k, costs 310k => 190k, 38%', () => {
  assert.deepEqual(profit(500000, 310000), { revenue: 500000, costs: 310000, profit: 190000, margin: 38 });
  assert.equal(profit(0, 100).margin, 0);
});

test('naira formatting', () => {
  assert.equal(formatNaira(250000), '₦250,000');
  assert.equal(formatNaira(0), '₦0');
});

test('portal token: 256 bits, url-safe, unique, hashed with sha-256', async () => {
  const t = generatePortalToken();
  assert.equal(t.length, 43); // 32 bytes base64url, no padding
  assert.ok(looksLikePortalToken(t));
  assert.notEqual(t, generatePortalToken());
  const h = await hashPortalToken(t);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.notEqual(h, t);
  assert.equal(h, await hashPortalToken(t));
  // known SHA-256 vector
  assert.equal(await hashPortalToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.ok(!looksLikePortalToken('123'));
  assert.ok(!looksLikePortalToken('../../etc/passwd'));
});

test('portal token default expiry is 90 days', () => {
  const from = new Date('2026-10-04T00:00:00Z');
  assert.equal(defaultExpiry(from).toISOString().slice(0, 10), '2027-01-02');
});

test('phone normalisation and WhatsApp links', () => {
  assert.equal(normalizeNgPhone('0803 123 4567'), '2348031234567');
  assert.equal(normalizeNgPhone('+234 803 123 4567'), '2348031234567');
  assert.equal(normalizeNgPhone('8031234567'), '2348031234567');
  assert.equal(normalizeNgPhone('12345'), null);
  assert.equal(normalizeNgPhone(''), null);
  const link = whatsappLink('08031234567', 'Hello ❤️ & more');
  assert.ok(link!.startsWith('https://wa.me/2348031234567?text='));
  assert.ok(link!.includes(encodeURIComponent('Hello ❤️ & more')));
  assert.equal(whatsappLink('bad', 'x'), null);
});

test('WhatsApp confirmation template contains figures', () => {
  const m = templates.confirmation({ customer: 'Maryam', business: 'Aisha Events', event: "Maryam & Ahmed's Wedding", total: 250000, paid: 150000, balance: 100000 });
  assert.ok(m.includes('Total: ₦250,000') && m.includes('Paid: ₦150,000') && m.includes('Balance: ₦100,000'));
});

test('journey: exactly one current step, none after done ones are skipped', () => {
  const j = buildJourney({ status: 'final_details', depositReceived: true, menuConfirmed: true, guestCountConfirmed: true });
  assert.deepEqual(j.map((s) => s.state), ['done', 'done', 'done', 'done', 'current', 'todo', 'todo']);
  const fresh = buildJourney({ status: 'inquiry', depositReceived: false });
  assert.equal(fresh.filter((s) => s.state === 'current').length, 1);
  assert.equal(fresh[0].state, 'current');
  const done = buildJourney({ status: 'completed', depositReceived: true, menuConfirmed: true, guestCountConfirmed: true });
  assert.ok(done.every((s) => s.state === 'done'));
});

test('dates', () => {
  const from = new Date(2026, 9, 6); // 6 Oct 2026 local
  assert.equal(daysUntil('2026-10-18', from), 12);
  assert.equal(countdownText('2026-10-18', from), '12 days to go');
  assert.equal(countdownText('2026-10-07', from), 'Tomorrow');
  assert.equal(countdownText('2026-10-06', from), 'Today is the day!');
  assert.equal(addDaysStr('2026-10-30', 3), '2026-11-02');
});

test('catering costing', () => {
  const r = cateringResult({
    guests: 100, ingredients: [{ name: 'Rice', quantity: 10, unit_cost: 5000 }, { name: 'Chicken', quantity: 100, unit_cost: 1500 }],
    labour: 30000, gas: 10000, packaging: 20000, transport: 15000, other: 5000, selling_price: 400000,
  });
  assert.equal(r.totalCost, 280000);
  assert.equal(r.costPerGuest, 2800);
  assert.equal(r.profit, 120000);
  assert.equal(r.margin, 30);
});

test('small chops costing: quantities rounded up, markup applied', () => {
  const r = chopsResult({
    guests: 350, items: [{ name: 'Spring rolls', per_guest: 2, unit_cost: 40 }, { name: 'Puff-puff', per_guest: 3, unit_cost: 15 }],
    packaging: 20000, labour: 15000, transport: 5000, other: 0, markup_percent: 50,
  });
  assert.equal(r.lines[0].quantity, 700);
  assert.equal(r.lines[1].quantity, 1050);
  assert.equal(r.totalCost, 28000 + 15750 + 40000);
  assert.equal(r.suggestedPrice, Math.round(r.totalCost * 1.5 * 100) / 100);
  const w = chopsResult({ guests: 10, items: [{ name: 'x', per_guest: 1, unit_cost: 1 }], packaging: 0, labour: 0, transport: 0, other: 0, markup_percent: 0, wastage_percent: 5 });
  assert.equal(w.lines[0].quantity, 11);
});

import { readableOn, safeColor, contrast } from '../src/lib/color.ts';
test('brand colour text stays readable', () => {
  assert.equal(readableOn('#7A1F3D'), '#FFFFFF');   // burgundy -> white text
  assert.equal(readableOn('#F3E2B3'), '#2B2523');   // pale gold -> dark text
  assert.equal(readableOn('#FFFFFF'), '#2B2523');
  assert.equal(readableOn('#000000'), '#FFFFFF');
  assert.ok(contrast('#7A1F3D', '#FFFFFF') >= 4.5);
  assert.equal(safeColor('red; background:url(x)', '#7A1F3D'), '#7A1F3D'); // no CSS injection via colour field
  assert.equal(safeColor('#0F7B5F', '#000000'), '#0F7B5F');
});

test('small chops: manual quantity override wins over the calculated quantity', () => {
  const r = chopsResult({ guests: 100, items: [{ name: 'Samosa', per_guest: 2, unit_cost: 50, override_qty: 150 }], packaging: 0, labour: 0, transport: 0, other: 0, markup_percent: 0 });
  assert.equal(r.lines[0].quantity, 150);
  assert.equal(r.totalCost, 7500);
});
