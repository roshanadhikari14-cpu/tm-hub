const DiskCache = require('./diskCache');
// Tutor leaves, read live from Lighthouse (Attendance & Leave > Tutor Leaves).
// The list is newest-first by start date, so only the first pages are needed: leaves that ended before today are not wanted.
const BASE = 'https://backend.uprio.com/api/v2/';

function headers() {
  const h = { Accept: 'application/json' };
  if (process.env.LIGHTHOUSE_AUTH) h.Authorization = process.env.LIGHTHOUSE_AUTH;
  if (process.env.LIGHTHOUSE_COOKIE) h.Cookie = process.env.LIGHTHOUSE_COOKIE;
  return h;
}
// Lighthouse stores India midnight as UTC (18:30Z), so the India calendar day is 5.5 hours later
const istDay = (iso) => new Date(new Date(iso).getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const addDays = (day, n) => {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

let mem = { at: 0, data: null };
const bust = () => {
  mem = { at: 0, data: null };
};

let running = null;
async function load(fresh) {
  if (fresh) return read();
  if (!mem.data) {
    const saved = DiskCache.get('tutor-leaves'); // a fresh server answers from today's last copy
    if (saved && saved.data.today === istDay(new Date().toISOString())) mem = { at: saved.at, data: saved.data };
  }
  if (!mem.data) return read();
  if (Date.now() - mem.at > 60 * 1000 && !running) running = read().catch(() => {}).finally(() => (running = null));
  return mem.data;
}
async function read() {
  const today = istDay(new Date().toISOString());
  // a leave that started up to 60 days ago can still be running
  const stop = addDays(today, -60);
  const out = [];
  for (let page = 1; page <= 12; page++) {
    const r = await fetch(`${BASE}tutor-leaves?page=${page}&pageSize=300`, { headers: headers() });
    if (!r.ok) throw new Error(`Lighthouse tutor leaves: HTTP ${r.status}`);
    const j = await r.json();
    let oldest = '9999';
    for (const x of j.docs || []) {
      const from = istDay(x.fromDate);
      const to = istDay(x.toDate);
      oldest = from < oldest ? from : oldest;
      if (to < today) continue;
      out.push({
        id: x.id, tutorId: String(x.tutorId), name: x.tutorName, email: x.tutorEmail, tm: x.tutorManagerName || '', stm: x.seniorTutorManagerName || '',
        type: x.leaveType || '', from, to, remarks: x.remarks || '', addedBy: x.addedBy || '', addedOn: x.addedOn || '',
      });
    }
    if (!j.hasNextPage || oldest < stop) break;
  }
  out.sort((a, b) => a.from.localeCompare(b.from) || a.name.localeCompare(b.name));
  mem = { at: Date.now(), data: { today, at: new Date().toISOString(), leaves: out } };
  DiskCache.put('tutor-leaves', mem.data);
  return mem.data;
}
module.exports = { load, bust };
