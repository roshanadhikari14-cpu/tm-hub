const test = require('node:test');
const assert = require('node:assert');
const { dur } = require('../lib/duration');

test('up to 59 minutes stays in minutes, with the unit the place already used', () => {
  assert.equal(dur(0), '0 min');
  assert.equal(dur(59), '59 min');
  assert.equal(dur(44, 'm'), '44m');
});
test('from 60 minutes it reads in hours and minutes', () => {
  assert.equal(dur(74), '1 hr 14 mins');
  assert.equal(dur(74, 'm'), '1 hr 14 mins');
  assert.equal(dur(60), '1 hr');
  assert.equal(dur(61), '1 hr 1 min');
  assert.equal(dur(168), '2 hrs 48 mins');
});
