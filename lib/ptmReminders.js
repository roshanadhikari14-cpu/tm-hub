// Rule 1: when a TM has conducted a PTM (marked Done) and has not written the remark within 1 hour of the
// meeting ending, the TM gets a warning mail from the owner's mailbox, repeated about every 30 minutes until
// every remark is in. Only between 11:00 and 20:00 IST, Monday to Saturday.
const fs = require('fs');
const path = require('path');
const { DATA } = require('./paths');

const FILE = path.join(DATA, 'ptm-reminder.json');
const GRACE_MIN = 60; // remark due 1 hour after the PTM ends
const SPACING_MIN = 22; // about every 30 minutes; the scheduler ticks every 15, so 22 avoids skipping a round
const WINDOW = { from: '11:00', to: '20:00', skipDay: 'Sun' };
const LOOKBACK_DAYS = 7; // catches a PTM from earlier in the week that still has no remark

const defaults = () => ({ enabled: false, last: {}, log: [] });
function load() {
  try {
    return { ...defaults(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch {
    return defaults();
  }
}
function save(s) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(s));
}

// Who still owes a remark right now. One student counts once a day, even with several meetings.
function pending(meetings, remarks, team, nowMs) {
  const tmOf = (host) => team.find((t) => [t.name, t.lighthouseName, t.oldName].some((n) => n && n.toLowerCase() === String(host).toLowerCase()));
  const groups = new Map();
  for (const m of meetings) {
    if (m.status !== 'completed') continue; // marked Done in Lighthouse
    const key = `${m.host}|${m.studentId || m.student}|${m.date}`;
    const g = groups.get(key) || { host: m.host, student: m.student, studentId: m.studentId, date: m.date, list: [] };
    g.list.push(m);
    groups.set(key, g);
  }
  const byTm = new Map();
  for (const g of groups.values()) {
    const due = Math.max(...g.list.map((m) => new Date(m.end).getTime())) + GRACE_MIN * 60000;
    if (due > nowMs) continue; // the hour is not up yet
    if (g.list.some((m) => remarks[m.id])) continue; // a remark is in
    const tm = tmOf(g.host);
    if (!tm || !tm.email) continue;
    const l = byTm.get(tm.name) || { tm, items: [] };
    const last = g.list.slice().sort((a, b) => String(b.end).localeCompare(String(a.end)))[0];
    l.items.push({ student: g.student, studentId: g.studentId, date: g.date, start: last.start, end: last.end, minutes: g.list.reduce((s, m) => s + (m.parentMinutes || 0), 0), dueAt: due });
    byTm.set(tm.name, l);
  }
  for (const l of byTm.values()) l.items.sort((a, b) => String(a.start).localeCompare(String(b.start)));
  return [...byTm.values()];
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtTime = (iso) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

function buildMail(entry, sender, url) {
  const first = entry.tm.name.split(' ')[0];
  const n = entry.items.length;
  const rows = entry.items
    .map((i) => `<tr><td style="padding:8px 12px;border-top:1px solid #e3e9f1"><b>${esc(i.student)}</b><br><span style="color:#7a8799;font-size:12px">ID ${esc(i.studentId)}</span></td><td style="padding:8px 12px;border-top:1px solid #e3e9f1">${esc(fmtTime(i.start))}</td><td style="padding:8px 12px;border-top:1px solid #e3e9f1">${i.minutes ? esc(i.minutes) + ' min' : '—'}</td></tr>`)
    .join('');
  const subject = `Action needed: update your PTM remark${n === 1 ? '' : 's'} (${n} pending)`;
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#0f1b2d;max-width:620px">
<p>Hi ${esc(first)},</p>
<p>You conducted the ${n === 1 ? 'PTM' : n + ' PTMs'} below, but ${n === 1 ? 'the remark has' : 'the remarks have'} not been updated yet. Remarks are due within 1 hour of the PTM, so please add ${n === 1 ? 'it' : 'them'} now: how the PTM went, the parent's concerns, what was agreed and the follow-ups.</p>
<table style="border-collapse:collapse;width:100%;border:1px solid #e3e9f1;border-radius:8px"><thead><tr style="background:#f4f8fc;text-align:left"><th style="padding:8px 12px">Student</th><th style="padding:8px 12px">PTM held</th><th style="padding:8px 12px">Parent time</th></tr></thead><tbody>${rows}</tbody></table>
<p style="margin:18px 0"><a href="${esc(url)}" style="background:#2c3a8c;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Add remarks in the TM Hub</a></p>
<p>We will keep reminding you every 30 minutes (11 AM to 8 PM) until all remarks are in.</p>
<p>Regards,<br><b>${esc(sender.name)}</b><br>${esc(sender.title)}</p></div>`;
  return { subject, html };
}

module.exports = { load, save, pending, buildMail, WINDOW, SPACING_MIN, GRACE_MIN, LOOKBACK_DAYS };
