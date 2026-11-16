// "Sign in with Google" for sending mail through the Gmail API.
// Only accounts on the allowed Workspace domain are accepted.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MailComposer = require('nodemailer/lib/mail-composer');

const DOMAIN = 'uprio.com';
const FILE = path.join(__dirname, '..', 'data', 'google.json');
const SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/gmail.send'];

const clientReady = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const load = () => {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return null;
  }
};
const save = (v) => {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(v, null, 2));
};
const account = () => {
  const g = load();
  return g && g.refresh_token && allowed(g.email) ? g : null;
};
const allowed = (email) => typeof email === 'string' && email.toLowerCase().endsWith(`@${DOMAIN}`);
const signOut = () => {
  try {
    fs.unlinkSync(FILE);
  } catch {}
  cached = null;
};

// One-time values that tie the Google redirect back to the click that started it.
const states = new Map();
function authUrl(redirectUri) {
  if (!clientReady()) throw new Error('Add the Google client ID and secret in Settings first.');
  const state = crypto.randomBytes(16).toString('hex');
  states.set(state, Date.now());
  for (const [k, t] of states) if (Date.now() - t > 10 * 60 * 1000) states.delete(k);
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    hd: DOMAIN,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function token(params) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...params }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(j.error_description || j.error || `Google sign-in failed (HTTP ${res.status})`);
    e.code = j.error;
    throw e;
  }
  return j;
}

async function finish(code, state, redirectUri) {
  if (!state || !states.has(state)) throw new Error('This sign-in link has expired. Start again from Settings.');
  states.delete(state);
  const t = await token({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
  // The ID token comes straight from Google over HTTPS, so its claims can be read directly.
  const claims = JSON.parse(Buffer.from(String(t.id_token || '').split('.')[1] || '', 'base64url').toString('utf8') || '{}');
  if (!claims.email_verified || claims.hd !== DOMAIN || !allowed(claims.email))
    throw new Error(`Only @${DOMAIN} accounts can sign in. You chose ${claims.email || 'another account'}.`);
  if (!String(t.scope || '').includes('gmail.send')) throw new Error('Permission to send email was not ticked on the Google screen. Sign in again and allow it.');
  if (!t.refresh_token) throw new Error('Google did not return a long-term sign-in. Try signing in again.');
  save({ email: claims.email.toLowerCase(), name: claims.name || '', refresh_token: t.refresh_token, at: new Date().toISOString() });
  cached = { token: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 };
  return claims.email;
}

let cached = null;
async function accessToken() {
  const g = account();
  if (!g) throw new Error('Not signed in with Google. Sign in from Settings.');
  if (cached && cached.until > Date.now()) return cached.token;
  try {
    const t = await token({ refresh_token: g.refresh_token, grant_type: 'refresh_token' });
    cached = { token: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 };
    return cached.token;
  } catch (e) {
    if (e.code === 'invalid_grant') throw new Error('The Google sign-in has expired or was removed. Sign in again from Settings.');
    throw e;
  }
}

// msg: { fromName, to, cc, subject, html }. Always sent from the signed-in address.
async function send(msg) {
  const g = account();
  const at = await accessToken();
  const raw = await new MailComposer({ from: { name: msg.fromName, address: g.email }, to: msg.to, cc: msg.cc, subject: msg.subject, html: msg.html }).compile().build();
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: raw.toString('base64url') }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(`Gmail refused the mail: ${(j.error && j.error.message) || `HTTP ${res.status}`}`);
  }
}

module.exports = { DOMAIN, clientReady, account, authUrl, finish, accessToken, send, signOut };
