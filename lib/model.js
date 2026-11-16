// Turns the raw Lighthouse data into per-TM task lists, daily progress
// against the 11 AM baseline, statuses, hints and a performance score.
const fs = require('fs');
const path = require('path');

const { DATA } = require('./paths');
const DAY_DIR = path.join(DATA, 'days');
const HISTORY = path.join(DATA, 'history.json');

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const istDay = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const dayDiff = (a, b) => Math.round((new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86400000);
const fmtDay = (d) => new Date(d).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
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

// Same booking tiers Roshan already uses for the daily call plan.
const tierPct = (n) => (n <= 10 ? 90 : n <= 25 ? 80 : 70);
const need = (n) => Math.ceil((n * tierPct(n)) / 100);

const TASKS = [
  { key: 'onboarding', label: 'Onboarding tasks', short: 'Onboarding', icon: '🚀', kind: 'list', weight: 15, cols: ['Student', 'Task', 'Due', 'Status'] },
  { key: 'negfb', label: 'Negative feedback', short: 'Neg. feedback', icon: '💬', kind: 'list', weight: 10, cols: ['Student', 'Class', 'Rating', 'Status'] },
  { key: 'concerns', label: 'Concerns & requests', short: 'Concerns', icon: '⚠️', kind: 'list', weight: 15, cols: ['Student', 'Type', 'Category', 'Age', 'Status'] },
  { key: 'nc15', label: 'NC-15 (no parent connect)', short: 'NC-15', icon: '📵', kind: 'list', weight: 10, cols: ['Student', 'Last connect', 'Days since'] },
  { key: 'talk', label: 'Talk time', short: 'Talk time', icon: '📞', kind: 'talk', weight: 15, cols: [] },
  { key: 'ic2', label: 'IC2 booked', short: 'IC2 booked', icon: '📈', kind: 'booking', src: 'lift', weight: 15, cols: ['Student', 'Grade', 'Chapter', 'Waiting since'] },
  { key: 'eval', label: 'Eval booked', short: 'Eval booked', icon: '📝', kind: 'booking', src: 'evalCatchup', weight: 10, cols: ['Student', 'Grade', 'Chapter', 'Waiting since'] },
  { key: 'chapters', label: 'Chapter planning missing', short: 'Chapters missing', icon: '📚', kind: 'list', weight: 10, cols: ['Batch', 'Subject', 'Missing', 'Days pending'] },
  { key: 'approvals', label: 'Pending approvals', short: 'Approvals', icon: '✅', kind: 'list', weight: 10, cols: ['Batch', 'Subject', 'Chapter', 'Pending', 'Status'] },
];

const lhName = (m) => m.lighthouseName || m.name;
const firstName = (m) => m.name.split(' ')[0];

// ---------- Open items right now, per TM ----------

function openItems(A, m) {
  const tm = norm(lhName(m));
  const mine = (r) => norm(r.tmName) === tm;
  const managed = (d) => (d.tutorManagers || []).some((t) => norm(t.name) === tm);
  const today = A.date;
  const due = new Set((A.tickets.today || []).map((r) => r.feedbackId));
  const overdue = new Set((A.tickets.overdue || []).map((r) => r.feedbackId));
  const seen = new Set();
  const uniq = (id) => (seen.has(id) ? false : (seen.add(id), true));

  const onboarding = (A.onboarding || [])
    .filter((r) => mine(r) && r.taskStatus !== 'Completed' && uniq('o' + r.taskId))
    .map((r) => {
      const late = r.dueDate ? dayDiff(today, istDay(r.dueDate)) : 0;
      return {
        id: String(r.taskId),
        flag: late > 0,
        sort: -late,
        cells: [r.studentName, r.taskName, r.dueDate ? fmtDay(r.dueDate) : '—', late > 0 ? `Overdue ${late}d` : late === 0 ? 'Due today' : 'Upcoming'],
      };
    });

  const negfb = (A.pcf || [])
    .filter((r) => mine(r) && r.taskStatus !== 'Completed' && uniq('n' + r.taskId))
    .map((r) => ({
      id: String(r.taskId),
      flag: Number(r.feedbackRating) <= 2,
      sort: Number(r.feedbackRating) || 9,
      cells: [r.studentName, r.className || '—', r.feedbackRating ? `${r.feedbackRating}★` : '—', r.taskStatus || 'Pending'],
    }));

  const concerns = (A.tickets.all || [])
    .filter((r) => mine(r) && r.resolved !== 'Yes' && uniq('c' + r.feedbackId))
    .map((r) => {
      // Still open from last week = past its due date.
      const state = overdue.has(r.feedbackId) || r.carried ? 'Overdue' : due.has(r.feedbackId) ? 'Due today' : 'Open';
      return {
        id: r.feedbackId,
        flag: state === 'Overdue' || (r.ageDays || 0) >= 3,
        sort: state === 'Overdue' ? -100 - (r.ageDays || 0) : -(r.ageDays || 0),
        cells: [r.studentName, r.feedbackType, r.category || '—', `${r.ageDays ?? 0}d`, state],
      };
    });

  // NC-15: one row per student, longest silence first.
  const nc15 = (A.nc15 || [])
    .filter((r) => mine(r) && uniq('k' + r.studentId))
    .map((r) => {
      const d = r.daysSinceContact;
      return {
        id: String(r.studentId),
        flag: d == null || d >= 25,
        sort: -(d == null ? 999 : d),
        cells: [r.studentName, r.lastContactDate ? fmtDay(r.lastContactDate) : 'Never', d == null ? '—' : `${d}d`],
      };
    });

  const booking = (list) =>
    list
      .filter((r) => mine(r) && !r.bookedAt && !r.subscriptionLapsed)
      .map((r) => {
        const age = r.createdAt ? dayDiff(today, istDay(r.createdAt)) : 0;
        return {
          id: String(r.taskId),
          flag: age >= 5,
          sort: -age,
          cells: [r.studentName, r.grade ? `Class ${r.grade}` : '—', r.chapterName || '—', r.createdAt ? `${fmtDay(r.createdAt)} (${age}d)` : '—'],
        };
      });

  const chapters = (A.missingChapters || [])
    .filter((d) => managed(d))
    .map((d) => ({
      id: d.key,
      flag: (d.daysPending || 0) >= 2 || d.missingField === 'ongoing',
      sort: -(d.daysPending || 0),
      cells: [d.batchName, d.subjectName, d.missingField === 'ongoing' ? 'Ongoing chapter' : 'Next chapter', `${d.daysPending ?? 0}d`],
    }));

  const approvals = (A.health || [])
    .filter((d) => managed(d) && d.pendingApprovals > 0)
    .map((d) => {
      const ch = [d.ongoing, d.next].find((c) => c && c.approvalStatus === 'pending') || d.next || d.ongoing;
      return {
        id: d.key,
        flag: d.pendingApprovalsOverTwoDays > 0,
        sort: -(d.pendingApprovalsOverTwoDays || 0),
        cells: [d.batchName, d.subjectName, (ch && ch.chapterName) || '—', String(d.pendingApprovals), d.pendingApprovalsOverTwoDays > 0 ? 'Over 2 days' : 'New'],
      };
    });

  const byFlag = (a, b) => b.flag - a.flag || a.sort - b.sort;
  return {
    onboarding: onboarding.sort(byFlag),
    negfb: negfb.sort(byFlag),
    concerns: concerns.sort(byFlag),
    nc15: nc15.sort(byFlag),
    ic2: booking(A.liftList || []).sort(byFlag),
    eval: booking(A.evalList || []).sort(byFlag),
    chapters: chapters.sort(byFlag),
    approvals: approvals.sort(byFlag),
  };
}

// ---------- Daily baseline (taken at the 11 AM run) ----------

const dayFile = (date) => path.join(DAY_DIR, `${date}.json`);
const loadDay = (date) => readJson(dayFile(date), { date, baselineAt: null, tms: {} });

function ensureBaseline(A, team, reset = false) {
  const day = loadDay(A.date);
  let changed = false;
  let moved = false;
  for (const m of team) {
    // A TM whose name was corrected keeps the baseline saved under the old spelling.
    if (m.oldName && day.tms[m.oldName]) {
      if (!day.tms[m.name]) day.tms[m.name] = day.tms[m.oldName];
      delete day.tms[m.oldName];
      moved = true;
    }
    if (day.tms[m.name] && !reset) continue;
    const open = openItems(A, m);
    const w = A.workDay[lhName(m)] || {};
    day.tms[m.name] = {
      ids: Object.fromEntries(Object.entries(open).map(([k, v]) => [k, v.map((x) => x.id)])),
      toBook: {
        ic2: Number((w.lift && (w.lift.toBookMorning || w.lift.toBook)) || 0),
        eval: Number((w.evalCatchup && (w.evalCatchup.toBookMorning || w.evalCatchup.toBook)) || 0),
      },
    };
    changed = true;
  }
  if (changed) day.baselineAt = A.fetchedAt;
  if (changed || moved) writeJson(dayFile(A.date), day);
  return day;
}

// ---------- One TM's day ----------

function tmDay(A, m, cfg, slot) {
  const lh = lhName(m);
  const open = openItems(A, m);
  const day = loadDay(A.date);
  const base = day.tms[m.name];
  const w = A.workDay[lh] || {};
  const out = {};

  for (const t of TASKS) {
    if (t.kind === 'list') {
      const now = open[t.key];
      // A baseline taken before a task existed has no list for it: start from now.
      const baseIds = base && base.ids[t.key] ? base.ids[t.key] : now.map((x) => x.id);
      const still = new Set(now.map((x) => x.id));
      const closed = baseIds.filter((id) => !still.has(id)).length;
      const fresh = now.filter((x) => !baseIds.includes(x.id)).length;
      out[t.key] = { morning: baseIds.length, pending: now.length, closed, fresh, target: baseIds.length, done: closed, items: now, flagged: now.filter((x) => x.flag).length };
      if (t.key === 'nc15') {
        // Target: NC-15 at or under 5% of the TM's students, so connect the rest (oldest first).
        const students = ((A.students && A.students[lh]) || []).length || w.students || 0;
        const allowed = Math.floor(students * 0.05);
        Object.assign(out.nc15, { students, allowed, target: Math.max(baseIds.length - allowed, 0) });
      }
    } else if (t.kind === 'booking') {
      const s = w[t.src] || {};
      const toBookLive = Number(s.toBookMorning || s.toBook || 0);
      const morning = base && base.toBook[t.key] ? base.toBook[t.key] : toBookLive;
      const booked = Number(s.toBookBooked || 0);
      const target = need(morning);
      const items = open[t.key];
      out[t.key] = { morning, pending: Math.max(morning - booked, 0), closed: booked, fresh: 0, target, done: booked, items, flagged: items.filter((x) => x.flag).length, backlog: s.backlog, waiting: s.waiting };
    } else {
      const p = w.parents || {};
      const prev = (A.workPrevDay[lh] || {}).parents || {};
      const mins = Math.round((p.talkSeconds || 0) / 60);
      out.talk = {
        morning: 0,
        pending: Math.max(cfg.talkTargetMin - mins, 0),
        closed: mins,
        target: cfg.talkTargetMin,
        done: mins,
        minutes: mins,
        yesterday: Math.round((prev.talkSeconds || 0) / 60),
        connected: p.parentsConnected || 0,
        dialled: p.dialled || 0,
        calls: p.connectedCalls || 0,
        ptm: p.ptmMeetings || 0,
        items: [],
        flagged: 0,
      };
    }
    out[t.key].status = statusOf(t, out[t.key], slot);
    out[t.key].hints = hintsFor(t, out[t.key], slot, m);
  }
  return out;
}

// clear | ok | watch | critical, depending on the time of day.
function statusOf(t, s, slot) {
  if (t.kind === 'talk') {
    const r = s.done / (s.target || 1);
    if (slot === 'morning') return s.yesterday >= s.target ? 'ok' : s.yesterday >= s.target * 0.6 ? 'watch' : 'critical';
    if (r >= 1) return 'clear';
    const exp = slot === 'progress' ? 0.55 : 1;
    return r >= exp ? 'ok' : r >= exp * 0.6 ? 'watch' : 'critical';
  }
  if (t.kind === 'booking') {
    if (!s.morning) return 'clear';
    const r = s.done / (s.target || 1);
    if (slot === 'morning') return s.flagged > 0 ? 'watch' : 'ok';
    if (r >= 1) return 'clear';
    const exp = slot === 'progress' ? 0.6 : 1;
    return r >= exp ? 'ok' : r >= exp * 0.5 ? 'watch' : 'critical';
  }
  if (!s.pending) return 'clear';
  if (t.key === 'nc15') {
    if (s.pending <= s.allowed) return 'ok';
    if (slot === 'morning') return s.flagged > 0 ? 'critical' : 'watch';
    const r = s.target ? s.done / s.target : 1;
    const exp = slot === 'progress' ? 0.6 : 1;
    return r >= exp ? 'ok' : slot === 'closure' || r < exp * 0.5 ? 'critical' : 'watch';
  }
  if (s.flagged > 0 && t.key !== 'negfb') return 'critical';
  if (slot === 'morning') return s.pending >= 5 ? 'watch' : 'ok';
  const r = s.target ? s.done / s.target : 0;
  const exp = slot === 'progress' ? 0.6 : 1;
  return r >= exp ? 'ok' : slot === 'closure' || r < exp * 0.5 ? 'critical' : 'watch';
}

// Practical next steps, chosen from the task's status and its oldest items.
function hintsFor(t, s, slot, m) {
  const h = [];
  const top = (s.items || [])[0];
  const late = (s.items || []).filter((x) => x.flag).length;
  switch (t.key) {
    case 'onboarding':
      if (!s.pending) return ['All onboarding tasks closed. Use the time for a welcome call to the newest parents.'];
      if (late) h.push(`${late} task${late > 1 ? 's are' : ' is'} past due. Close these first: a delayed onboarding call is the #1 reason new parents feel ignored.`);
      if (top) h.push(`Start with ${top.cells[0]} (${top.cells[1]}).`);
      h.push('Batch the First Class Calls before 1 PM; parents pick up best late morning. Log the outcome in Lighthouse straight after the call.');
      break;
    case 'negfb':
      if (!s.pending) return ['No open negative-feedback tasks. Keep it that way: call any parent whose child rated a class 2★ or below the same day.'];
      h.push('Call the parent within 24 hours: acknowledge, ask what went wrong, and agree one concrete fix (tutor change, extra class, catch-up).');
      if (s.items.some((x) => x.flag)) h.push('1–2★ ratings first. Loop in the tutor before you call so you can share what will change.');
      break;
    case 'concerns':
      if (!s.pending) return ['No open concerns. Great: a quick “all sorted?” message to last week’s complainants builds trust.'];
      if (late) h.push(`${late} concern${late > 1 ? 's are' : ' is'} overdue or 3+ days old. Resolve or escalate to Roshan today; don’t let them age further.`);
      h.push('Reply to the parent first (even if the fix takes time), then close the ticket with a clear resolution note.');
      break;
    case 'nc15': {
      if (!s.pending) return ['No NC-15 students. Every parent has heard from you in the last 15 days.'];
      const over = Math.max(s.pending - s.allowed, 0);
      if (!over) return [`${s.pending} NC-15 student${s.pending > 1 ? 's' : ''}, within the 5% limit (${s.allowed} of ${s.students} students). Connect them anyway when a slot opens.`];
      h.push(`Connect ${over} parent${over > 1 ? 's' : ''} today to get back under 5% (${s.allowed} of ${s.students} students). Longest silence first.`);
      if (top) h.push(`Start with ${top.cells[0]} (${top.cells[1] === 'Never' ? 'never connected' : `last connect ${top.cells[1]}`}).`);
      h.push('If the parent doesn’t pick up, send a WhatsApp update on the child’s progress and ask for a time to call. Log the connect in Lighthouse.');
      break;
    }
    case 'talk':
      if (slot === 'morning') {
        h.push(`Yesterday: ${s.yesterday} min vs target ${s.target} min.`);
        h.push(`Plan ~${Math.ceil(s.target / 6)} min per hour from 11 AM. Monthly discussions and NC-15 parents are good long, useful calls.`);
      } else if (s.done < s.target) {
        h.push(`${s.target - s.done} min to go. ${slot === 'progress' ? 'Use the 5–8 PM window, when most parents are home.' : 'Carry this gap into tomorrow’s first hour.'}`);
        if (s.dialled && s.calls / s.dialled < 0.5) h.push(`Only ${s.calls} of ${s.dialled} dials connected. Try WhatsApp first, then call at the time the parent suggests.`);
      } else h.push('Target met. Spend extra calls on parents you haven’t spoken to in 15+ days.');
      break;
    case 'ic2':
    case 'eval': {
      const what = t.key === 'ic2' ? 'IC2 (LIFT) classes' : 'eval catch-ups';
      if (!s.morning) return [`Nothing to book for ${what} today.`];
      if (s.done >= s.target) return [`Target of ${s.target} met (${s.done} booked). Book any remaining students to cut tomorrow’s backlog.`];
      h.push(`Book ${s.target - s.done} more ${what} to hit the target of ${s.target} (out of ${s.morning} to book).`);
      if (s.flagged) h.push(`${s.flagged} student${s.flagged > 1 ? 's have' : ' has'} been waiting 5+ days. Book them first.`);
      h.push('Offer two specific slots on the call instead of asking “when are you free?”: it doubles the booking rate.');
      break;
    }
    case 'chapters':
      if (!s.pending) return ['Every batch has its chapters planned. Check next week’s planned chapters still match the school schedule.'];
      h.push('Fill the missing “ongoing” chapters first: a batch with no ongoing chapter can’t schedule lectures.');
      if (late) h.push(`${late} batch${late > 1 ? 'es have' : ' has'} been missing for 2+ days. Confirm with the school/tutor today and plan it.`);
      break;
    case 'approvals':
      if (!s.pending) return ['No approvals waiting on you.'];
      h.push('Review the chapter plan and approve or send back with a note. Each pending approval blocks the tutor’s plan.');
      if (late) h.push(`${late} approval${late > 1 ? 's have' : ' has'} waited over 2 days. Clear ${late > 1 ? 'them' : 'it'} first.`);
      break;
  }
  return h;
}

// ---------- Performance card ----------

function performance(A, m, cfg, today) {
  const lh = lhName(m);
  const tm = norm(lh);
  const mine = (r) => norm(r.tmName) === tm;
  const wk = A.workWeek[lh] || {};
  const owners = A.chapterOwners[lh] || {};
  const onb = (A.onboarding || []).filter(mine);
  const pcf = (A.pcf || []).filter(mine);
  const tickets = (A.tickets.all || []).filter(mine);
  const share = (s) => (s ? (s.booked || s.toBook ? pct(s.booked || 0, (s.booked || 0) + (s.toBook || 0)) : 100) : null);
  // Weekly work figures run up to the last working day (A.prevDate).
  const weekday = (new Date(`${A.prevDate || A.date}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
  const workDays = Math.max(1, Math.min(6, weekday + 1));
  const weekTalk = Math.round(((wk.parents && wk.parents.talkSeconds) || 0) / 60);
  const pendingApprovals = (A.health || []).filter((d) => d.pendingApprovals > 0 && (d.tutorManagers || []).some((t) => norm(t.name) === tm)).length;

  const metrics = {
    onboarding: { value: onb.length ? pct(onb.filter((r) => r.taskStatus === 'Completed').length, onb.length) : 100, label: `${onb.filter((r) => r.taskStatus === 'Completed').length}/${onb.length} done (2 wks)` },
    negfb: { value: pcf.length ? pct(pcf.filter((r) => r.taskStatus === 'Completed').length, pcf.length) : 100, label: `${pcf.filter((r) => r.taskStatus === 'Completed').length}/${pcf.length} closed (2 wks)` },
    concerns: { value: tickets.length ? pct(tickets.filter((r) => r.resolved === 'Yes').length, tickets.length) : 100, label: `${tickets.filter((r) => r.resolved === 'Yes').length}/${tickets.length} resolved (2 wks)` },
    nc15: (() => {
      const n = (A.nc15 || []).filter(mine).length;
      const total = ((A.students && A.students[lh]) || []).length || (A.workDay[lh] || {}).students || 0;
      const share = total ? (100 * n) / total : 0;
      // Full marks at 5% or less, then 10 points off for every extra percent.
      return { value: clamp(Math.round(100 - Math.max(share - 5, 0) * 10)), label: `${n} of ${total} students (${Math.round(share)}%, target ≤5%)` };
    })(),
    talk: { value: clamp(pct(weekTalk, workDays * cfg.talkTargetMin) || 0), label: `${Math.round(weekTalk / workDays)} min/day avg (target ${cfg.talkTargetMin})` },
    ic2: { value: share(wk.lift) ?? 100, label: `${(wk.lift && wk.lift.booked) || 0} booked, ${(wk.lift && wk.lift.toBook) || 0} waiting` },
    eval: { value: share(wk.evalCatchup) ?? 100, label: `${(wk.evalCatchup && wk.evalCatchup.booked) || 0} booked, ${(wk.evalCatchup && wk.evalCatchup.toBook) || 0} waiting` },
    chapters: { value: clamp(100 - (owners.missing || 0) * 8), label: `${owners.missing || 0} missing of ${owners.batches || 0} batches` },
    approvals: { value: clamp(100 - pendingApprovals * 25), label: `${pendingApprovals} pending` },
  };
  let sum = 0;
  let wsum = 0;
  for (const t of TASKS) {
    if (metrics[t.key].value === null) continue;
    sum += metrics[t.key].value * t.weight;
    wsum += t.weight;
  }
  const score = wsum ? Math.round(sum / wsum) : 0;
  const grade = score >= 85 ? 'Star performer' : score >= 70 ? 'On track' : score >= 50 ? 'Needs a push' : 'At risk';

  const studs = (A.students && A.students[lh]) || [];
  const avg = (k) => {
    const v = studs.map((s) => s[k]).filter((x) => typeof x === 'number');
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const w = A.workDay[lh] || {};
  return {
    score,
    grade,
    metrics,
    students: studs.length || w.students || 0,
    avgGreen: avg('greenPct'),
    avgImprovement: avg('improvementPct'),
    noContact15: studs.filter((s) => !s.lastContact || dayDiff(today, istDay(s.lastContact)) > 15).length,
    batches: owners.batches || 0,
  };
}

// ---------- History (one row per TM per day, updated on every refresh) ----------

function recordHistory(date, rows) {
  const h = readJson(HISTORY, {});
  h[date] = Object.fromEntries(rows.map((r) => [r.name, { score: r.perf.score, pending: Object.fromEntries(TASKS.map((t) => [t.key, r.tasks[t.key].pending])), done: Object.fromEntries(TASKS.map((t) => [t.key, r.tasks[t.key].done])) }]));
  const keep = Object.keys(h).sort().slice(-60);
  writeJson(HISTORY, Object.fromEntries(keep.map((k) => [k, h[k]])));
}
const loadHistory = () => readJson(HISTORY, {});

function slotNow(cfg) {
  const t = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
  if (t >= cfg.slots.closure) return 'closure';
  if (t >= cfg.slots.progress) return 'progress';
  return 'morning';
}

function build(A, team, cfg, slot) {
  const rows = team.map((m) => {
    const tasks = tmDay(A, m, cfg, slot);
    const perf = performance(A, m, cfg, A.date);
    const concerns = TASKS.filter((t) => tasks[t.key].status === 'critical').map((t) => t.short);
    return { name: m.name, first: firstName(m), email: m.email, photo: m.photo, lighthouseName: lhName(m), tasks, perf, concerns };
  });
  return { date: A.date, slot, fetchedAt: A.fetchedAt, errors: A.errors, rows };
}

module.exports = { TASKS, build, ensureBaseline, loadDay, recordHistory, loadHistory, slotNow, lhName, firstName, fmtDay };
