import assert from 'node:assert/strict';
import test from 'node:test';
import { campusDateKey, parseCampusDate } from './campusDate.js';

test('campus calendar date stays on the India-local day near midnight UTC', () => {
  assert.equal(campusDateKey(new Date('2026-11-22T19:30:00.000Z')), '2026-11-23');
});

test('a 1:05–1:30 AM India session fits a 1:00–3:00 AM campus event', () => {
  const eventStartsAt = new Date('2026-11-22T19:30:00.000Z');
  const eventEndsAt = new Date('2026-11-22T21:30:00.000Z');
  const sessionStartsAt = new Date('2026-11-22T19:35:00.000Z');
  const sessionEndsAt = new Date('2026-11-22T20:00:00.000Z');
  const sessionDate = parseCampusDate('2026-11-23');

  assert.ok(sessionStartsAt >= eventStartsAt);
  assert.ok(sessionEndsAt <= eventEndsAt);
  assert.equal(sessionDate.key, campusDateKey(sessionStartsAt));
});

test('date-only session input is stored at noon in the campus timezone', () => {
  const result = parseCampusDate('2026-11-23');
  assert.equal(result.key, '2026-11-23');
  assert.equal(result.date.toISOString(), '2026-11-23T06:30:00.000Z');
});

test('legacy ISO date input is mapped to its India-local calendar day', () => {
  assert.equal(parseCampusDate('2026-11-23T06:30:00.000Z').key, '2026-11-23');
});

test('invalid date-only input is rejected instead of being normalized', () => {
  const result = parseCampusDate('2026-11-31');
  assert.equal(result.key, '');
  assert.ok(Number.isNaN(+result.date));
});
