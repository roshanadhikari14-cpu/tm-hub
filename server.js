// TM Hub: live task board, TM profiles and the three daily emails
// (11 AM targets, 5 PM progress, 8 PM closure), Monday to Saturday.
const path = require('path');
const fs = require('fs');
const ENV_FILE = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: ENV_FILE });
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const nodemailer = require('nodemailer');
const { fetchAll, loadLatest, istDate } = require('./lib/lighthouse');
const M = require('./lib/model');
const { tmEmail, teamEmail, SLOT } = require('./lib/emails');
const G = require('./lib/google');
const auth = require('./lib/auth');
const persist = require('./lib/persist');
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
  last: { morning: null, progress: null, closure: null },
  log: [],
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
const CLOUD_KEYS = ['LIGHTHOUSE_AUTH', 'LIGHTHOUSE_COOKIE', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'FROM_NAME', 'FROM_EMAIL'];
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
async function runSlot(slot, manual = false) {
  if (running) throw new Error('A run is already in progress.');
  running = true;
  const entry = { at: new Date().toISOString(), slot, manual };
  try {
    try {
      await refresh();
    } catch (e) {
      // Fall back to the last saved data, but say so in the log.
      entry.warning = `Lighthouse refresh failed, used saved data: ${e.message}`;
    }
    const A = loadLatest();
    if (slot === 'morning' && A && A.date === istNow().date) M.ensureBaseline(A, team(), !manual);
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
    if (!manual) c.last[slot] = istNow().date;
    c.log = [entry, ...(c.log || [])].slice(0, 60);
    saveConfig(c);
    running = false;
  }
}

