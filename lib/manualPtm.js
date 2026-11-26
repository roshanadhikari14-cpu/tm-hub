// PTMs the TM records by hand (for example one held on Google Meet). They are kept in the hub only, never written
// to Lighthouse: either a "done" mark on a meeting Lighthouse already has, or a meeting added from scratch.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA } = require('./paths');

const FILE = path.join(DATA, 'manual-ptm.json');
function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { marks: d.marks || {}, added: d.added || [] };
  } catch {
    return { marks: {}, added: [] };
  }
}
function save(d) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(d));
}

// The Lighthouse list with the hand-recorded ones on top (the input list is not changed)
function overlay(meetings, from, to, db = load()) {
  const out = (meetings || []).map((m) => {
    const k = db.marks[m.id];
    if (!k) return m;
    return { ...m, status: 'completed', parentJoined: true, parentMinutes: k.minutes || m.parentMinutes, manual: true, manualBy: k.by, manualMark: true };
  });
  for (const a of db.added) if ((!from || a.date >= from) && (!to || a.date <= to)) out.push({ ...a });
  return out.sort((a, b) => String(a.start).localeCompare(String(b.start)));
}

const minutesOf = (v) => {
  const n = Math.round(Number(v));
  if (!(n >= 1 && n <= 240)) throw new Error('Enter how long the parent was on the call, 1 to 240 minutes.');
  return n;
};
function mark(id, minutes, by) {
  const db = load();
  db.marks[id] = { minutes: minutesOf(minutes), by: by || '', at: new Date().toISOString() };
  save(db);
}
function add({ studentId, student, tm, date, time, minutes, note, by }, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('Pick the date of the PTM.');
  if (today && date > today) throw new Error('The date cannot be in the future.');
  if (today && date < new Date(Date.parse(today + 'T00:00:00Z') - 60 * 86400000).toISOString().slice(0, 10)) throw new Error('Only PTMs of the last 60 days can be added.');
  if (!/^\d{2}:\d{2}$/.test(time || '')) throw new Error('Pick the time the PTM started.');
  const mins = minutesOf(minutes);
  const start = new Date(`${date}T${time}:00+05:30`);
  const db = load();
  const rec = {
    id: 'manual-' + crypto.randomBytes(8).toString('hex'),
    host: tm,
    studentId: Number(studentId),
    student,
    date,
    slot: time,
    start: start.toISOString(),
    end: new Date(start.getTime() + mins * 60000).toISOString(),
    status: 'completed',
    parentJoined: true,
    parentMinutes: mins,
    recording: false,
    agenda: String(note || '').trim().slice(0, 500) || 'Held on Google Meet',
    with: [],
    manual: true,
    manualBy: by || '',
  };
  db.added.push(rec);
  save(db);
  return rec;
}
// takes back a mark, or deletes a meeting that was added by hand
function remove(id) {
  const db = load();
  const had = Boolean(db.marks[id]) || db.added.some((a) => a.id === id);
  delete db.marks[id];
  db.added = db.added.filter((a) => a.id !== id);
  if (had) save(db);
  return had;
}

module.exports = { load, overlay, mark, add, remove };
