// "Sign in with Google": used to log in to the hub and, for the owner, to
// send mail through the Gmail API. Only accounts on the allowed Workspace
// domain are accepted.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MailComposer = require('nodemailer/lib/mail-composer');
const { DATA } = require('./paths');
const auth = require('./auth');

const DOMAIN = 'uprio.com';
const FILE = path.join(DATA, 'google.json');
const BASE_SCOPES = ['openid', 'email', 'profile'];
const SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

const clientReady = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const load = () => {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return null;
  }
};
const allowed = (email) => typeof email === 'string' && email.toLowerCase().endsWith(`@${DOMAIN}`);
// The mailbox the hub sends from.
const account = () => {
  const g = load();
  return g && g.refresh_token && allowed(g.email) ? g : null;
};
function saveSender(email, name, refreshToken) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ email: email.toLowerCase(), name: name || '', refresh_token: refreshToken, at: new Date().toISOString() }, null, 2));
  cached = null;
}
const signOut = () => {
  try {
    fs.unlinkSync(FILE);
  } catch {}
  cached = null;
};

// mode "login" only proves who you are; mode "send" also asks to send mail.
// The state is signed (no server memory needed) and tied to the browser by a cookie.
function authUrl(redirectUri, mode = 'send') {
  if (!clientReady()) throw new Error('The Google sign-in client is not set up yet.');
  const nonce = crypto.randomBytes(16).toString('hex');
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: (mode === 'send' ? [...BASE_SCOPES, SEND_SCOPE] : BASE_SCOPES).join(' '),
    hd: DOMAIN,
    state: auth.sign({ m: mode, n: nonce, exp: Date.now() + 10 * 60 * 1000 }),
    ...(mode === 'send' ? { access_type: 'offline', prompt: 'consent' } : { prompt: 'select_account' }),
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${q}`, nonce };
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

// Checks the redirect from Google and returns who signed in.
async function finish(code, state, redirectUri, cookieNonce) {
  const st = auth.verify(state);
  if (!st || !cookieNonce || st.n !== cookieNonce) throw new Error('This sign-in link has expired. Please start again.');
  const t = await token({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
  // The ID token comes straight from Google over HTTPS, so its claims can be read directly.
  const claims = JSON.parse(Buffer.from(String(t.id_token || '').split('.')[1] || '', 'base64url').toString('utf8') || '{}');
  if (!claims.email_verified || claims.hd !== DOMAIN || !allowed(claims.email))
    throw new Error(`Only @${DOMAIN} accounts can sign in. You chose ${claims.email || 'another account'}.`);
  return {
    mode: st.m,
    email: claims.email.toLowerCase(),
    name: claims.name || '',
    canSend: String(t.scope || '').includes('gmail.send'),
    refreshToken: t.refresh_token || null,
  };
}

let cached = null;
async function accessToken() {
  const g = account();
  if (!g) throw new Error('No mailbox is connected. Connect it with Google in Settings.');
  if (cached && cached.for === g.refresh_token && cached.until > Date.now()) return cached.token;
  try {
    const t = await token({ refresh_token: g.refresh_token, grant_type: 'refresh_token' });
    cached = { for: g.refresh_token, token: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 };
    return cached.token;
  } catch (e) {
    if (e.code === 'invalid_grant') throw new Error('The Google connection has expired or was removed. Connect it again in Settings.');
    throw e;
  }
}

// msg: { fromName, to, cc, subject, html }. Always sent from the connected address.
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

module.exports = { DOMAIN, clientReady, allowed, account, saveSender, authUrl, finish, accessToken, send, signOut };
