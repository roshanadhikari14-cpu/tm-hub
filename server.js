// TM Hub: live task board, TM profiles and the three daily emails
// (11 AM targets, 5 PM progress, 8 PM closure), Monday to Saturday.
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const ENV_FILE = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: ENV_FILE });
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const nodemailer = require('nodemailer');
const { fetchAll, loadLatest, istDate, addDays, ptmMeetings, studentPtms } = require('./lib/lighthouse');
const M = require('./lib/model');
const { tmEmail, teamEmail, SLOT } = require('./lib/emails');
const G = require('./lib/google');
const auth = require('./lib/auth');
const persist = require('./lib/persist');
const Remarks = require('./lib/ptmRemarks');
const PRem = require('./lib/ptmReminders');
const TutorLeaves = require('./lib/tutorLeaves');
const { restoreRemarks } = require('./lib/recover');
const LastCalls = require('./lib/lastCalls');
const Parents = require('./lib/parents');
const Access = require('./lib/access');
const { DATA, CLOUD } = require('./lib/paths');

const ROOT = __dirname;
const CONFIG = path.join(DATA, 'config.json');
const PORT = Number(process.env.HUB_PORT) || 3100;
const SLOTS = ['morning', 'progress', 'closure'];

const readJson = (f, fb) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return fb;
  }
};
const writeJson = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(v, null, 2));
};
const team = () => readJson(path.join(ROOT, 'team.json'), []);

const istNow = () => {
  const d = new Date();
  return {
    date: istDate(d),
    time: d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }),
    day: d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }),
  };
};
const mins = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

// ---------- Config ----------

const DEFAULTS = {
  enabled: true,
  talkTargetMin: 90,
  slots: { morning: '11:00', progress: '17:00', closure: '20:00' },
  sendIndividual: true,
  sendTeam: true,
  last: { morning: null, progress: null, closure: null, baseline: null },
  log: [],
  // Google Drive folder "Student Report Doc" where PTM reports are saved.
  reportFolder: '1l42P9y5HovlOAsa0wh1JvrjMO4GiMY9W',
};
function loadConfig() {
  const c = readJson(CONFIG, null);
  if (!c) {
    // First start: slots already past today count as done, so nothing goes
    // out the moment the hub is first opened.
    const now = istNow();
    const fresh = JSON.parse(JSON.stringify(DEFAULTS));
    for (const s of SLOTS) if (mins(now.time) >= mins(fresh.slots[s])) fresh.last[s] = now.date;
    writeJson(CONFIG, fresh);
    return fresh;
  }
  return { ...DEFAULTS, ...c, slots: { ...DEFAULTS.slots, ...c.slots }, last: { ...DEFAULTS.last, ...c.last } };
}
const saveConfig = (c) => writeJson(CONFIG, c);

// On Vercel there is no .env file to write, so settings saved from the
// Settings page go into the data folder (and from there to the database).
const CLOUD_ENV = path.join(DATA, 'env.json');
const CLOUD_KEYS = ['ANTHROPIC_API_KEY', 'LIGHTHOUSE_AUTH', 'LIGHTHOUSE_COOKIE', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'FROM_NAME', 'FROM_EMAIL'];
function loadCloudEnv() {
  const e = readJson(CLOUD_ENV, {});
  for (const k of CLOUD_KEYS)
    if (e[k] !== undefined && process.env[k] !== e[k]) {
      process.env[k] = e[k];
      transporter = null;
    }
}
function saveEnv(key, value) {
  process.env[key] = value;
  if (CLOUD) return writeJson(CLOUD_ENV, { ...readJson(CLOUD_ENV, {}), [key]: value });
  let env = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  env = re.test(env) ? env.replace(re, () => line) : `${env.trimEnd()}\n${line}\n`;
  fs.writeFileSync(ENV_FILE, env);
}

// ---------- Data ----------

