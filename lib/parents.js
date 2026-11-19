// Parent / guardian name and phone for each student, from Lighthouse (the same list the
// "send payment link" screen uses). Saved in data/parents.json so it is only fetched once in a while.
const fs = require('fs');
const path = require('path');
const { DATA } = require('./paths');

const BASE = 'https://backend.uprio.com/api/v2/';
const FILE = path.join(DATA, 'parents.json');
const MAX_AGE = 14 * 86400000;

function headers() {
  const h = { Accept: 'application/json' };
  if (process.env.LIGHTHOUSE_AUTH) h.Authorization = process.env.LIGHTHOUSE_AUTH;
  if (process.env.LIGHTHOUSE_COOKIE) h.Cookie = process.env.LIGHTHOUSE_COOKIE;
  return h;
}
function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}
function save(db) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db));
}
const cap = (s) => String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());

async function fetchOne(id) {
  const r = await fetch(`${BASE}students/${id}/payment-link-recipients`, { headers: headers() });
  if (r.status === 401 || r.status === 403) throw new Error('Lighthouse refused the login. Paste a fresh login in Settings.');
  if (!r.ok) return null;
  const j = await r.json();
  const list = (j.data || []).filter((x) => x.userType === 'guardian' && (x.mobileNumber || x.firstName));
  return list
    .map((x) => ({
      name: [x.firstName, x.lastName].filter(Boolean).join(' ').trim(),
      relation: cap(x.relationship),
      phone: String(x.mobileNumber || '').trim(),
      email: x.email || '',
      primary: Boolean(x.isPrimaryContact),
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary));
}

// Makes sure every id has fresh data (fetching a few at a time), then returns { id: [guardians] }.
async function ensure(ids, { concurrency = 10 } = {}) {
  const db = load();
  const now = Date.now();
  const todo = [...new Set(ids.map(Number))].filter((id) => id && (!db[id] || now - db[id].at > MAX_AGE));
  let i = 0;
  let err = null;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, todo.length) }, async () => {
      while (i < todo.length && !err) {
        const id = todo[i++];
        try {
          const g = await fetchOne(id);
          if (g) db[id] = { at: now, g };
        } catch (e) {
          err = e;
        }
      }
    })
  );
  if (todo.length) save(db);
  if (err && !ids.some((id) => db[Number(id)])) throw err;
  return Object.fromEntries(ids.map((id) => [id, (db[Number(id)] || {}).g || []]));
}

module.exports = { ensure };
