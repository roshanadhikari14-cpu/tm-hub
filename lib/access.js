// Who may use the hub, and what they may see.
//   owner  : OWNER_EMAIL. Everything.
//   tm     : a TM in team.json. Their own tasks and students, plus overall team numbers.
//   viewer : any other @uprio.com person the owner approved. Overall team numbers only.
// Anyone else asks for access: the owner gets a mail and can approve in Settings.
const fs = require('fs');
const path = require('path');
const { DATA } = require('./paths');

const FILE = path.join(DATA, 'access.json');
const empty = () => ({ approved: {}, pending: {}, denied: {} });

function load() {
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch {
    return empty();
  }
}
function save(db) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 1));
}
const norm = (e) => String(e || '').trim().toLowerCase();

// -> { role: 'owner' | 'tm' | 'viewer' | null, tm: 'Name' | '' , status: 'approved' | 'pending' | 'denied' | 'none' }
function roleOf(email, { owner = '', team = [], extra = [] } = {}) {
  const e = norm(email);
  if (!e) return { role: null, tm: '', status: 'none' };
  if (e === norm(owner)) return { role: 'owner', tm: '', status: 'approved' };
  const m = team.find((t) => norm(t.email) === e);
  if (m) return { role: 'tm', tm: m.name, status: 'approved' };
  if (extra.map(norm).includes(e)) return { role: 'viewer', tm: '', status: 'approved' };
  const db = load();
  if (db.approved[e]) return { role: 'viewer', tm: '', status: 'approved' };
  if (db.denied[e]) return { role: null, tm: '', status: 'denied' };
  if (db.pending[e]) return { role: null, tm: '', status: 'pending' };
  return { role: null, tm: '', status: 'none' };
}

// Records a request. Returns true when it is new (so the owner should be mailed).
function request(email, name = '') {
  const e = norm(email);
  const db = load();
  if (db.approved[e] || db.pending[e] || db.denied[e]) return false;
  db.pending[e] = { at: new Date().toISOString(), name: String(name || '') };
  save(db);
  return true;
}
function decide(email, action, by = '') {
  const e = norm(email);
  const db = load();
  const who = db.pending[e] || db.approved[e] || db.denied[e] || {};
  delete db.pending[e];
  delete db.approved[e];
  delete db.denied[e];
  if (action === 'approve') db.approved[e] = { at: new Date().toISOString(), by, name: who.name || '' };
  else if (action === 'deny') db.denied[e] = { at: new Date().toISOString(), by, name: who.name || '' };
  // 'remove' leaves nothing behind: the person can ask again.
  save(db);
}
function list() {
  const db = load();
  const rows = (o, status) => Object.entries(o).map(([email, v]) => ({ email, status, ...v }));
  return { pending: rows(db.pending, 'pending'), approved: rows(db.approved, 'approved'), denied: rows(db.denied, 'denied') };
}

// What a non-owner may see of the board: their own row in full, everyone else only as unnamed totals.
function scrubBoard(b, role, myTm) {
  if (!b || role === 'owner') return b;
  const nums = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => typeof v === 'number' || k(v)));
  function k(v) {
    return typeof v === 'string';
  }
  const anon = (r) => ({
    name: 'Team member',
    first: 'Team',
    email: '',
    photo: null,
    lighthouseName: '',
    tasks: Object.fromEntries(Object.entries(r.tasks).map(([key, t]) => [key, { ...nums(t), items: [], hints: [] }])),
    perf: { score: r.perf.score, grade: '', metrics: {}, students: r.perf.students },
    concerns: [],
  });
  const mine = role === 'tm' ? b.rows.filter((r) => r.name === myTm) : [];
  const teamRows = b.rows.map(anon).sort((x, y) => y.perf.score - x.perf.score);
  return { ...b, rows: mine, teamRows, scoped: true };
}

module.exports = { roleOf, request, decide, list, scrubBoard, norm };