let refreshing = null;
let lastRefreshError = null;
async function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const A = await fetchAll(team());
      lastRefreshError = null;
      const cfg = loadConfig();
      M.recordHistory(A.date, M.build(A, team(), cfg, M.slotNow(cfg)).rows);
      return A;
    } catch (e) {
      lastRefreshError = e.message;
      throw e;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function board(slot) {
  const A = loadLatest();
  if (!A) return null;
  const cfg = loadConfig();
  // The baseline is the first data seen today (normally the 11 AM run).
  if (A.date === istNow().date) M.ensureBaseline(A, team());
  return M.build(A, team(), cfg, SLOTS.includes(slot) ? slot : M.slotNow(cfg));
}

// ---------- Email ----------

const sender = () => ({ name: process.env.FROM_NAME || 'Roshan Adhikari', title: process.env.FROM_TITLE || 'Senior Tutor Manager · UPRIO' });
const smtpConfigured = () =>
  Boolean(process.env.SMTP_USER && process.env.SMTP_PASS) && !/your\.name/i.test(process.env.SMTP_USER) && !/^x+$/i.test(process.env.SMTP_PASS);
// Google sign-in wins when present; the App Password is the fallback.
const emailConfigured = () => Boolean(G.account()) || smtpConfigured();
// With another mail server (Postal, a relay) the login name is not an address, so FROM_EMAIL names the sender.
const senderAddr = () => (G.account() ? G.account().email : process.env.FROM_EMAIL || process.env.SMTP_USER);
const smtpHost = () => process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = () => Number(process.env.SMTP_PORT) || 465;
let transporter = null;
function mailer() {
  if (!smtpConfigured()) throw new Error('Email is not set up. Sign in with Google in Settings.');
  if (!transporter)
    transporter = nodemailer.createTransport({ host: smtpHost(), port: smtpPort(), secure: smtpPort() === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  return transporter;
}

// Sends one slot: a mail to each TM, and the team board to everyone (TMs in CC).
async function sendSlot(slot, { test = false, names = null, includeTeam = true, includeIndividual = true } = {}) {
  const b = board(slot);
  if (!b) throw new Error('No Lighthouse data yet. Click Refresh first.');
  const me = senderAddr();
  const viaGoogle = Boolean(G.account());
  const smtp = viaGoogle ? null : mailer();
  const tx = { sendMail: (m) => (viaGoogle ? G.send({ fromName: sender().name, ...m }) : smtp.sendMail({ from: `"${sender().name}" <${me}>`, ...m })) };
  const extraCc = (process.env.CC || '').split(',').map((s) => s.trim()).filter(Boolean);
  const results = [];
  if (includeIndividual) {
    for (const row of b.rows) {
      if (names && !names.includes(row.name)) continue;
      const mail = tmEmail(row, b, slot, sender());
      const to = test ? me : row.email;
      try {
        await tx.sendMail({ to, cc: !test && extraCc.length ? extraCc : undefined, subject: (test ? `[TEST for ${row.first}] ` : '') + mail.subject, html: mail.html });
        results.push({ who: row.name, to, ok: true });
      } catch (e) {
        results.push({ who: row.name, to, ok: false, error: mailErr(e) });
      }
    }
  }
  if (includeTeam) {
    const mail = teamEmail(b, slot, sender());
    const tmEmails = b.rows.map((r) => r.email);
    try {
      await tx.sendMail({
        to: me,
        cc: test ? undefined : [...tmEmails, ...extraCc],
        subject: (test ? '[TEST] ' : '') + mail.subject,
        html: mail.html,
      });
      results.push({ who: 'Team board', to: test ? me : `you + CC ${tmEmails.length} TMs`, ok: true });
    } catch (e) {
      results.push({ who: 'Team board', ok: false, error: mailErr(e) });
    }
  }
  return results;
}

// ---------- Scheduler ----------

let running = false;
// 10 AM: pull Lighthouse and fix the day's starting list. Everything later in the day
// (11 AM, 5 PM, 8 PM) is counted against this.
const BASELINE_AT = '10:00';
async function takeBaseline() {
  await refresh();
  const A = loadLatest();
  const today = istNow().date;
  if (!A || A.date !== today) throw new Error('Lighthouse data is not from today.');
  M.ensureBaseline(A, team(), true);
  const c = loadConfig();
  c.last.baseline = today;
  saveConfig(c);
}

async function runSlot(slot, manual = false) {
  if (running) throw new Error('A run is already in progress.');
  running = true;
  const entry = { at: new Date().toISOString(), slot, manual };
  try {
    try {
      await refresh();
    } catch (e) {
      const late = mins(istNow().time) - mins(DEFAULTS.slots[slot]);
      if (!manual && late < 25) {
        entry.retry = true;
        throw new Error(`Lighthouse could not be refreshed, will try again shortly: ${e.message}`);
      }
      // Still failing after 25 minutes: send with the last saved data, and say so in the log.
      entry.warning = `Lighthouse refresh failed, used saved data: ${e.message}`;
    }
    const A = loadLatest();
    // The starting list is normally fixed at 10 AM. If that run was missed, fix it now.
    if (slot === 'morning' && A && A.date === istNow().date) M.ensureBaseline(A, team(), !manual && loadConfig().last.baseline !== istNow().date);
    const cfg = loadConfig();
    const results = await sendSlot(slot, { includeIndividual: cfg.sendIndividual, includeTeam: cfg.sendTeam });
    entry.sent = results.filter((r) => r.ok).length;
    entry.failed = results.filter((r) => !r.ok).map((r) => `${r.who}: ${r.error}`);
    entry.ok = entry.failed.length === 0;
    return { results, entry };
  } catch (e) {
    entry.ok = false;
    entry.error = e.message;
    throw e;
  } finally {
    const c = loadConfig();
    if (!manual && entry.sent > 0) c.last[slot] = istNow().date;
    if (!entry.retry) c.log = [entry, ...(c.log || [])].slice(0, 60);
    saveConfig(c);
    running = false;
  }
}

// On Vercel the timing comes from scheduled jobs instead (see /api/cron).
// Mails go out from the hosted site. A copy running on a PC (no Google sign-in, an old App Password) must not send the
// slot mails too, or it fails and retries every minute (or double-sends); set LOCAL_SCHEDULER=1 to run them from a PC.
if (!CLOUD && process.env.LOCAL_SCHEDULER === '1') setInterval(() => {
  const c = loadConfig();
  const now = istNow();
  if (!c.enabled || running || now.day === 'Sun') return;
  const t = mins(now.time);
  if (c.last.baseline !== now.date && t >= mins(BASELINE_AT) && t < mins(BASELINE_AT) + 55) {
    running = true;
    takeBaseline()
      .catch((e) => console.log(`[schedule] 10 AM refresh failed: ${e.message}`))
      .finally(() => (running = false));
    return;
  }
  for (const s of SLOTS) {
    const at = mins(c.slots[s]);
    // Runs once a day, within 90 minutes of its time (a late start never sends stale mail).
    if (c.last[s] !== now.date && t >= at && t < at + 90) {
      runSlot(s).catch((e) => console.log(`[schedule] ${s} failed: ${e.message}`));
      return;
    }
  }
}, 30 * 1000);

// Keeps the dashboard fresh during the working day.
if (!CLOUD) setInterval(() => {
  const now = istNow();
  const t = mins(now.time);
  if (now.day !== 'Sun' && t >= 9 * 60 && t <= 21 * 60 && !running) refresh().catch(() => {});
}, 20 * 60 * 1000);

// ---------- Routes ----------

const app = express();
app.use(express.json({ limit: '6mb' }));

// ---------- Login gate and cloud storage ----------
// On the internet every data route needs a Google login; on your own PC it does not.
const GATED = CLOUD || Boolean(process.env.REQUIRE_LOGIN);
const ownerEmail = () => (process.env.OWNER_EMAIL || '').trim().toLowerCase();
const extraAllowed = () => (process.env.ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const accessOf = (email) => Access.roleOf(email, { owner: ownerEmail(), team: team(), extra: extraAllowed() });
const mayLogin = (email) => G.allowed(email) && accessOf(email).role !== null;
const isOwner = (req) => !GATED || Boolean(req.user && req.user === ownerEmail());
let lastPull = 0;
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/auth/')) return next();
  res.setHeader('Cache-Control', 'no-store');
  if (persist.enabled) {
    try {
      // Reads reuse a check made in the last 10 seconds; anything that changes data always checks.
      const t0 = Date.now();
      let checked = false;
      if (req.method !== 'GET' || req.path.startsWith('/api/cron/') || Date.now() - lastPull > 10000) {
        await persist.pull();
        lastPull = Date.now();
        checked = true;
      }
      // Timing for speed checks: where the server runs and how long the database check took.
      res.setHeader('Server-Timing', `db;dur=${checked ? Date.now() - t0 : 0};desc="${checked ? 'checked' : 'reused'}", fn;desc="${process.env.VERCEL_REGION || 'local'}"`);
      loadCloudEnv();
    } catch (e) {
      return res.status(503).json({ error: e.message });
    }
    // Save whatever this request changed before the reply goes out.
    const end = res.end;
    res.end = function (...a) {
      persist
        .push()
        .catch((e) => console.log(`[persist] ${e.message}`))
        .finally(() => end.apply(res, a));
      return res;
    };
  }
  const u = auth.user(req);
  req.user = u && mayLogin(u) ? u : null;
  const acc = req.user ? accessOf(req.user) : { role: null, tm: '' };
  req.role = GATED ? acc.role : 'owner';
  req.myTm = acc.tm || '';
  if (GATED && req.path.startsWith('/api/') && !req.path.startsWith('/api/cron/') && !req.user)
    return res.status(401).json({ error: 'Please sign in.', login: true, clientReady: G.clientReady(), domain: G.DOMAIN });
  next();
});
// Sending mail and changing settings is for the owner only.
app.use(['/api/send', '/api/config', '/api/ai-key', '/api/login', '/api/email-settings', '/api/google-client', '/api/google-signout', '/api/access', '/api/preview', '/api/subjects', '/api/ptm-reminders', '/api/drive-check', '/api/email-check'], (req, res, next) =>
  isOwner(req) ? next() : res.status(403).json({ error: `Only ${ownerEmail() || 'the owner'} can do this.` })
);
// A TM sees only their own students; other approved people see no student data.
app.use('/api/parents', (req, res, next) => {
  if (req.role === 'owner') return next();
  if (req.role === 'tm') {
    req.query = { ...req.query, tm: req.myTm };
    return next();
  }
  res.status(403).json({ error: 'Not allowed.' });
});
// Parent names for everyone allowed; numbers and e-mails for the owner only.
const noNumbers = (list) => (list || []).map(({ name, relation, primary }) => ({ name, relation, primary, phone: '' }));
app.use(['/api/students.csv'], (req, res, next) => {
  if (req.role === 'owner') return next();
  if (req.role === 'tm') {
    req.query = { ...req.query, tm: req.myTm };
    return next();
  }
  res.status(403).json({ error: 'Not allowed.' });
});
app.use('/api/ptm-report', (req, res, next) => (req.role === 'viewer' ? res.status(403).json({ error: 'Not allowed.' }) : next()));
app.use(express.static(path.join(ROOT, 'public')));

// Names of the people who sign in (from their Google profile), so the greeting can use the right one
const USER_NAMES = path.join(DATA, 'user-names.json');
const rememberName = (email, name) => {
  if (!email || !name) return;
  try {
    const m = JSON.parse(fs.readFileSync(USER_NAMES, 'utf8'));
    if (m[email] === name) return;
    m[email] = name;
    fs.writeFileSync(USER_NAMES, JSON.stringify(m));
  } catch {
    try {
      fs.mkdirSync(DATA, { recursive: true });
      fs.writeFileSync(USER_NAMES, JSON.stringify({ [email]: name }));
    } catch {}
  }
};
// A TM is greeted by their TM name; others by their Google name, else a name made from the mail address
const userName = (req) => {
  if (!req || !req.user) return '';
  if (req.role === 'tm' && req.myTm) return req.myTm;
  try {
    const n = JSON.parse(fs.readFileSync(USER_NAMES, 'utf8'))[req.user];
    if (n) return n;
  } catch {}
  const first = String(req.user).split('@')[0].split(/[._0-9-]+/)[0];
  return first ? first[0].toUpperCase() + first.slice(1) : '';
};
const status = (req) => {
  const A = loadLatest();
  const c = loadConfig();
  return {
    now: istNow(),
    gated: GATED,
    cloud: CLOUD,
    storage: !CLOUD || persist.enabled,
    user: req ? req.user : null,
    userName: userName(req),
    owner: req ? isOwner(req) : true,
    role: req ? req.role || 'owner' : 'owner',
    myTm: req ? req.myTm || '' : '',
    pendingAccess: req && isOwner(req) ? Access.list().pending.length : 0,
    lighthouse: Boolean(process.env.LIGHTHOUSE_AUTH || process.env.LIGHTHOUSE_COOKIE),
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    reportFolder: loadConfig().reportFolder,
    email: emailConfigured(),
    sender: senderAddr() || null,
    smtp: { host: smtpHost(), port: smtpPort(), user: process.env.SMTP_USER || '', fromEmail: process.env.FROM_EMAIL || '', ready: smtpConfigured() },
    google: { clientReady: G.clientReady(), email: G.account() ? G.account().email : null, domain: G.DOMAIN },
    fromName: sender().name,
    dataAt: A ? A.fetchedAt : null,
    dataDate: A ? A.date : null,
    refreshError: lastRefreshError,
    refreshing: Boolean(refreshing),
    running,
    config: { enabled: c.enabled, talkTargetMin: c.talkTargetMin, slots: c.slots, sendIndividual: c.sendIndividual, sendTeam: c.sendTeam, last: c.last },
    log: (c.log || []).slice(0, 20),
  };
};

app.get('/api/status', (req, res) => res.json(status(req)));

// ---------- Greetings: a few seconds each TM records in their own voice ----------
const VOICES = path.join(DATA, 'voices');
const VOICE_TYPES = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3' };
const slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
// kind '' is the short greeting; kind 'sample' is the longer recording a TM shares so the
// hub can read their numbers in their own voice. A sample is kept only with their consent.
const voiceFile = (name, kind = '') => {
  for (const ext of Object.values(VOICE_TYPES)) {
    const f = path.join(VOICES, `${slug(name)}${kind ? `.${kind}` : ''}.${ext}`);
    if (fs.existsSync(f)) return { f, ext };
  }
  return null;
};
// Only the TM can record their own greeting. On a PC copy without sign-in, anyone at that PC can.
const consentFile = (name) => path.join(VOICES, `${slug(name)}.consent.json`);
const kindOf = (req) => (req.query.kind === 'sample' ? 'sample' : '');
const isSelf = (req, m) => !GATED || (req.user && req.user === String(m.email || '').toLowerCase());

app.get('/api/voice', (req, res) => {
  const out = {};
  for (const m of team()) {
    const v = voiceFile(m.name);
    out[m.name] = { has: Boolean(v), v: v ? Math.round(fs.statSync(v.f).mtimeMs) : 0, mine: Boolean(isSelf(req, m) && GATED), canRecord: Boolean(isSelf(req, m)), canRemove: Boolean(isSelf(req, m) || isOwner(req)), sample: Boolean(voiceFile(m.name, 'sample')), consentAt: (readJson(consentFile(m.name), null) || {}).at || null };
  }
  res.json({ voices: out });
});
app.get('/api/voice/:name', (req, res) => {
  const kind = kindOf(req);
  const who = team().find((x) => x.name === req.params.name);
  // A voice sample is for the TM and the owner only.
  if (kind && !(who && (isSelf(req, who) || isOwner(req)))) return res.status(403).json({ error: 'Not allowed.' });
  const v = voiceFile(req.params.name, kind);
  if (!v) return res.status(404).json({ error: 'Nothing recorded.' });
  res.set('Cache-Control', 'private, max-age=0, must-revalidate');
  res.type(Object.keys(VOICE_TYPES).find((k) => VOICE_TYPES[k] === v.ext)).send(fs.readFileSync(v.f));
});
app.post('/api/voice/:name', (req, res) => {
  const m = team().find((x) => x.name === req.params.name);
  if (!m) return res.status(404).json({ error: 'Unknown TM.' });
  if (!isSelf(req, m)) return res.status(403).json({ error: `Only ${m.name} can record this greeting, signed in as ${m.email}.` });
  const ext = VOICE_TYPES[String((req.body || {}).type || '').split(';')[0]];
  if (!ext) return res.status(400).json({ error: 'This browser recorded a sound format the hub does not accept.' });
  const buf = Buffer.from(String(req.body.data || ''), 'base64');
  if (buf.length < 800) return res.status(400).json({ error: 'The recording is empty. Check the microphone and try again.' });
  const kind = kindOf(req);
  if (kind && req.body.consent !== true) return res.status(400).json({ error: 'Tick the agreement box first.' });
  if (buf.length > (kind ? 1500 : 400) * 1024) return res.status(400).json({ error: 'The recording is too long.' });
  fs.mkdirSync(VOICES, { recursive: true });
  let old;
  while ((old = voiceFile(m.name, kind))) fs.rmSync(old.f, { force: true });
  fs.writeFileSync(path.join(VOICES, `${slug(m.name)}${kind ? `.${kind}` : ''}.${ext}`), buf);
  // Keep a record of who agreed, when, and to what.
  if (kind) writeJson(consentFile(m.name), { by: req.user || 'this PC (no sign-in)', at: new Date().toISOString(), agreed: 'My recorded sample may be used to create a copy of my voice that reads out my own task numbers inside the TM Hub. I can withdraw at any time, which deletes the sample.' });
  res.json({ ok: true });
});
app.delete('/api/voice/:name', (req, res) => {
  const m = team().find((x) => x.name === req.params.name);
  if (!m) return res.status(404).json({ error: 'Unknown TM.' });
  if (!isSelf(req, m) && !isOwner(req)) return res.status(403).json({ error: 'Only the TM or the owner can remove this.' });
  const kind = kindOf(req);
  let old;
  while ((old = voiceFile(m.name, kind))) fs.rmSync(old.f, { force: true });
  if (kind) fs.rmSync(consentFile(m.name), { force: true });
  res.json({ ok: true });
});

app.get('/api/board', async (req, res) => {
  if (CLOUD) {
    // No background timer on Vercel: load today's data the first time someone opens the hub.
    const A = loadLatest();
    if ((!A || A.date !== istNow().date) && (process.env.LIGHTHOUSE_AUTH || process.env.LIGHTHOUSE_COOKIE)) await refresh().catch(() => {});
  }
  const b = board(req.query.slot);
  res.json({ status: status(req), tasks: M.TASKS, score: M.SCORE, board: Access.scrubBoard(b, req.role || 'owner', req.myTm) });
});

// PTMs: today's schedule and each TM's meetings this month (and the last 30 days).
const ptmCache = { at: 0, key: '', data: null };
const ptmRanges = new Map();
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
app.get('/api/ptm', async (req, res) => {
  const today = istDate();
  const back = addDays(today, -29);
  const monthStart = `${today.slice(0, 8)}01`;
  // Default: this month or the last 30 days (whichever is longer), plus two weeks ahead.
  let from = monthStart < back ? monthStart : back;
  let to = addDays(today, 14);
  const custom = isDay(req.query.from) || isDay(req.query.to);
  if (isDay(req.query.from)) from = req.query.from;
  if (isDay(req.query.to)) to = req.query.to;
  if (to < from) [from, to] = [to, from];
  if (from < addDays(today, -179)) from = addDays(today, -179);
  if (to > addDays(today, 30)) to = addDays(today, 30);
  const key = `${from}|${to}`;
  const hit = custom ? ptmRanges.get(key) : ptmCache.key === key ? ptmCache : null;
  let data;
  try {
    if (hit && !req.query.fresh && Date.now() - hit.at < 3 * 60 * 1000) data = hit;
    else {
      data = { at: Date.now(), key, data: await ptmMeetings(from, to) };
      if (custom) {
        ptmRanges.set(key, data);
        if (ptmRanges.size > 12) ptmRanges.delete(ptmRanges.keys().next().value);
      } else Object.assign(ptmCache, data);
    }
  } catch (e) {
    return res.status(502).json({ error: `Could not load PTMs from Lighthouse: ${e.message}` });
  }
  if (req.role === 'viewer') return res.status(403).json({ error: 'Not allowed.' });
  const remarks = Remarks.load();
  const repIdx = repIndex();
  const tms = team().map((m) => ({ name: m.name, lh: m.lighthouseName || m.name, old: m.oldName || '' }));
  const tmOf = (host) => {
    const t = tms.find((x) => [x.name, x.lh, x.old].some((n) => n && n.toLowerCase() === String(host).toLowerCase()));
    return t ? t.name : host;
  };
  res.json({
    today,
    from,
    to,
    monthStart,
    fetchedAt: new Date(data.at).toISOString(),
    team: tms.map((t) => t.name).filter((n) => req.role !== 'tm' || n === req.myTm),
    meetings: data.data.map((m) => ({ ...m, tm: tmOf(m.host), remark: remarks[m.id] || null, reports: (repIdx[String(m.studentId)] || []).map((r) => ({ id: r.id, month: r.month, at: r.at })) })).filter((m) => req.role !== 'tm' || m.tm === req.myTm),
  });
});
// A TM writes remarks on their own PTMs after the meeting; the owner can write on any.
app.post('/api/ptm-remark', (req, res) => {
  if (req.role !== 'owner' && req.role !== 'tm') return res.status(403).json({ error: 'Not allowed.' });
  const id = String((req.body && req.body.id) || '');
  const text = String((req.body && req.body.text) || '');
  if (!id) return res.status(400).json({ error: 'Missing meeting.' });
  const pools = [ptmCache, ...ptmRanges.values()];
  let m = null;
  for (const p of pools) if (!m && p && Array.isArray(p.data)) m = p.data.find((x) => String(x.id) === id);
  if (!m) return res.status(404).json({ error: 'Meeting not found. Reload the page and try again.' });
  const tms = team().map((x) => ({ name: x.name, lh: x.lighthouseName || x.name, old: x.oldName || '' }));
  const hit = tms.find((x) => [x.name, x.lh, x.old].some((n) => n && n.toLowerCase() === String(m.host).toLowerCase()));
  const tmName = hit ? hit.name : m.host;
  if (req.role === 'tm' && tmName !== req.myTm) return res.status(403).json({ error: 'You can only write remarks on your own PTMs.' });
  const who = (req.user && (req.user.name || req.user.email)) || tmName;
  res.json({ remark: Remarks.set(id, text, who, { student: m.student, tm: tmName }) });
});

// One student, for the PTM detail panel: hub profile, open tasks and all their PTMs.
app.get('/api/ptm/student/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Unknown student.' });
  const A = loadLatest() || {};
  let student = null;
  let tmLh = '';
  for (const [lh, list] of Object.entries(A.students || {})) {
    const s = (list || []).find((x) => Number(x.id) === id);
    if (s) {
      student = s;
      tmLh = lh;
      break;
    }
  }
  const tmName = (team().find((m) => (m.lighthouseName || m.name) === tmLh) || {}).name || tmLh;
  if (req.role !== 'owner' && !(req.role === 'tm' && student && tmName === req.myTm)) return res.status(403).json({ error: 'You can only open your own students.' });
  // Open tasks on this student today, from the same board the mails use.
  const tasks = [];
  const b = board();
  const link = M.stuLink(id);
  for (const r of (b && b.rows) || [])
    for (const t of M.TASKS) {
      const s = r.tasks[t.key];
      for (const it of (s && s.items) || []) if (it.link === link) tasks.push({ task: t.label, icon: t.icon, cols: t.cols, cells: it.cells, flag: Boolean(it.flag), link: it.taskLink || it.link, tm: r.name });
    }
  let ptms = [];
  let error = '';
  try {
    ptms = await studentPtms(id);
  } catch (e) {
    error = e.message;
  }
  // Parent time is only in the team history; add it where we have it.
  const seen = new Map([...ptmRanges.values(), ptmCache].flatMap((r) => (r && r.data) || []).map((m) => [m.id, m]));
  ptms = ptms
    .map((m) => {
      const h = seen.get(m.id);
      return { ...m, parentMinutes: h ? h.parentMinutes : null, parentJoined: h ? h.parentJoined : null, with: h ? h.with : [], recording: h ? h.recording : false };
    })
    .sort((a, b) => String(b.start).localeCompare(String(a.start)));
  let parents = [];
  try {
    parents = (await Parents.ensure([id]))[id] || [];
    if (req.role !== 'owner') parents = noNumbers(parents);
  } catch (e) {
    error = error || e.message;
  }
  res.json({ id, tm: tmName, student, tasks, ptms, parents, error, crm: link });
});