// On Vercel the timing comes from scheduled jobs instead (see /api/cron).
if (!CLOUD) setInterval(() => {
  const c = loadConfig();
  const now = istNow();
  if (!c.enabled || running || now.day === 'Sun') return;
  const t = mins(now.time);
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
app.use(express.json({ limit: '2mb' }));

// ---------- Login gate and cloud storage ----------
// On the internet every data route needs a Google login; on your own PC it does not.
const GATED = CLOUD || Boolean(process.env.REQUIRE_LOGIN);
const ownerEmail = () => (process.env.OWNER_EMAIL || '').trim().toLowerCase();
const mayLogin = (email) => {
  const list = (process.env.ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return G.allowed(email) && (!list.length || list.includes(email) || email === ownerEmail());
};
const isOwner = (req) => !GATED || Boolean(req.user && req.user === ownerEmail());
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/auth/')) return next();
  res.setHeader('Cache-Control', 'no-store');
  if (persist.enabled) {
    try {
      await persist.pull();
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
  if (GATED && req.path.startsWith('/api/') && !req.path.startsWith('/api/cron/') && !req.user)
    return res.status(401).json({ error: 'Please sign in.', login: true, clientReady: G.clientReady(), domain: G.DOMAIN });
  next();
});
// Sending mail and changing settings is for the owner only.
app.use(['/api/send', '/api/config', '/api/login', '/api/email-settings', '/api/google-client', '/api/google-signout'], (req, res, next) =>
  isOwner(req) ? next() : res.status(403).json({ error: `Only ${ownerEmail() || 'the owner'} can do this.` })
);
app.use(express.static(path.join(ROOT, 'public')));

const status = (req) => {
  const A = loadLatest();
  const c = loadConfig();
  return {
    now: istNow(),
    gated: GATED,
    cloud: CLOUD,
    storage: !CLOUD || persist.enabled,
    user: req ? req.user : null,
    owner: req ? isOwner(req) : true,
    lighthouse: Boolean(process.env.LIGHTHOUSE_AUTH || process.env.LIGHTHOUSE_COOKIE),
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

app.get('/api/board', async (req, res) => {
  if (CLOUD) {
    // No background timer on Vercel: load today's data the first time someone opens the hub.
    const A = loadLatest();
    if ((!A || A.date !== istNow().date) && (process.env.LIGHTHOUSE_AUTH || process.env.LIGHTHOUSE_COOKIE)) await refresh().catch(() => {});
  }
  const b = board(req.query.slot);
  res.json({ status: status(req), tasks: M.TASKS, board: b });
});

app.get('/api/tm/:name', (req, res) => {
  const b = board(req.query.slot);
  if (!b) return res.status(404).json({ error: 'No data yet. Click Refresh.' });
  const row = b.rows.find((r) => r.name === req.params.name);
  if (!row) return res.status(404).json({ error: 'Unknown TM' });
  const A = loadLatest();
  const hist = M.loadHistory();
  const history = Object.keys(hist)
    .sort()
    .map((d) => ({ date: d, ...(hist[d][row.name] || {}) }))
    .filter((h) => h.score !== undefined);
  res.json({ tasks: M.TASKS, row, slot: b.slot, monthStart: A.monthStart || null, dataDate: A.date, students: (A.students && A.students[row.lighthouseName]) || [], history, team: b.rows.map((r) => ({ name: r.name, score: r.perf.score })) });
});

// Student data as CSV: one TM (?tm=Name) or the whole team.
app.get('/api/students.csv', (req, res) => {
  const A = loadLatest();
  if (!A) return res.status(404).send('No data yet. Click Refresh.');
  const q = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const day = (d) => (d ? istDate(new Date(d)) : '');
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : '');
  const head = ['TM', 'Student ID', 'Student', 'Class', 'School', 'Batch', '1:1', 'Subscription lapsed', 'Joined', 'Regular classes held (month)', 'Regular classes attended (month)', 'Regular attendance %', 'All classes held (month)', 'All classes attended (month)', 'Absent streak (class days)', 'Last attended', 'On holiday today', 'Green %', 'Improvement %', 'IC2 load', 'Last parent contact', 'Parent contacts (30d)', 'Next exam', 'Next exam date'];
  const lines = [head.map(q).join(',')];
  for (const m of team()) {
    if (req.query.tm && req.query.tm !== m.name) continue;
    for (const s of (A.students && A.students[M.lhName(m)]) || []) {
      const a = s.att || {};
      lines.push(
        [m.name, s.id, s.name, s.grade, s.school, s.batch, s.oneOnOne ? 'Yes' : 'No', s.lapsed ? 'Yes' : 'No', day(s.joinedAt), a.regHeld ?? '', a.regAttended ?? '', a.regHeld ? pct(a.regAttended, a.regHeld) : '', a.allHeld ?? '', a.allAttended ?? '', a.streak ?? '', day(a.lastAttended), a.onHoliday ? 'Yes' : 'No', s.greenPct ?? '', s.improvementPct ?? '', s.liftLoad ?? '', day(s.lastContact), s.contacts30 ?? '', (s.nextExam && s.nextExam.name) || '', day(s.nextExam && s.nextExam.date)]
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
    const results = await sendSlot(slot, {
      test: Boolean(b.test),
      names: Array.isArray(b.names) ? b.names : null,
      includeTeam: b.team !== false,
      includeIndividual: b.individual !== false,
    });
    const c = loadConfig();
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
// Log in to the hub.
app.get('/auth/login', (req, res) => startGoogle(req, res, 'login'));
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
    if (!mayLogin(who.email)) throw new Error(`${who.email} is not on the list of people allowed to use this hub.`);
    if (GATED) auth.signIn(req, res, who.email);
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

// ---------- Scheduled jobs (Vercel Cron) ----------
// vercel.json calls these Monday to Saturday at 11:00, 17:00 and 20:00 IST.
app.get('/api/cron/:slot', async (req, res) => {
  const slot = req.params.slot;
  // With CRON_SECRET set, only Vercel's own scheduler gets in. Without it the
  // time window below still means a stray call can only start the mail that
  // was due at that time anyway, and only once a day.
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Not allowed.' });
  if (!SLOTS.includes(slot)) return res.status(404).json({ error: 'Unknown slot.' });
  const c = loadConfig();
  const now = istNow();
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
