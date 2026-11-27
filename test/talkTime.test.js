const test = require('node:test');
const assert = require('node:assert');
const { talkOf } = require('../lib/model');

// Talk time is what Lighthouse's work report says: calls plus the PTM time it counts
test('talk time matches the Lighthouse work report, including its PTM seconds', () => {
  const now = { callTalkSeconds: 1691, ptmSeconds: 1800, ptmMeetings: 1, talkSeconds: 3491 };
  const prev = { callTalkSeconds: 600, ptmSeconds: 720, ptmMeetings: 1, talkSeconds: 1320 };
  assert.deepStrictEqual(talkOf(now, prev), {
    minutes: 58,
    callMinutes: 28,
    ptm: 1,
    ptmMinutes: 30,
    yesterday: 22,
    yesterdayPtm: 1,
    yesterdayPtmMinutes: 12,
  });
});

test('no report for the day gives zeros', () => {
  assert.deepStrictEqual(talkOf(undefined, undefined), {
    minutes: 0,
    callMinutes: 0,
    ptm: 0,
    ptmMinutes: 0,
    yesterday: 0,
    yesterdayPtm: 0,
    yesterdayPtmMinutes: 0,
  });
});
