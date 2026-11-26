// Copies the PTM remarks back from the old Redis (Upstash) database, which was suspended for its monthly bandwidth
// limit, once it answers again. Runs with the daily backup; stops trying after the first success.
// A remark written since the move is never overwritten.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { DATA } = require('./paths');
const Remarks = require('./ptmRemarks');

const DONE = path.join(DATA, 'old-remarks-restored.json');

async function restoreRemarks(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { state: 'no old database connected' };
  if (fs.existsSync(DONE)) return { state: 'already restored', ...JSON.parse(fs.readFileSync(DONE, 'utf8')) };
  const res = await fetch(url.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['HGET', 'tmhub:files', 'ptm-remarks.json']]),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return { state: `old database still locked (HTTP ${res.status})` };
  const out = await res.json();
  if (out[0] && out[0].error) return { state: 'old database still locked: ' + out[0].error };
  const old = out[0] && out[0].result ? JSON.parse(zlib.gunzipSync(Buffer.from(out[0].result, 'base64')).toString('utf8')) : {};
  const now = Remarks.load();
  let added = 0;
  for (const [id, r] of Object.entries(old))
    if (!now[id]) {
      now[id] = r;
      added++;
    }
  fs.mkdirSync(DATA, { recursive: true });
  if (added) fs.writeFileSync(path.join(DATA, 'ptm-remarks.json'), JSON.stringify(now));
  const info = { at: new Date().toISOString(), found: Object.keys(old).length, added };
  fs.writeFileSync(DONE, JSON.stringify(info));
  return { state: 'restored now', ...info };
}

module.exports = { restoreRemarks };
