// Run: node --test test/
const test = require('node:test');
const assert = require('assert');
const { parseTask } = require('../lib/taskParse');

const people = [
  { name: 'Roshan Adhikari', aliases: ['Roshan'], owner: true },
  { name: 'Barnali Debnath', aliases: ['Barnali'] },
  { name: 'Renuka Naik', aliases: ['Renuka'] },
  { name: 'Nida Afreen', aliases: ['Nida'] },
  { name: 'Preety Gour', aliases: ['Preety', 'Preeti'] },
  { name: 'Dhiraj Singh', aliases: ['Dhiraj', 'Dhiraj Kumar'] },
];
const students = [
  { id: 101, name: 'Paridhi Sharma', grade: '7', school: 'DPS', tm: 'Preety Gour' },
  { id: 102, name: 'Vivaan N', grade: '6', school: 'Montfort', tm: 'Preety Gour' },
  { id: 103, name: 'Vivaan Rao', grade: '8', school: 'NPS', tm: 'Nida Afreen' },
  { id: 104, name: 'Vivaan Mehta', grade: '9', school: 'BBPS', tm: 'Renuka Naik' },
  { id: 105, name: 'Aarna Bansal', grade: '9', school: 'Sachdeva', tm: 'Dhiraj Singh' },
  { id: 10667, name: 'Avni Khanna', grade: '6', school: 'DAV', tm: 'Dhiraj Singh' },
  { id: 107, name: 'Param-preet Kaur Anand', grade: '10', school: 'DAV', tm: 'Barnali Debnath' },
  { id: 108, name: 'Will Joseph', grade: '7', school: 'DAV', tm: 'Barnali Debnath' },
];
// Thursday 26 Nov 2026, 11:00 India time
const ctx = { today: '2026-11-26', now: '11:00', people, students, me: 'Roshan Adhikari', role: 'owner' };
const p = (text, extra) => parseTask(text, { ...ctx, ...extra });
const ids = (r) => r.students.map((s) => s.selected);

test('person, student, date, time, priority and a structured subject', () => {
  const r = p('Ask Preety to schedule PTM with Paridhi tomorrow at 5pm, urgent. Parent is worried about science marks.');
  assert.deepStrictEqual(r.assignees, ['Preety Gour']);
  assert.strictEqual(r.due, '2026-11-27');
  assert.strictEqual(r.time, '17:00');
  assert.strictEqual(r.priority, 'High');
  assert.deepStrictEqual(ids(r), [101]);
  assert.strictEqual(r.subject, 'Schedule PTM · Science – Paridhi Sharma');
  assert.ok(r.action.startsWith('Schedule PTM with Paridhi'), r.action);
  assert.ok(r.action.includes('worried about science marks'), 'details are kept');
});

test('a first name shared by several students gives options and picks none', () => {
  const r = p('Nida to call Vivaan parents on 28 Nov 11:30 am');
  assert.deepStrictEqual(r.assignees, ['Nida Afreen']);
  assert.strictEqual(r.students.length, 1);
  assert.deepStrictEqual(r.students[0].matches.map((m) => m.id).sort(), [102, 103, 104]);
  assert.strictEqual(r.students[0].selected, null);
  assert.strictEqual(r.students[0].matches[0].id, 103, "the assignee's own student is listed first");
  assert.strictEqual(r.due, '2026-11-28');
  assert.strictEqual(r.time, '11:30');
});

test('a surname or initial narrows the choice to one student', () => {
  assert.deepStrictEqual(ids(p('Renuka: follow up with Vivaan Mehta on attendance')), [104]);
  assert.deepStrictEqual(ids(p('Preety to follow up with Vivaan N')), [102]);
});

test('with no person named, the student decides who gets it', () => {
  const r = p('Call Aarna Bansal parents about renewal by Monday');
  assert.deepStrictEqual(r.assignees, ['Dhiraj Singh']);
  assert.strictEqual(r.assumed.assignee, true);
  assert.strictEqual(r.due, '2026-11-30');
  assert.ok(r.subject.startsWith('Renewal follow-up'), r.subject);
});