// ---------- Create PTM report (4 steps, run one after another by the browser) ----------
const PR = require('./lib/ptmReport');
const reportStep = (fn) => async (req, res) => {
  try {
    res.json(await fn(req.body || {}));
  } catch (e) {
    console.log('[ptm-report]', e.message);
    res.status(500).json({ error: e.message });
  }
};
app.post('/api/ptm-report/gather', reportStep((b) => PR.gather(b.studentId, loadLatest(), b.window)));
app.post('/api/ptm-report/read', reportStep((b) => PR.read(b.item, b.kind, b.tag)));
app.post('/api/ptm-report/write', reportStep((b) => PR.write(b.ctx, b.monthlyText, b.candidates || [], b.month, b.chapters || [])));
const REPORTS = path.join(DATA, 'reports');
const repIndex = () => readJson(path.join(REPORTS, 'index.json'), {});
const studentAllowed = (req, studentId) => {
  if (req.role === 'owner') return true;
  if (req.role !== 'tm') return false;
  const A = loadLatest() || {};
  const m = team().find((x) => x.name === req.myTm);
  return Boolean(m && ((A.students && A.students[M.lhName(m)]) || []).some((s) => Number(s.id) === Number(studentId)));
};
app.post('/api/ptm-report/publish', async (req, res) => {
  try {
    const b = req.body || {};
    const out = await PR.publish(b.ctx, b.plan, b.photos || {}, b.month, b.drive === false ? null : b.folder || loadConfig().reportFolder);
    // keep a copy in the platform, newest first, five per student
    const sid = String((b.ctx && b.ctx.student && b.ctx.student.id) || '');
    if (sid && out.pdf) {
      fs.mkdirSync(REPORTS, { recursive: true });
      const idx = repIndex();
      const id = `${sid}-${Date.now()}`;
      fs.writeFileSync(path.join(REPORTS, id + '.pdf'), Buffer.from(out.pdf, 'base64'));
      const list = [{ id, name: out.name, month: b.month, window: (b.ctx && b.ctx.window) || '30', at: new Date().toISOString(), by: req.user || 'this PC', bytes: out.bytes }, ...(idx[sid] || [])];
      for (const old of list.slice(5)) await persist.forget('reports/' + old.id + '.pdf').catch(() => {});
      idx[sid] = list.slice(0, 5);
      writeJson(path.join(REPORTS, 'index.json'), idx);
      out.saved = { id, url: '/api/reports/file/' + id };
    }
    res.json(out);
  } catch (e) {
    console.log('[ptm-report]', e.message);
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/reports/file/:id', async (req, res) => {
  const id = String(req.params.id).replace(/[^0-9-]/g, '');
  const sid = id.split('-')[0];
  const rec = (repIndex()[sid] || []).find((r) => r.id === id);
  if (!rec || !studentAllowed(req, sid)) return res.status(404).json({ error: 'Report not found.' });
  const f = path.join(REPORTS, id + '.pdf');
  try {
    await persist.ensure('reports/' + id + '.pdf'); // report PDFs are downloaded only when opened
  } catch (e) {
    return res.status(503).json({ error: e.message });
  }
  if (!fs.existsSync(f)) return res.status(404).json({ error: 'Report not found.' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.dl ? 'attachment' : 'inline'}; filename="${rec.name.replace(/[^\w .-]/g, '')}"`);
  res.send(fs.readFileSync(f));
});

// Renewals: the Vantage "Renewal Discussion" list (snapshot). A TM sees only their own students.
const RENEWALS_SEED = path.join(ROOT, 'seed', 'renewal-list.json');
const RENEWALS_FILE = path.join(DATA, 'renewal-list.json');
function loadRenewals() {
  for (const p of [RENEWALS_FILE, RENEWALS_SEED]) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {}
  }
  return null;
}
// PTMs of the last 20 days, one summary per student: done / parent no-show / not marked / scheduled / none.
async function renewalPtms() {
  const today = istDate();
  const from = addDays(today, -19);
  const key = `ren|${from}|${today}`;
  let hit = ptmRanges.get(key);
  const loadIt = async () => {
    const h = { at: Date.now(), key, data: await ptmMeetings(from, today) };
    ptmRanges.set(key, h);
    if (ptmRanges.size > 12) ptmRanges.delete(ptmRanges.keys().next().value);
    return h;
  };
  if (!hit) hit = await loadIt();
  else if (Date.now() - hit.at > 3 * 60 * 1000 && !hit.busy) {
    hit.busy = true; // the saved list is used at once; a fresh one is ready for the next view
    loadIt().catch(() => (hit.busy = false));
  }
  const remarks = Remarks.load();
  const stateOf = (m) => {
    if (m.status !== 'scheduled') return m.status;
    const now = Date.now();
    return new Date(m.start) > now ? 'upcoming' : new Date(m.end) > now ? 'live' : 'unmarked';
  };
  const rank = ['completed', 'no_show', 'unmarked', 'live', 'upcoming', 'cancelled'];
  const by = new Map();
  for (const m of hit.data) {
    const l = by.get(String(m.studentId)) || [];
    l.push(m);
    by.set(String(m.studentId), l);
  }
  const out = new Map();
  for (const [sid, list] of by) {
    const ordered = list.slice().sort((a, b) => rank.indexOf(stateOf(a)) - rank.indexOf(stateOf(b)) || String(b.start).localeCompare(String(a.start)));
    const rep = ordered[0];
    const withRemark = list.find((m) => remarks[m.id]);
    out.set(sid, {
      id: rep.id,
      state: stateOf(rep),
      status: rep.status,
      start: rep.start,
      end: rep.end,
      date: rep.date,
      count: list.length,
      minutes: list.filter((m) => m.status === 'completed').reduce((s, m) => s + (m.parentMinutes || 0), 0),
      remark: remarks[rep.id] || (withRemark ? remarks[withRemark.id] : null) || null,
    });
  }
  return { map: out, from, to: today };
}
app.get('/api/renewals', async (req, res) => {
  if (req.role !== 'owner' && req.role !== 'tm') return res.status(403).json({ error: 'Not allowed.' });
  const d = loadRenewals();
  if (!d) return res.status(404).json({ error: 'No renewal data loaded yet.' });
  let ptm = null;
  let ptmError = '';
  try {
    ptm = await renewalPtms();
  } catch (e) {
    ptmError = e.message;
  }
  const tms = team();
  const tmOf = (n) => {
    const x = tms.find((m) => [m.name, m.lighthouseName, m.oldName].some((v) => v && v.toLowerCase() === String(n).toLowerCase()));
    return x ? x.name : n;
  };
  // last connected parent call with its length; older ones fall back to Lighthouse's "last contact" time (no length)
  const calls = LastCalls.instant();
  const contact = {};
  const A = loadLatest();
  for (const list of Object.values((A && A.students) || {})) for (const x of list || []) if (x.lastContact) contact[String(x.id)] = x.lastContact;
  const callOf = (id) => {
    const c = calls && calls[id];
    if (c) return { at: c.at, seconds: c.seconds, incoming: c.incoming, src: 'call' };
    return contact[String(id)] ? { at: contact[String(id)], seconds: null, incoming: null, src: 'contact' } : null;
  };
  let rows = d.rows.map((r) => ({ ...r, tm: tmOf(r.tm), lastCall: callOf(r.id), ptm: ptm ? (ptm.map.get(String(r.id)) || null) : undefined }));
  if (req.role === 'tm') rows = rows.filter((r) => r.tm === req.myTm);
  res.json({ at: d.at, source: d.source, due: (rows[0] || {}).due || '', team: [...new Set(rows.map((r) => r.tm))].sort(), ptmFrom: ptm && ptm.from, ptmTo: ptm && ptm.to, ptmError, rows });
});
// The daily 11 AM refresh: a signed-in browser reads Vantage and pushes the rows here with a private key
// (Vantage only opens for a signed-in person, so the server cannot fetch it itself).
const RENEWAL_KEY_FILE = path.join(DATA, 'renewal-key.json');
const keyHash = (k) => crypto.createHash('sha256').update(String(k)).digest('hex');
app.post('/api/renewals/key', (req, res) => {
  if (req.role !== 'owner') return res.status(403).json({ error: 'Only the owner can make the refresh key.' });
  const key = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(RENEWAL_KEY_FILE, JSON.stringify({ hash: keyHash(key), at: new Date().toISOString() }));
  res.json({ key });
});
// Under /api/cron so it needs no login; the key is the login.
app.post('/api/cron/renewals-push', express.text({ type: '*/*', limit: '8mb' }), (req, res) => {
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(RENEWAL_KEY_FILE, 'utf8'));
  } catch {
    return res.status(403).json({ error: 'No refresh key has been made yet.' });
  }
  let b;
  try {
    b = JSON.parse(typeof req.body === 'string' ? req.body : '{}');
  } catch {
    return res.status(400).json({ error: 'Send JSON.' });
  }
  if (!b.key || keyHash(b.key) !== saved.hash) return res.status(403).json({ error: 'Wrong key.' });
  const rows = Array.isArray(b.rows) ? b.rows : [];
  if (!rows.length || !rows.every((r) => r && r.id && r.name)) return res.status(400).json({ error: 'No usable rows.' });
  const prev = loadRenewals();
  const before = prev && prev.rows ? prev.rows.length : 0;
  if (before && rows.length < before * 0.7) return res.status(409).json({ error: `Only ${rows.length} rows against ${before} before. Kept the old list.` });
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(RENEWALS_FILE, JSON.stringify({ at: new Date().toISOString(), source: b.source || 'Vantage · Renewal Discussion', rows }));
  res.json({ ok: true, count: rows.length });
});
// Everything the owner would want to look up if the hub is down, for the daily copy on the owner's laptop
// (tools/backup/backup.js). Same private key as the Vantage push; POST only, so the key is never in an address.
app.post('/api/cron/backup', express.text({ type: '*/*', limit: '10kb' }), async (req, res) => {
  let saved, b;
  try {
    saved = JSON.parse(fs.readFileSync(RENEWAL_KEY_FILE, 'utf8'));
    b = JSON.parse(typeof req.body === 'string' ? req.body : '{}');
  } catch {
    return res.status(403).json({ error: 'No key.' });
  }
  if (!b.key || keyHash(b.key) !== saved.hash) return res.status(403).json({ error: 'Wrong key.' });
  const errors = [];
  const safe = async (name, fn, fallback) => {
    try {
      return await Promise.race([fn(), new Promise((_, no) => setTimeout(() => no(new Error('took too long')), 25000))]);
    } catch (e) {
      errors.push(name + ': ' + e.message);
      return fallback;
    }
  };
  let A = loadLatest();
  if ((!A || A.date !== istNow().date) && (process.env.LIGHTHOUSE_AUTH || process.env.LIGHTHOUSE_COOKIE)) {
    await safe('refresh', () => refresh(), null);
    A = loadLatest();
  }
  const students = [];
  for (const m of team()) for (const x of (A && A.students && A.students[M.lhName(m)]) || []) students.push({ ...x, tm: m.name });
  const today = istDate();
  const [parents, leaves, meetings] = await Promise.all([
    safe('parents', () => Parents.ensure(students.map((x) => x.id)), {}),
    safe('leaves', () => TutorLeaves.load(true), { leaves: [] }),
    safe('ptms', () => ptmMeetings(addDays(today, -30), addDays(today, 14)), []),
  ]);
  const recovery = await safe('old remarks', () => restoreRemarks(), { state: 'not checked' });
  const remarks = Remarks.load();
  const board_ = await safe('tasks', async () => board('progress'), null);
  res.json({
    at: new Date().toISOString(),
    date: today,
    dataAt: A ? A.fetchedAt : null,
    errors,
    recovery,
    students,
    parents,
    renewals: loadRenewals(),
    tutors: loadTutors(),
    leaves: leaves.leaves,
    ptms: meetings.map((m) => ({ ...m, remark: remarks[m.id] || null })),
    remarks,
    tasks: M.TASKS,
    board: board_,
    access: Access.list(),
  });
});

// Owner: load a newer export of the same list (rows in the same shape).
app.post('/api/renewals/import', (req, res) => {
  if (req.role !== 'owner') return res.status(403).json({ error: 'Only the owner can load renewal data.' });
  const b = req.body || {};
  if (!Array.isArray(b.rows) || !b.rows.length || !b.rows.every((r) => r && r.id && r.name)) return res.status(400).json({ error: 'Send {rows:[{id,name,...}]}.' });
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(RENEWALS_FILE, JSON.stringify({ at: new Date().toISOString(), source: b.source || 'Uploaded', rows: b.rows }));
  res.json({ ok: true, count: b.rows.length });
});

// Tutor Management: the Vantage "Tutor Master Dashboard" list. Owner and TMs can read it (no student data in it); only the owner loads it.
const TUTORS_SEED = path.join(ROOT, 'seed', 'tutors.json');
const TUTORS_FILE = path.join(DATA, 'tutors.json');
function loadTutors() {
  for (const p of [TUTORS_FILE, TUTORS_SEED]) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {}
  }
  return null;
}
const goodTutors = (rows) => Array.isArray(rows) && rows.length > 0 && rows.every((r) => r && r.id && r.name);
app.get('/api/tutors', (req, res) => {
  if (!['owner', 'tm', 'viewer'].includes(req.role)) return res.status(403).json({ error: 'Not allowed.' });
  const d = loadTutors();
  if (!d) return res.status(404).json({ error: 'No tutor data loaded yet.' });
  res.json(d);
});
// Tutor leaves: live from Lighthouse (leaves that have not ended yet, newest start first)
app.get('/api/tutor-leaves', async (req, res) => {
  if (!['owner', 'tm', 'viewer'].includes(req.role)) return res.status(403).json({ error: 'Not allowed.' });
  try {
    res.json(await TutorLeaves.load(!!req.query.fresh));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
app.post('/api/tutors/import', (req, res) => {
  if (req.role !== 'owner') return res.status(403).json({ error: 'Only the owner can load tutor data.' });
  const b = req.body || {};
  if (!goodTutors(b.rows)) return res.status(400).json({ error: 'Send {rows:[{id,name,...}]}.' });
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(TUTORS_FILE, JSON.stringify({ at: new Date().toISOString(), source: b.source || 'Uploaded', rows: b.rows }));
  res.json({ ok: true, count: b.rows.length });
});
// Twice a week a signed-in browser reads the Vantage dashboard and pushes it here with the same private key as the renewals.
app.post('/api/cron/tutors-push', express.text({ type: '*/*', limit: '8mb' }), (req, res) => {
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(RENEWAL_KEY_FILE, 'utf8'));
  } catch {
    return res.status(403).json({ error: 'No refresh key has been made yet.' });
  }
  let b;
  try {
    b = JSON.parse(typeof req.body === 'string' ? req.body : '{}');
  } catch {
    return res.status(400).json({ error: 'Send JSON.' });
  }
  if (!b.key || keyHash(b.key) !== saved.hash) return res.status(403).json({ error: 'Wrong key.' });
  if (!goodTutors(b.rows)) return res.status(400).json({ error: 'No usable rows.' });
  const prev = loadTutors();
  const before = prev && prev.rows ? prev.rows.length : 0;
  if (before && b.rows.length < before * 0.7) return res.status(409).json({ error: `Only ${b.rows.length} rows against ${before} before. Kept the old list.` });
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(TUTORS_FILE, JSON.stringify({ at: new Date().toISOString(), source: b.source || 'Vantage · Tutor Master Dashboard', rows: b.rows }));
  res.json({ ok: true, count: b.rows.length });
});

// Last connected parent calls, read live (the pages draw first and fill this in a moment later)
app.get('/api/last-calls', async (req, res) => {
  if (req.role !== 'owner' && req.role !== 'tm') return res.status(403).json({ error: 'Not allowed.' });
  try {
    const all = await LastCalls.lastCalls(21);
    let out = all;
    if (req.role === 'tm') {
      const A = loadLatest();
      const mine = new Set();
      for (const m of team()) if (m.name === req.myTm) for (const x of (A && A.students && A.students[M.lhName(m)]) || []) mine.add(String(x.id));
      out = {};
      for (const k of Object.keys(all)) if (mine.has(k)) out[k] = all[k];
    }
    const map = {};
    for (const k of Object.keys(out)) map[k] = { at: out[k].at, seconds: out[k].seconds, incoming: out[k].incoming };
    res.json({ map });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
// All students the person may see, with this month's PTMs (done, last 30 days) and their report history.
let ptm30 = { at: 0, data: null };
app.get('/api/students-all', async (req, res) => {
  if (req.role !== 'owner' && req.role !== 'tm') return res.status(403).json({ error: 'Not allowed.' });
  const A = loadLatest();
  if (!A) return res.status(404).json({ error: 'No data yet. Click Refresh.' });
  const today = istDate();
  let err = '';
  try {
    const load30 = async () => (ptm30 = { at: Date.now(), data: await ptmMeetings(addDays(today, -29), today) });
    if (!ptm30.data) await load30();
    else if (Date.now() - ptm30.at > 3 * 60 * 1000 && !ptm30.busy) {
      ptm30.busy = true;
      load30().catch(() => (ptm30.busy = false)); // stale list is shown at once, the fresh one is ready for the next view
    }
  } catch (e) {
    err = e.message;
  }
  const tms = team();
  const tmOf = (host) => {
    const t = tms.find((x) => [x.name, x.lighthouseName, x.oldName].some((n) => n && n.toLowerCase() === String(host).toLowerCase()));
    return t ? t.name : host;
  };
  const byStudent = new Map();
  for (const m of (ptm30.data || []).filter((x) => x.status === 'completed')) {
    const l = byStudent.get(Number(m.studentId)) || [];
    l.push({ date: m.date, minutes: m.parentMinutes, tm: tmOf(m.host) });
    byStudent.set(Number(m.studentId), l);
  }
  // last connected parent call with its length (older ones fall back to Lighthouse's "last contact" time, no length)
  const calls = LastCalls.instant();
  const callOf = (s) => {
    const c = calls && calls[s.id];
    if (c) return { at: c.at, seconds: c.seconds, incoming: c.incoming };
    return s.lastContact ? { at: s.lastContact, seconds: null, incoming: null } : null;
  };
  const idx = repIndex();
  const rows = [];
  for (const m of tms) {
    if (req.role === 'tm' && m.name !== req.myTm) continue;
    for (const s of (A.students && A.students[M.lhName(m)]) || []) {
      const a = s.att || {};
      rows.push({
        id: s.id, name: s.name, grade: s.grade, school: s.school, batch: s.batch, level: s.level, oneOnOne: s.oneOnOne, lapsed: s.lapsed,
        joinedAt: s.joinedAt, renewal: s.renewal, greenPct: s.greenPct, processPct: s.processPct, improvementPct: s.improvementPct,
        lastContact: s.lastContact, lastCall: callOf(s), attPct: a.regHeld ? Math.round((100 * a.regAttended) / a.regHeld) : null, streak: a.streak || 0,
        tm: m.name,
        ptms: (byStudent.get(Number(s.id)) || []).sort((x, y) => String(y.date).localeCompare(String(x.date))),
        reports: (idx[String(s.id)] || []).map((r) => ({ id: r.id, month: r.month, at: r.at, window: r.window })),
      });
    }
  }
  res.json({ rows, from: addDays(today, -29), to: today, error: err, role: req.role });
});

// A student's saved reports (history).
app.get('/api/reports/student/:id', (req, res) => {
  if (!studentAllowed(req, req.params.id)) return res.status(403).json({ error: 'Not allowed.' });
  res.json({ reports: (repIndex()[String(req.params.id)] || []).map((r) => ({ id: r.id, name: r.name, month: r.month, at: r.at, window: r.window, by: r.by })) });
});
// Read-only check that Google Drive is reachable and the reports folder can be opened.
app.get('/api/drive-check', async (req, res) => {
  try {
    const at = await G.accessToken();
    const id = loadConfig().reportFolder;
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=name,capabilities(canAddChildren)&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${at}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: (j.error && j.error.message) || `HTTP ${r.status}` });
    res.json({ ok: true, folder: j.name, canAdd: Boolean(j.capabilities && j.capabilities.canAddChildren) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// The Claude API key for report writing (pasted by the owner in Settings), and the Drive folder.
app.post('/api/ai-key', (req, res) => {
  const key = String((req.body || {}).key || '').trim();
  const folder = String((req.body || {}).folder || '').trim();
  if (key) {
    if (!/^sk-ant-/.test(key)) return res.status(400).json({ error: 'That does not look like an Anthropic API key (it starts with sk-ant-).' });
    saveEnv('ANTHROPIC_API_KEY', key);
  }
  if (folder) {
    const id = (folder.match(/folders\/([\w-]{10,})/) || [])[1] || (/^[\w-]{10,}$/.test(folder) ? folder : '');
    if (!id) return res.status(400).json({ error: 'Paste the Google Drive folder link.' });
    saveConfig({ ...loadConfig(), reportFolder: id });
  }
  res.json({ ok: true, ai: Boolean(process.env.ANTHROPIC_API_KEY), reportFolder: loadConfig().reportFolder });
});

app.get('/api/tm/:name', (req, res) => {
  if (req.role !== 'owner' && !(req.role === 'tm' && req.params.name === req.myTm)) return res.status(403).json({ error: 'You can only open your own profile.' });
  const b = board(req.query.slot);
  if (!b) return res.status(404).json({ error: 'No data yet. Click Refresh.' });
  const row = b.rows.find((r) => r.name === req.params.name);
  if (!row) return res.status(404).json({ error: 'Unknown TM' });
  const A = loadLatest();
  const hist = M.loadHistory();
  // Days saved before a name correction are under the old spelling.
  const old = (team().find((m) => m.name === row.name) || {}).oldName;
  const history = Object.keys(hist)
    .sort()
    .map((d) => ({ date: d, ...(hist[d][row.name] || hist[d][old] || {}) }))
    .filter((h) => h.score !== undefined);
  res.json({ tasks: M.TASKS, row, slot: b.slot, monthStart: A.monthStart || null, dataDate: A.date, students: (A.students && A.students[row.lighthouseName]) || [], history, team: b.rows.map((r) => ({ name: req.role === 'owner' || r.name === req.myTm ? r.name : 'Team member', score: r.perf.score })) });
});

// Voice pack: short clips of the owner's own voice (names, numbers, phrases) that the hover read-out stitches together.
const PACK = path.join(DATA, 'voicepack');
const PACK_SEED = path.join(ROOT, 'voicepack-seed'); // clips shipped with the app (the owner's cloned voice); recordings in PACK win
const packKey = (k) => (/^[a-z0-9-]{1,40}$/.test(String(k)) ? String(k) : null);
app.get('/api/voicepack', (req, res) => {
  const out = {};
  try {
    for (const dir of [PACK_SEED, PACK]) for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) if (f.endsWith('.wav')) out[f.slice(0, -4)] = Math.round(fs.statSync(path.join(dir, f)).mtimeMs);
  } catch {}
  res.json({ keys: out, owner: isOwner(req) });
});
app.get('/api/voicepack/:key', (req, res) => {
  const k = packKey(req.params.key);
  const f = k && [path.join(PACK, k + '.wav'), path.join(PACK_SEED, k + '.wav')].find((x) => fs.existsSync(x));
  if (!f) return res.status(404).end();
  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(fs.readFileSync(f));
});
app.post('/api/voicepack/:key', express.raw({ type: '*/*', limit: '3mb' }), (req, res) => {
  if (!isOwner(req)) return res.status(403).json({ error: 'Only the owner can record the voice pack.' });
  const k = packKey(req.params.key);
  if (!k || !Buffer.isBuffer(req.body) || req.body.length < 200 || req.body.slice(0, 4).toString() !== 'RIFF') return res.status(400).json({ error: 'That is not a valid recording.' });
  fs.mkdirSync(PACK, { recursive: true });
  fs.writeFileSync(path.join(PACK, k + '.wav'), req.body);
  res.json({ ok: true });
});
app.delete('/api/voicepack', (req, res) => {
  if (!isOwner(req)) return res.status(403).json({ error: 'Only the owner can do this.' });
  try {
    for (const f of fs.readdirSync(PACK)) fs.unlinkSync(path.join(PACK, f));
  } catch {}
  res.json({ ok: true });
});

// Parent / guardian names and numbers for one TM's students (?tm=Name).
app.get('/api/parents', async (req, res) => {
  try {
    const A = loadLatest() || {};
    const m = team().find((x) => x.name === req.query.tm);
    if (!m) return res.status(400).json({ error: 'Unknown TM.' });
    const ids = ((A.students && A.students[M.lhName(m)]) || []).map((s) => s.id);
    const p = await Parents.ensure(ids);
    res.json({ parents: req.role === 'owner' ? p : Object.fromEntries(Object.entries(p).map(([k, v]) => [k, noNumbers(v)])) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Student data as CSV: one TM (?tm=Name) or the whole team.
app.get('/api/students.csv', async (req, res) => {
  const A = loadLatest();
  if (!A) return res.status(404).send('No data yet. Click Refresh.');
  const q = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const day = (d) => (d ? istDate(new Date(d)) : '');
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : '');
  const showParents = req.role === 'owner';
  const isTm = req.role === 'tm';
  const head = ['TM', 'Student ID', 'Student', ...(showParents ? ['Parent 1 name', 'Parent 1 relation', 'Parent 1 phone', 'Parent 2 name', 'Parent 2 relation', 'Parent 2 phone'] : ['Parent 1 name', 'Parent 1 relation', 'Parent 2 name', 'Parent 2 relation']), 'Class', 'School', 'Batch', '1:1', 'Subscription lapsed', 'Joined', 'Regular classes held (month)', 'Regular classes attended (month)', 'Regular attendance %', 'All classes held (month)', 'All classes attended (month)', 'Absent streak (class days)', 'Last attended', 'On holiday today', 'Green %', 'Improvement %', 'IC2 load', 'Last parent contact', 'Parent contacts (30d)', 'Next renewal date'];
  const lines = [head.map(q).join(',')];
  const wanted = team().filter((m) => !req.query.tm || req.query.tm === m.name);
  let P = {};
  try {
    P = await Parents.ensure(wanted.flatMap((m) => ((A.students && A.students[M.lhName(m)]) || []).map((s) => s.id)));
  } catch (e) {
    console.log('[parents]', e.message);
  }
  const par = (s, i) => {
    const g = (P[s.id] || [])[i] || {};
    return showParents ? [g.name || '', g.relation || '', g.phone || ''] : [g.name || '', g.relation || ''];
  };
  for (const m of team()) {
    if (req.query.tm && req.query.tm !== m.name) continue;
    for (const s of (A.students && A.students[M.lhName(m)]) || []) {
      const a = s.att || {};
      lines.push(
        [m.name, s.id, s.name, ...par(s, 0), ...par(s, 1), s.grade, s.school, s.batch, s.oneOnOne ? 'Yes' : 'No', s.lapsed ? 'Yes' : 'No', day(s.joinedAt), a.regHeld ?? '', a.regAttended ?? '', a.regHeld ? pct(a.regAttended, a.regHeld) : '', a.allHeld ?? '', a.allAttended ?? '', a.streak ?? '', day(a.lastAttended), a.onHoliday ? 'Yes' : 'No', s.greenPct ?? '', s.improvementPct ?? '', s.liftLoad ?? '', day(s.lastContact), s.contacts30 ?? '', day(s.renewal)]
          .map(q)
          .join(',')
      );
    }
  }
  const name = `students-${(req.query.tm || 'all-TMs').replace(/[^a-z0-9]+/gi, '-')}-${A.date}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send('﻿' + lines.join('\r\n'));
});

app.post('/api/refresh', async (req, res) => {
  try {
    TutorLeaves.bust();
    LastCalls.bust();
    ptmRanges.clear();
    Object.assign(ptmCache, { at: 0, key: '', data: null });
    ptm30.at = 0; // keep the old list on screen-time, a fresh one loads in the background
    const A = await refresh();
    res.json({ ok: true, errors: A.errors, at: A.fetchedAt });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/preview', (req, res) => {
  const slot = SLOTS.includes(req.query.slot) ? req.query.slot : 'morning';
  const b = board(slot);
  if (!b) return res.status(404).send('No data yet. Click Refresh.');
  if (req.query.who === 'team') return res.type('html').send(teamEmail(b, slot, sender()).html);
  const row = b.rows.find((r) => r.name === req.query.who) || b.rows[0];
  const m = tmEmail(row, b, slot, sender());
  res.type('html').send(m.html);
});

app.get('/api/subjects', (req, res) => {
  const slot = SLOTS.includes(req.query.slot) ? req.query.slot : 'morning';
  const b = board(slot);
  if (!b) return res.json({ items: [] });
  res.json({
    items: [
      ...b.rows.map((r) => ({ who: r.name, to: r.email, subject: tmEmail(r, b, slot, sender()).subject })),
      { who: 'team', to: `${senderAddr() || 'you'} · CC all TMs`, subject: teamEmail(b, slot, sender()).subject },
    ],
  });
});

app.post('/api/send', async (req, res) => {
  const b = req.body || {};
  const slot = SLOTS.includes(b.slot) ? b.slot : 'morning';
  if (running) return res.status(409).json({ error: 'A scheduled run is in progress. Try again in a minute.' });
  try {
    await refresh();
  } catch (e) {
    return res.status(502).json({ error: `Lighthouse could not be refreshed, so no mail was sent. ${e.message}` });
  }
  try {
    const results = await sendSlot(slot, {
      test: Boolean(b.test),
      names: Array.isArray(b.names) ? b.names : null,
      includeTeam: b.team !== false,
      includeIndividual: b.individual !== false,
    });
    const c = loadConfig();
    const full = !b.test && !Array.isArray(b.names) && b.team !== false && b.individual !== false;
    if (full && results.some((r) => r.ok) && mins(istNow().time) >= mins(DEFAULTS.slots[slot]) - 30) c.last[slot] = istNow().date;
    c.log = [{ at: new Date().toISOString(), slot, manual: true, test: Boolean(b.test), sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).map((r) => `${r.who}: ${r.error}`), ok: results.every((r) => r.ok) }, ...(c.log || [])].slice(0, 60);
    saveConfig(c);
    res.json({ results });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/config', (req, res) => {
  const c = loadConfig();
  const b = req.body || {};
  const hhmm = (v) => /^\d{2}:\d{2}$/.test(v);
  if (typeof b.enabled === 'boolean') c.enabled = b.enabled;
  if (typeof b.sendIndividual === 'boolean') c.sendIndividual = b.sendIndividual;
  if (typeof b.sendTeam === 'boolean') c.sendTeam = b.sendTeam;
  if (Number(b.talkTargetMin) > 0) c.talkTargetMin = Math.round(Number(b.talkTargetMin));
  if (b.slots) for (const s of SLOTS) if (hhmm(b.slots[s])) c.slots[s] = b.slots[s];
  saveConfig(c);
  res.json(status(req));
});

app.post('/api/login', (req, res) => {
  let v = String((req.body && req.body.auth) || '').trim().replace(/^authorization:\s*/i, '');
  if (!v) return res.status(400).json({ error: 'Paste the Authorization value first.' });
  if (!/^bearer\s/i.test(v) && !v.includes('=')) v = `Bearer ${v}`;
  saveEnv(/^bearer\s/i.test(v) ? 'LIGHTHOUSE_AUTH' : 'LIGHTHOUSE_COOKIE', v);
  res.json({ ok: true });
});

app.post('/api/email-settings', (req, res) => {
  const { user, pass, fromName, host, port, fromEmail } = req.body || {};
  if (host !== undefined) saveEnv('SMTP_HOST', String(host).trim().replace(/[^a-z0-9.-]/gi, ''));
  if (port !== undefined && Number(port) > 0) saveEnv('SMTP_PORT', String(Math.round(Number(port))));
  if (fromEmail !== undefined) {
    const f = String(fromEmail).trim().toLowerCase();
    if (f && !f.endsWith(`@${G.DOMAIN}`)) return res.status(400).json({ error: `The sender address must be an @${G.DOMAIN} address.` });
    saveEnv('FROM_EMAIL', f);
  }
  if (user) saveEnv('SMTP_USER', String(user).trim());
  if (pass) saveEnv('SMTP_PASS', String(pass).replace(/\s+/g, ''));
  if (fromName) saveEnv('FROM_NAME', String(fromName).trim());
  transporter = null;
  res.json({ ok: true });
});

// ---------- Sign in with Google ----------
const baseUrl = (req) => (process.env.APP_URL || (CLOUD ? `https://${req.headers['x-forwarded-host'] || req.headers.host}` : `http://localhost:${PORT}`)).replace(/\/$/, '');
const redirectUri = (req) => `${baseUrl(req)}/auth/google/callback`;
const page = (ok, msg, back = '/#/settings') => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TM Hub</title><body style="font-family:Segoe UI,Arial,sans-serif;background:#f2f6f6;display:grid;place-items:center;height:100vh;margin:0"><div style="background:#fff;padding:32px 36px;border-radius:16px;max-width:460px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08)"><div style="font-size:40px">${ok ? '✅' : '⚠️'}</div><p style="font-size:16px;color:#1d2b2c;line-height:1.5">${String(msg).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</p><a href="${back}" style="color:#0d5c63;font-weight:600">Back to the hub</a></div>${ok ? `<script>setTimeout(()=>location.href="${back}",1500)</script>` : ''}</body>`;

function startGoogle(req, res, mode) {
  try {
    const { url, nonce } = G.authUrl(redirectUri(req), mode);
    auth.setCookie(req, res, 'tmhub_oauth', nonce, 600);
    res.redirect(url);
  } catch (e) {
    res.status(400).send(page(false, e.message, '/'));
  }
}
// ---------- Access requests ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// the confirmation a person gets when access is approved
const accessMail = (url) => `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;color:#1d2b2c;line-height:1.55"><h2 style="margin:0 0 10px">You now have access to Lighthouse V2</h2><p>Hi, your access to <b>Lighthouse V2</b> has been approved.</p><p>Open the website and sign in with your UPRIO Google account:</p><p><a href="${url}" style="background:#2b2f8f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open Lighthouse V2</a></p><p style="font-size:13px;color:#555">${url}</p></div>`;
async function mailTo(to, subject, html) {
  const me = senderAddr();
  if (G.account()) return G.send({ fromName: sender().name, to, subject, html });
  if (me && smtpConfigured()) return mailer().sendMail({ from: `"${sender().name}" <${me}>`, to, subject, html });
  throw new Error('No mailbox is connected to send from.');
}
async function accessRequestPage(req, who) {
  const st = accessOf(who.email).status;
  if (st === 'denied') return page(false, `Access for ${who.email} was not approved. Please contact ${ownerEmail() || 'the owner'}.`, '/');
  const isNew = Access.request(who.email, who.name);
  if (isNew && ownerEmail()) {
    const tok = (action) => auth.sign({ a: action, e: who.email, exp: Date.now() + 14 * 86400000 });
    const link = (action) => `${baseUrl(req)}/auth/decide?a=${action}&t=${encodeURIComponent(tok(action))}`;
    const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px"><h2 style="margin:0 0 8px">Access request: Lighthouse V2</h2><p><b>${esc(who.name || who.email)}</b> (${esc(who.email)}) signed in and is asking for access.</p><p>Approved people see the overall team numbers only. TMs in your team list see their own tasks and students.</p><p><a href="${link('approve')}" style="background:#2b2f8f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Review and approve</a> &nbsp; <a href="${link('deny')}" style="color:#b83223">Review and deny</a></p><p style="color:#777;font-size:12px">You can also approve or remove people any time in Settings → Access.</p></div>`;
    try {
      await mailTo(ownerEmail(), `Access request: ${who.name || who.email}`, html);
    } catch (e) {
      console.log('[access] could not mail the owner:', e.message);
    }
  }
  return page(true, `Thanks ${esc(who.name || '')}. Your request for access was sent to ${esc(ownerEmail() || 'the owner')}. You will be able to sign in once it is approved.`, '/');
}
const decidePage = (inner) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lighthouse V2</title><body style="font-family:Segoe UI,Arial,sans-serif;background:#f6f3ec;display:grid;place-items:center;min-height:100vh;margin:0"><div style="background:#fff;padding:32px 36px;border-radius:16px;max-width:460px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08)">${inner}</div>`;
app.get('/auth/decide', (req, res) => {
  const p = auth.verify(String(req.query.t || ''));
  if (!p || !p.e) return res.status(400).send(decidePage('<p>This link has expired or is not valid. Open Settings → Access in the hub instead.</p>'));
  const act = req.query.a === 'deny' ? 'deny' : 'approve';
  res.send(decidePage(`<h2 style="margin-top:0">${act === 'approve' ? 'Approve' : 'Deny'} access?</h2><p><b>${esc(p.e)}</b></p><form method="post" action="/auth/decide"><input type="hidden" name="t" value="${esc(req.query.t)}"><input type="hidden" name="a" value="${act}"><button style="background:${act === 'approve' ? '#2b2f8f' : '#b83223'};color:#fff;border:0;padding:11px 26px;border-radius:9px;font-size:15px;font-weight:600;cursor:pointer">${act === 'approve' ? 'Yes, approve' : 'Yes, deny'}</button></form>`));
});
app.post('/auth/decide', express.urlencoded({ extended: false }), async (req, res) => {
  const p = auth.verify(String((req.body || {}).t || ''));
  if (!p || !p.e) return res.status(400).send(decidePage('<p>This link has expired or is not valid.</p>'));
  const act = (req.body || {}).a === 'deny' ? 'deny' : 'approve';
  Access.decide(p.e, act, ownerEmail());
  if (act === 'approve') mailTo(p.e, 'You now have access to Lighthouse V2', accessMail(baseUrl(req))).catch(() => {});
  res.send(decidePage(`<div style="font-size:40px">${act === 'approve' ? '✅' : '🚫'}</div><p>${esc(p.e)} was ${act === 'approve' ? 'approved' : 'denied'}.</p>`));
});
// Settings → Access (owner only; see the guard near the top)
app.get('/api/access', (req, res) => res.json(Access.list()));
app.post('/api/access/decide', async (req, res) => {
  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase();
  if (!G.allowed(email)) return res.status(400).json({ error: `Use an @${G.DOMAIN} address.` });
  if (!['approve', 'deny', 'remove'].includes(b.action)) return res.status(400).json({ error: 'Unknown action.' });
  Access.decide(email, b.action, req.user || 'owner');
  let mail = '';
  if (b.action === 'approve') {
    try {
      await mailTo(email, 'You now have access to Lighthouse V2', accessMail(baseUrl(req)));
      mail = 'sent';
    } catch (e) {
      mail = 'Access was given, but the confirmation mail could not be sent: ' + e.message;
    }
  }
  res.json({ ...Access.list(), mail });
});

// Log in to the hub.
app.get('/auth/login', (req, res) => startGoogle(req, res, 'login'));
// A TM connects their own mailbox (send permission only).
app.get('/auth/mailbox', (req, res) => startGoogle(req, res, 'tm'));
// Connect the mailbox the hub sends from (also asks for permission to send).
app.get('/auth/google', (req, res) => startGoogle(req, res, 'send'));
app.get('/auth/logout', (req, res) => {
  auth.signOut(req, res);
  res.redirect('/');
});
app.get('/auth/google/callback', async (req, res) => {
  if (req.query.error) return res.status(400).send(page(false, req.query.error === 'access_denied' ? 'Sign-in was cancelled.' : `Google said: ${req.query.error}`, '/'));
  try {
    const who = await G.finish(String(req.query.code || ''), String(req.query.state || ''), redirectUri(req), auth.cookies(req).tmhub_oauth);
    auth.setCookie(req, res, 'tmhub_oauth', '', 0);
    if (!G.allowed(who.email)) throw new Error(`${who.email} is not an @${G.DOMAIN} account.`);
    if (GATED && !mayLogin(who.email)) return res.status(403).send(await accessRequestPage(req, who));
    if (GATED) auth.signIn(req, res, who.email);
    rememberName(who.email, who.name);
    if (who.mode === 'tm') {
      const isTm = team().some((t) => String(t.email).toLowerCase() === who.email) || who.email === ownerEmail();
      if (!isTm) throw new Error(`${who.email} is not on the TM list, so a mailbox can't be connected for it.`);
      if (!who.canSend) throw new Error('Permission to send email was not ticked on the Google screen. Try again and allow it.');
      if (!who.refreshToken) throw new Error('Google did not return a long-term connection. Try again.');
      G.saveTm(who.email, who.name, who.refreshToken);
      return res.send(page(true, `Connected ${who.email}. Mails can now be sent from your own address when a rule asks for it. You can disconnect any time from the sidebar.`));
    }
    if (who.mode !== 'send') return res.redirect('/');
    if (GATED && who.email !== ownerEmail()) throw new Error(`Only ${ownerEmail() || 'the owner'} can connect the mailbox. You signed in as ${who.email}.`);
    if (!who.canSend) throw new Error('Permission to send email was not ticked on the Google screen. Try again and allow it.');
    if (!who.refreshToken) throw new Error('Google did not return a long-term connection. Try again.');
    G.saveSender(who.email, who.name, who.refreshToken);
    res.send(page(true, `Connected ${who.email}. The hub will send mail from this address.`));
  } catch (e) {
    res.status(400).send(page(false, e.message, '/'));
  }
});

