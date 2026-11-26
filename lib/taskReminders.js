// Hourly mail to everyone who still has a task open in the Task tracker. One mail per person listing all of them,
// at most once an hour, 10 AM to 8 PM IST, Monday to Saturday.
const fs = require('fs');
const path = require('path');
const { DATA } = require('./paths');

const FILE = path.join(DATA, 'task-reminder.json');
const WINDOW = { from: '10:00', to: '20:00', skipDay: 'Sun' };
const SPACING_MIN = 55; // triggers do not arrive exactly on the hour

function load() {
  try {
    return { enabled: true, last: {}, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch {
    return { enabled: true, last: {} };
  }
}
function save(s) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(s));
}

const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const inWindow = (now) => now.day !== WINDOW.skipDay && minutes(now.time) >= minutes(WINDOW.from) && minutes(now.time) <= minutes(WINDOW.to);

// who gets a mail right now: [{ name, email, tasks }]
function due(tasks, last, nowMs) {
  const by = new Map();
  for (const t of tasks) {
    if (t.status !== 'open' || !t.assigneeEmail) continue;
    const e = by.get(t.assignee) || { name: t.assignee, email: t.assigneeEmail, tasks: [] };
    e.tasks.push(t);
    by.set(t.assignee, e);
  }
  const out = [...by.values()].filter((e) => nowMs - (last[e.name] || 0) >= SPACING_MIN * 60000);
  for (const e of out) e.tasks.sort((a, b) => a.due.localeCompare(b.due));
  return out;
}

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const day = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function buildMail(entry, today, sender, url) {
  const n = entry.tasks.length;
  const state = (t) => {
    const past = Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(t.due + 'T00:00:00Z')) / 86400000);
    if (past > 0) return `<b style="color:#b42318">${past} day${past === 1 ? '' : 's'} past due</b>`;
    if (past === 0) return '<b style="color:#9a6700">Due today</b>';
    return `Due in ${-past} day${past === -1 ? '' : 's'}`;
  };
  const rows = entry.tasks
    .map((t) => `<tr><td style="padding:8px 12px;border-top:1px solid #e3e9f1"><b>${esc(t.title)}</b><br><span style="color:#7a8799;font-size:12px">by ${esc(t.createdBy)}</span></td><td style="padding:8px 12px;border-top:1px solid #e3e9f1;white-space:nowrap">${day(t.due)}</td><td style="padding:8px 12px;border-top:1px solid #e3e9f1;white-space:nowrap">${state(t)}</td></tr>`)
    .join('');
  return {
    subject: `Reminder: ${n} task${n === 1 ? '' : 's'} pending`,
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#0f1b2d;max-width:620px"><p>Hi ${esc(entry.name.split(' ')[0])},</p><p>${n === 1 ? 'This task is' : `These ${n} tasks are`} still pending.</p>
<table style="border-collapse:collapse;width:100%;border:1px solid #e3e9f1"><thead><tr style="background:#f4f8fc;text-align:left"><th style="padding:8px 12px">Task</th><th style="padding:8px 12px">Due date</th><th style="padding:8px 12px">Status</th></tr></thead><tbody>${rows}</tbody></table>
<p style="margin:18px 0"><a href="${esc(url)}/#/tracker" style="background:#2b2f8f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Mark complete with remarks</a></p>
<p style="color:#5b6773;font-size:12.5px">This reminder repeats every hour (10 AM to 8 PM, Monday to Saturday) until the task is marked complete.</p><p>Regards,<br><b>${esc(sender.name)}</b></p></div>`,
  };
}

module.exports = { load, save, due, inWindow, buildMail, WINDOW, SPACING_MIN };
