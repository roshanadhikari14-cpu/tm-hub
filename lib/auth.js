// Signed login cookie. Used when the hub is on the internet (Vercel), where
// every page of data sits behind "Sign in with Google".
const crypto = require('crypto');

const COOKIE = 'tmhub';
const DAYS = 7;
let fallback = null;
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.GOOGLE_CLIENT_SECRET) return crypto.createHmac('sha256', process.env.GOOGLE_CLIENT_SECRET).update('tm-hub-session').digest('hex');
  if (!fallback) fallback = crypto.randomBytes(32).toString('hex');
  return fallback;
}
const mac = (s) => crypto.createHmac('sha256', secret()).update(s).digest('base64url');

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${mac(body)}`;
}
function verify(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const good = mac(body);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p.exp && p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
const flags = (req) => `Path=/; HttpOnly; SameSite=Lax${req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`;
function setCookie(req, res, name, value, maxAgeSec) {
  const prev = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : [prev]), `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; ${flags(req)}`]);
}

const user = (req) => {
  const p = verify(cookies(req)[COOKIE]);
  return p ? p.e : null;
};
const signIn = (req, res, email) => setCookie(req, res, COOKIE, sign({ e: email, exp: Date.now() + DAYS * 86400000 }), DAYS * 86400);
const signOut = (req, res) => setCookie(req, res, COOKIE, '', 0);

module.exports = { sign, verify, cookies, setCookie, user, signIn, signOut };
