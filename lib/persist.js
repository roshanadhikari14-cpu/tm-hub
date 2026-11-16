// Keeps the data folder in a Redis database (Upstash, added from Vercel's
// Storage tab) so settings, the 11 AM baseline, history and the Google
// sign-in survive between serverless runs. Locally this does nothing.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { DATA } = require('./paths');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const enabled = Boolean(URL_ && TOKEN);
const FILES = 'tmhub:files';
const META = 'tmhub:meta';

async function redis(commands) {
  const res = await fetch(`${URL_.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Database error (HTTP ${res.status})`);
  const out = await res.json();
  const bad = out.find((r) => r.error);
  if (bad) throw new Error(`Database error: ${bad.error}`);
  return out.map((r) => r.result);
}

const known = new Map(); // relative path -> content hash this instance last saw
const hash = (buf) => crypto.createHash('md5').update(buf).digest('hex');

function walk(dir, base = '') {
  let out = [];
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {}
  for (const n of names) {
    const full = path.join(dir, n);
    const rel = base ? `${base}/${n}` : n;
    if (fs.statSync(full).isDirectory()) out = out.concat(walk(full, rel));
    else out.push(rel);
  }
  return out;
}

// Brings /tmp up to date with the database.
async function pull() {
  if (!enabled) return;
  const [meta] = await redis([['HGETALL', META]]);
  const want = {};
  for (let i = 0; i < (meta || []).length; i += 2) want[meta[i]] = meta[i + 1];
  const stale = Object.keys(want).filter((rel) => known.get(rel) !== want[rel] || !fs.existsSync(path.join(DATA, rel)));
  if (stale.length) {
    const bodies = await redis(stale.map((rel) => ['HGET', FILES, rel]));
    stale.forEach((rel, i) => {
      if (!bodies[i]) return;
      const full = path.join(DATA, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, zlib.gunzipSync(Buffer.from(bodies[i], 'base64')));
      known.set(rel, want[rel]);
    });
  }
  // Files removed elsewhere (for example a Google sign-out).
  for (const rel of walk(DATA)) {
    if (!(rel in want) && known.has(rel)) {
      fs.rmSync(path.join(DATA, rel), { force: true });
      known.delete(rel);
    }
  }
}

// Saves whatever changed in /tmp back to the database.
async function push() {
  if (!enabled) return;
  const cmds = [];
  const seen = new Set();
  for (const rel of walk(DATA)) {
    seen.add(rel);
    const buf = fs.readFileSync(path.join(DATA, rel));
    const h = hash(buf);
    if (known.get(rel) === h) continue;
    cmds.push(['HSET', FILES, rel, zlib.gzipSync(buf).toString('base64')], ['HSET', META, rel, h]);
    known.set(rel, h);
  }
  for (const rel of [...known.keys()]) {
    if (!seen.has(rel)) {
      cmds.push(['HDEL', FILES, rel], ['HDEL', META, rel]);
      known.delete(rel);
    }
  }
  if (cmds.length) await redis(cmds);
}

module.exports = { enabled, pull, push };
