// The hub's storage on a Neon (Postgres) database, spoken to over Neon's SQL-over-HTTP endpoint, so no extra package
// is needed. It answers the same four commands lib/persist.js used with Redis (HGETALL, HGET, HSET, HDEL), keeping each
// saved file as one row: its path, its packed contents and the hash of the contents.

// Vercel's Neon connection adds DATABASE_URL / POSTGRES_URL (sometimes with a prefix chosen on the connect screen).
function findUrl(env = process.env) {
  const names = ['DATABASE_URL', 'POSTGRES_URL', ...Object.keys(env).filter((k) => /_(DATABASE|POSTGRES)_URL$/.test(k)).sort()];
  for (const n of names) if (/^postgres(ql)?:\/\//.test(env[n] || '')) return env[n];
  return '';
}

// https://api.<the rest of the database host>/sql
const endpoint = (conn) => 'https://' + new URL(conn).hostname.replace(/^[^.]+\./, 'api.') + '/sql';

function client(conn) {
  async function send(queries) {
    const res = await fetch(endpoint(conn), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': conn, 'Neon-Raw-Text-Output': 'true', 'Neon-Array-Mode': 'true' },
      body: JSON.stringify({ queries }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = '';
      try {
        msg = JSON.parse(text).message;
      } catch {}
      throw new Error(`Database error (HTTP ${res.status})${msg ? ': ' + msg : ''}`);
    }
    const j = await res.json();
    if (!Array.isArray(j.results)) throw new Error('Database error: unexpected answer');
    return j.results.map((r) => r.rows || []);
  }

  let ready = null;
  const prepare = () => {
    if (!ready)
      ready = send([{ query: 'CREATE TABLE IF NOT EXISTS hub_files (rel text PRIMARY KEY, body text, hash text)', params: [] }]).catch((e) => {
        ready = null;
        throw e;
      });
    return ready;
  };

  // the second word of a command says which column it means: ...:files is the contents, ...:meta is the hash
  const column = (key) => (key.endsWith(':meta') ? 'hash' : 'body');

  return async function commands(list) {
    await prepare();
    const queries = list.map(([cmd, key, rel, value]) => {
      const col = column(key);
      if (cmd === 'HGETALL') return { query: `SELECT rel, ${col} FROM hub_files WHERE ${col} IS NOT NULL`, params: [] };
      if (cmd === 'HGET') return { query: `SELECT ${col} FROM hub_files WHERE rel = $1`, params: [rel] };
      if (cmd === 'HSET') return { query: `INSERT INTO hub_files (rel, ${col}) VALUES ($1, $2) ON CONFLICT (rel) DO UPDATE SET ${col} = EXCLUDED.${col}`, params: [rel, value] };
      if (cmd === 'HDEL') return { query: 'DELETE FROM hub_files WHERE rel = $1', params: [rel] };
      throw new Error('Unknown storage command ' + cmd);
    });
    const results = await send(queries);
    return list.map(([cmd], i) => {
      if (cmd === 'HGETALL') return results[i].flat();
      if (cmd === 'HGET') return results[i][0] ? results[i][0][0] : null;
      return 1;
    });
  };
}

module.exports = { findUrl, endpoint, client };
