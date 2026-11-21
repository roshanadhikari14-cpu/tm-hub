// Post-PTM remarks written by the TM for each meeting. Saved in data/ptm-remarks.json (synced like the other data files).
const fs = require('fs');
const path = require('path');
const { DATA } = require('./paths');

const FILE = path.join(DATA, 'ptm-remarks.json');
function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}
function set(id, text, by, extra = {}) {
  const db = load();
  const t = String(text || '').trim().slice(0, 2000);
  if (!t) delete db[id];
  else db[id] = { text: t, by: by || '', at: new Date().toISOString(), ...extra };
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db));
  return db[id] || null;
}
module.exports = { load, set };