// ---------- Each TM's own mailbox ----------
app.get('/api/my-mailbox', (req, res) => {
  if (req.role !== 'owner' && req.role !== 'tm') return res.status(403).json({ error: 'Not allowed.' });
  const me = req.user || ownerEmail();
  res.json({ email: me, connected: req.role === 'owner' ? Boolean(G.account()) : Boolean(G.tmAccount(me)) });
});
app.post('/api/my-mailbox/disconnect', (req, res) => {
  if (req.role !== 'tm') return res.status(403).json({ error: 'Only a TM can disconnect their own mailbox here.' });
  G.removeTm(req.user);
  res.json({ ok: true });
});
// Owner: who has connected
app.get('/api/mailboxes', (req, res) => {
  if (req.role !== 'owner') return res.status(403).json({ error: 'Only the owner can see this.' });
  const on = new Map(G.listTm().map((a) => [a.email, a.at]));
  res.json({ hub: G.account() ? G.account().email : null, tms: team().map((t) => ({ name: t.name, email: t.email, connected: on.has(String(t.email).toLowerCase()), at: on.get(String(t.email).toLowerCase()) || null })) });
});

// ---------- PTM remark reminders (rule 1) ----------
// A TM who conducted a PTM (Done) and has not written the remark 1 hour after it ended gets a warning mail from the
// owner's mailbox, again about every 30 minutes until it is in. 11 AM to 8 PM IST, Monday to Saturday.
const APP_URL = () => process.env.APP_URL || 'https://tm-task-mailer.vercel.app';
async function sendOneMail({ to, subject, html }) {
  if (G.account()) return G.send({ fromName: sender().name, to, subject, html });
  return mailer().sendMail({ from: `"${sender().name}" <${senderAddr()}>`, to, subject, html });
}
async function pendingRemarks() {
  const today = istDate();
  const meetings = await ptmMeetings(addDays(today, -PRem.LOOKBACK_DAYS), today);
  return PRem.pending(meetings, Remarks.load(), team(), Date.now());
}
async function runPtmReminders({ test = false, force = false, only = null } = {}) {
  const st = PRem.load();
  const now = istNow();
  const inWindow = now.day !== PRem.WINDOW.skipDay && mins(now.time) >= mins(PRem.WINDOW.from) && mins(now.time) <= mins(PRem.WINDOW.to);
  if (!test && !force) {
    if (!st.enabled) return { skipped: 'Reminders are switched off.' };
    if (!inWindow) return { skipped: 'Outside 11 AM to 8 PM, Monday to Saturday.' };
  }
  let list = await pendingRemarks();
  if (test && !list.length) {
    const t = team()[0];
    list = [{ tm: t, items: [{ student: 'Sample Student', studentId: '00000', start: new Date(Date.now() - 2 * 3600000).toISOString(), end: new Date(Date.now() - 3600000).toISOString(), minutes: 20 }] }];
  }
  if (only && only.length) list = list.filter((e) => only.includes(e.tm.name));
  const sent = [];
  const failed = [];
  for (const e of list) {
    const lastMs = st.last[e.tm.name] ? Date.parse(st.last[e.tm.name]) : 0;
    if (!test && !force && Date.now() - lastMs < PRem.SPACING_MIN * 60000) continue;
    const mail = PRem.buildMail(e, sender(), APP_URL() + '/#/ptm');
    try {
      await sendOneMail({ to: test ? senderAddr() : e.tm.email, subject: (test ? `[TEST for ${e.tm.name.split(' ')[0]}] ` : '') + mail.subject, html: mail.html });
      if (!test) st.last[e.tm.name] = new Date().toISOString();
      sent.push({ tm: e.tm.name, pending: e.items.length });
    } catch (err) {
      failed.push({ tm: e.tm.name, error: mailErr(err) });
    }
  }
  if (!test) {
    // a TM with nothing pending starts fresh: the next PTM is reminded as soon as its hour is up
    for (const k of Object.keys(st.last)) if (!list.some((e) => e.tm.name === k)) delete st.last[k];
    if (sent.length || failed.length) st.log = [{ at: new Date().toISOString(), sent, failed }, ...st.log].slice(0, 40);
  }
  PRem.save(st);
  return { ok: !failed.length, sent, failed, pending: list.map((e) => ({ tm: e.tm.name, count: e.items.length })) };
}
app.get('/api/ptm-reminders', async (req, res) => {
  const st = PRem.load();
  let list = [];
  let error = '';
  try {
    list = await pendingRemarks();
  } catch (e) {
    error = e.message;
  }
  res.json({
    enabled: st.enabled,
    onlySupported: true,
    rule: 'Reminder 1 hour after a PTM is done without a remark, then about every 30 minutes, 11 AM to 8 PM IST, Monday to Saturday.',
    pending: list.map((e) => ({ tm: e.tm.name, email: e.tm.email, items: e.items.map((i) => ({ student: i.student, studentId: i.studentId, start: i.start })), lastReminder: st.last[e.tm.name] || null })),
    log: st.log.slice(0, 10),
    error,
  });
});
app.post('/api/ptm-reminders/config', (req, res) => {
  const st = PRem.load();
  st.enabled = !!(req.body && req.body.enabled);
  PRem.save(st);
  res.json({ ok: true, enabled: st.enabled });
});
// One real round now, whatever the time or day (the normal schedule then carries on from the next window).
app.post('/api/ptm-reminders/send-now', async (req, res) => {
  try {
    const only = Array.isArray(req.body && req.body.only) ? req.body.only.map(String) : null;
    res.json(await runPtmReminders({ force: true, only }));
  } catch (e) {
    res.status(500).json({ error: mailErr(e) });
  }
});
app.post('/api/ptm-reminders/test', async (req, res) => {
  try {
    res.json(await runPtmReminders({ test: true }));
  } catch (e) {
    res.status(500).json({ error: mailErr(e) });
  }
});

