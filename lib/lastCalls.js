// The last connected call with each student's parent, and how long it lasted.
// Lighthouse lists every connected parent call of a day (tm-work-report/details, metric parents.calls), so the last
// three weeks are read day by day. Finished days never change, so they are saved once (data/call-days.json).
const fs = require('fs');
const path = require('path');
const { DATA } = require('./paths');
const { istDate, addDays } = require('./lighthouse');

const BASE = 'https://backend.uprio.com/api/v2/';
const FILE = path.join(DATA, 'call-days.json');
const KEEP_DAYS = 30;

function headers() {
  const h = { Accept: 'application/json' };
  if (process.env.LIGHTHOUSE_AUTH) h.Authorization = process.env.LIGHTHOUSE_AUTH;
  if (process.env.LIGHTHOUSE_COOKIE) h.Cookie = process.env.LIGHTHOUSE_COOKIE;
  return h;
}
const load = () => {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
};
const save = (db) => {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db));
};

async function dayCalls(date) {
  const out = [];
  for (let page = 1; page < 10; page++) {
    const r = await fetch(`${BASE}tm-work-report/details?period=day&date=${date}&metric=parents.calls&page=${page}&pageSize=500`, { headers: headers() });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const d = j.data || {};
    for (const x of d.items || []) if (x.connected && x.studentId) out.push({ s: x.studentId, a: x.at, sec: x.seconds || 0, inc: !!x.incoming, tm: x.tmName });
    if (page >= (d.pages || 1)) break;
  }
  return out;
}

let mem = { at: 0, map: null };
async function lastCalls(days = 21) {
  if (mem.map && Date.now() - mem.at < 3 * 60 * 1000) return mem.map;
  const today = istDate();
  const db = load();
  const want = [];
  for (let i = 0; i < days; i++) want.push(addDays(today, -i));
  // today is always read again; older days only when they are not saved yet
  const todo = want.filter((d) => d === today || d === addDays(today, -1) || !db[d]);
  const stopAt = Date.now() + (process.env.VERCEL ? 20000 : 90000);
  const queue = todo.slice();
  const worker = async () => {
    while (queue.length && Date.now() < stopAt) {
      const d = queue.shift();
      try {
        db[d] = await dayCalls(d);
      } catch (e) {
        if (!db[d]) db[d] = undefined;
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  // drop old days and days that failed
  for (const k of Object.keys(db)) if (!db[k] || k < addDays(today, -KEEP_DAYS)) delete db[k];
  save(db);
  const map = {};
  for (const d of Object.keys(db).sort()) for (const c of db[d]) {
    const cur = map[c.s];
    if (!cur || c.a > cur.at) map[c.s] = { at: c.a, seconds: c.sec, incoming: c.inc, tm: c.tm };
  }
  mem = { at: Date.now(), map };
  return map;
}
module.exports = { lastCalls };