test('several people, everyone, and myself', () => {
  assert.deepStrictEqual(p('Nida and Renuka to update chapter planning').assignees.sort(), ['Nida Afreen', 'Renuka Naik']);
  assert.strictEqual(p('All TMs clear pending approvals today by 6').assignees.length, 5);
  assert.strictEqual(p('All TMs clear pending approvals today by 6').time, '18:00');
  assert.deepStrictEqual(p('Remind me to review the renewal list on 2 Dec').assignees, ['Roshan Adhikari']);
});

test('a person mentioned inside the task is not made the assignee', () => {
  assert.deepStrictEqual(p('Ask Nida to share the report with Roshan').assignees, ['Nida Afreen']);
});

test('student by ID, and alias of a TM', () => {
  const r = p('Dhiraj Kumar to connect with 10667 in 3 days');
  assert.deepStrictEqual(r.assignees, ['Dhiraj Singh']);
  assert.deepStrictEqual(ids(r), [10667]);
  assert.strictEqual(r.due, '2026-11-29');
});

test('ordinary words are not taken as student names, numbers are not times or ids', () => {
  const r = p('Preety will you please call 5 parents who missed class');
  assert.deepStrictEqual(r.students, []);
  assert.strictEqual(r.time, '');
  assert.strictEqual(r.due, '2026-11-26');
  assert.strictEqual(r.assumed.date, true);
});

test('date and time formats', () => {
  assert.strictEqual(p('Nida report 28/11').due, '2026-11-28');
  assert.strictEqual(p('Nida report 02-12-2026').due, '2026-12-02');
  assert.strictEqual(p('Nida report December 3rd').due, '2026-12-03');
  assert.strictEqual(p('Nida report day after tomorrow').due, '2026-11-28');
  assert.strictEqual(p('Nida report on Thursday').due, '2026-12-03', 'same weekday means next week');
  assert.strictEqual(p('Nida report 5 Jan').due, '2027-01-05', 'a month already gone means next year');
  assert.strictEqual(p('Nida report at 17:45').time, '17:45');
  assert.strictEqual(p('Nida report today EOD').time, '20:00');
  assert.strictEqual(p('Nida report 12 pm').time, '12:00');
  assert.strictEqual(p('Nida report 31/02').assumed.date, true, 'an impossible date is not used');
});

test('warnings: time already gone today, nobody found, student of another TM', () => {
  assert.ok(p('Nida call parents today at 9am').warnings.some((w) => /already passed/i.test(w)));
  assert.ok(p('call the parents').warnings.some((w) => /who/i.test(w)));
  assert.ok(p('Nida to call Aarna Bansal').warnings.some((w) => /Dhiraj/.test(w)));
});

test('a TM gets the task themselves when nobody is named', () => {
  const r = p('call Vivaan parents', { role: 'tm', me: 'Nida Afreen', students: students.filter((s) => s.tm === 'Nida Afreen') });
  assert.deepStrictEqual(r.assignees, ['Nida Afreen']);
  assert.deepStrictEqual(ids(r), [103]);
});

test('empty or junk input does not throw', () => {
  for (const x of ['', '   ', '!!!', null, undefined, '12345678']) assert.ok(p(x));
});

test('names that collide with team names or ordinary words', () => {
  const more = students.concat({ id: 200, name: 'Nida Khan', grade: '6', school: 'X', tm: 'Renuka Naik' });
  const r = p('Preety to call Nida Khan parents', { students: more });
  assert.deepStrictEqual(r.assignees, ['Preety Gour'], 'a student called Nida does not make Nida the assignee');
  assert.deepStrictEqual(ids(r), [200]);
  assert.deepStrictEqual(ids(p('Barnali to call Param-preet today')), [107]);
  assert.deepStrictEqual(ids(p('Barnali to call Will Joseph')), [108]);
  assert.deepStrictEqual(p('Barnali will you call the parents').students, []);
});

test('a full real sentence with extras after the first line', () => {
  const r = p('Renuka - PTM for Vivaan Mehta on Monday at 4. Discuss maths and science results.\nShare the report before the call.');
  assert.deepStrictEqual(r.assignees, ['Renuka Naik']);
  assert.strictEqual(r.time, '16:00');
  assert.strictEqual(r.assumed.time, true);
  assert.strictEqual(r.subject, 'Schedule PTM · Maths and Science – Vivaan Mehta');
  assert.ok(r.action.includes('Share the report before the call'), r.action);
});