// ---------- Scheduled jobs (Vercel Cron) ----------
// vercel.json calls these Monday to Saturday at 11:00, 17:00 and 20:00 IST.
app.get('/api/cron/:slot', async (req, res) => {
  const slot = req.params.slot;
  // With CRON_SECRET set, only Vercel's own scheduler gets in. Without it the
  // time window below still means a stray call can only start the mail that
  // was due at that time anyway, and only once a day.
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Not allowed.' });
  if (slot === 'ptm-remarks') {
    try {
      return res.json(await runPtmReminders());
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  const c = loadConfig();
  const now = istNow();
  if (slot === 'baseline') {
    const t = mins(now.time) - mins(BASELINE_AT);
    if (t < -5 || t > 55) return res.json({ skipped: 'Not the time for the 10 AM refresh.' });
    if (now.day === 'Sun') return res.json({ skipped: 'Sunday.' });
    if (c.last.baseline === now.date) return res.json({ skipped: 'Already done today.' });
    try {
      await takeBaseline();
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (!SLOTS.includes(slot)) return res.status(404).json({ error: 'Unknown slot.' });
  const late = mins(now.time) - mins(DEFAULTS.slots[slot]);
  if (late < -5 || late > 180) return res.json({ skipped: 'Not the time for this mail.' });
  if (!c.enabled) return res.json({ skipped: 'Automatic sending is switched off.' });
  if (now.day === 'Sun') return res.json({ skipped: 'Sunday.' });
  if (c.last[slot] === now.date) return res.json({ skipped: 'Already sent today.' });
  try {
    const { entry } = await runSlot(slot);
    res.json({ ok: entry.ok, sent: entry.sent, failed: entry.failed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/google-client', (req, res) => {
  const id = String((req.body && req.body.id) || '').trim();
  const secret = String((req.body && req.body.secret) || '').trim();
  if (CLOUD) return res.status(400).json({ error: 'On Vercel the Google client is set in the project’s Environment Variables, not here.' });
  if (!/.apps.googleusercontent.com$/.test(id)) return res.status(400).json({ error: 'The client ID should end with .apps.googleusercontent.com' });
  if (!secret && !process.env.GOOGLE_CLIENT_SECRET) return res.status(400).json({ error: 'Paste the client secret too.' });
  saveEnv('GOOGLE_CLIENT_ID', id);
  if (secret) saveEnv('GOOGLE_CLIENT_SECRET', secret);
  res.json({ ok: true });
});
app.post('/api/google-signout', (req, res) => {
  G.signOut();
  res.json({ ok: true });
});

app.post('/api/email-check', async (req, res) => {
  try {
    if (G.account()) await G.accessToken();
    else await mailer().verify();
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: /535|BadCredentials|Username and Password/i.test(e.message) ? 'Google rejected the App Password. Create a new one at myaccount.google.com/apppasswords and save it here.' : e.message });
  }
});

module.exports = app;

// On Vercel the app is loaded by api/index.js; only a direct start listens on a port.
if (require.main === module) app.listen(PORT, '127.0.0.1', () => {
  console.log(`TM Hub running at http://localhost:${PORT}`);
  if (process.env.OPEN_BROWSER) require('child_process').exec(`start "" http://localhost:${PORT}`);
  // Load fresh data on start if what we have is from an earlier day.
  const A = loadLatest();
  if (!A || A.date !== istNow().date) refresh().catch((e) => console.log(`[refresh] ${e.message}`));
});

// Plain-language version of the common Gmail login failure.
function mailErr(e) {
  const m = String((e && e.message) || e);
  if (/535|BadCredentials|Invalid login/i.test(m)) return smtpHost() === 'smtp.gmail.com' ? 'Gmail rejected the saved App Password. Use "Sign in with Google" in Settings instead.' : `The mail server ${smtpHost()} rejected the login. Check the username and password in Settings.`;
  return m;
}
