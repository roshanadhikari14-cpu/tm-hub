// Pulls everything the hub needs from Lighthouse (read-only GETs) and saves
// one combined file: data/latest.json.
const fs = require('fs');
const path = require('path');

const BASE = 'https://backend.uprio.com/api/v2/';
const { DATA } = require('./paths');
const LATEST = path.join(DATA, 'latest.json');
const RENEWALS = path.join(DATA, 'renewals.json');

function headers() {
  const h = { Accept: 'application/json' };
  if (process.env.LIGHTHOUSE_AUTH) h.Authorization = process.env.LIGHTHOUSE_AUTH;
  if (process.env.LIGHTHOUSE_COOKIE) h.Cookie = process.env.LIGHTHOUSE_COOKIE;
  return h;
}

async function get(p, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + p, { headers: headers() });
      if (res.status === 401 || res.status === 403) {
        const e = new Error(`Lighthouse refused the login (HTTP ${res.status}). Paste a fresh login in Settings.`);
        e.auth = true;
        throw e;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${p.split('?')[0]}`);
      return await res.json();
    } catch (e) {
      if (e.auth) throw e;
      lastErr = e;
    }
  }
  throw lastErr;
}

const istDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
function weekOf(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  const mon = addDays(iso, -((d.getUTCDay() + 6) % 7));
  return { start: mon, end: addDays(mon, 6) };
}

async function workList(metric, date) {
  const items = [];
  for (let page = 1; page < 20; page++) {
    const j = await get(`tm-work-report/details?period=day&date=${date}&metric=${metric}&page=${page}&pageSize=500`);
    items.push(...((j.data && j.data.items) || []));
    if (page >= ((j.data && j.data.pages) || 1)) break;
  }
  return items;
}

// This week plus last week, so tasks still open from last week are kept.
// The current week's copy of a record wins.
async function drill(section, metric, today, weeks = 2) {
  const out = new Map();
  for (let i = 0; i < weeks; i++) {
    const w = weekOf(addDays(today, -7 * i));
    const j = await get(
      `reports/tm-performance/drilldown?startDate=${w.start}&endDate=${w.end}&section=${section}&metric=${metric}&windowStart=${addDays(today, -19)}&windowEnd=${today}`
    );
    for (const r of (j.data && j.data.records) || []) {
      const id = r.taskId || r.feedbackId || `${r.studentId}:${r.tmName}`;
      if (!out.has(id)) out.set(id, i ? { ...r, carried: true } : r);
    }
  }
  return [...out.values()];
}

// Last working day (Mon-Sat) before the given date.
function prevWorkDay(iso) {
  let d = addDays(iso, -1);
  if (new Date(`${d}T00:00:00Z`).getUTCDay() === 0) d = addDays(d, -1);
  return d;
}

// The chapter-planning API caps each page at 25 rows, so read every page.
async function allPages(route) {
  const docs = [];
  const first = await get(`${route}?limit=100&page=1`);
  docs.push(...(first.docs || []));
  const pages = Math.min(first.totalPages || 1, 40);
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => get(`${route}?limit=100&page=${i + 2}`)));
  for (const j of rest) docs.push(...(j.docs || []));
  return docs;
}

// Keeps only what the profile page shows, so the saved file stays small.
function slimStudent(s) {
  return {
    id: s.studentId,
    name: s.studentName,
    grade: s.gradeName,
    school: s.schoolName,
    schoolId: s.schoolId,
    batch: s.batchName,
    level: s.mathLevel,
    oneOnOne: s.oneOnOne,
    lapsed: Boolean(s.subscriptionLapsed),
    notStarted: s.notStarted,
    joinedAt: s.joinedAt,
    nextExam: s.nextExam || null,
    greenPct: s.greenPct,
    processPct: s.processPct,
    improvementPct: s.improvementPct,
    evalCount: s.evalCount,
    liftLoad: s.liftLoad,
    catchupMissPct: s.evalCatchupMiss ? s.evalCatchupMiss.pct : null,
    lastContact: s.contact ? s.contact.lastAt : null,
    contacts30: s.contact ? s.contact.last30 : null,
  };
}

// Month-to-date attendance per student. The board gives one status per day
// plus the class types held that day, so "regular" counts the days that had a
// Regular class and whether the student was present that day.
async function attendance(tmId, from, to) {
  const out = new Map();
  for (let page = 1; page < 20; page++) {
    const j = await get(`attendance-board?page=${page}&pageSize=100&from=${from}&to=${to}&filter%5BtutorManagerId%5D%5B0%5D=${tmId}`);
    for (const d of j.docs || []) {
      const reg = (d.grid || []).filter((g) => g.classTypes && g.classTypes.split(' + ').includes('Regular') && (g.status === 'present' || g.status === 'absent'));
      out.set(d.studentId, {
        regHeld: reg.length,
        regAttended: reg.filter((g) => g.status === 'present').length,
        allHeld: d.attendance ? d.attendance.held : null,
        allAttended: d.attendance ? d.attendance.attended : null,
        streak: d.streakDays || 0,
        lastAttended: d.lastAttendedDate || null,
        onHoliday: Boolean(d.onHolidayToday),
      });
    }
    if (page >= (j.totalPages || 1)) break;
  }
  return out;
}

// "TM process completion" per TM: evals that needed a LIFT or catch-up and got it (Student Learning Progress).
function procPct(ov) {
  const out = {};
  for (const s of (ov && ov.data && ov.data.stms) || []) for (const t of s.tms || []) if (t.summary && typeof t.summary.processPct === 'number') out[t.tmName] = t.summary.processPct;
  return out;
}

async function fetchAll(team) {
  const today = istDate();
  const monthStart = `${today.slice(0, 8)}01`;
  const yesterday = prevWorkDay(today);
  const errors = [];
  const safe = async (label, fn, fallback) => {
    try {
      return await fn();
    } catch (e) {
      if (e.auth) throw e;
      errors.push(`${label}: ${e.message}`);
      return fallback;
    }
  };

  const [day, prevDay, week, evalList, liftList, missing, owners, health, onboarding, pcf, tickets, ticketsToday, ticketsOverdue, nc15, ptm, procMaths, procScience] =
    await Promise.all([
      safe('Work report (today)', () => get(`tm-work-report/overview?period=day&date=${today}`), null),
      safe('Work report (yesterday)', () => get(`tm-work-report/overview?period=day&date=${yesterday}`), null),
      // Completed days only: the week up to the last working day.
      safe('Work report (week)', () => get(`tm-work-report/overview?period=week&date=${yesterday}`), null),
      safe('Eval to-book list', () => workList('eval.toBookMorning', today), []),
      safe('IC2 to-book list', () => workList('lift.toBookMorning', today), []),
      safe('Missing chapters', () => allPages('chapter-planning-health/missing-chapters'), []),
      safe('Chapter owners', () => get('chapter-planning-health/owners'), null),
      safe('Pending approvals', () => allPages('chapter-planning-health/health'), []),
      safe('Onboarding tasks', () => drill('onboarding', 'onbTasksDue', today), []),
      safe('Negative feedback tasks', () => drill('postClassFeedback', 'pcfTasksDue', today), []),
      safe('Concerns', () => drill('concerns', 'totalRequestsConcerns', today), []),
      safe('Concerns due today', () => drill('concerns', 'dueToday', today, 1), []),
      safe('Concerns overdue', () => drill('concerns', 'dueTillYesterday', today, 1), []),
      // Students whose parent has not been connected for 15+ days.
      safe('NC-15', () => drill('nc15', 'nc15Count', today, 1), []),
      safe('PTMs', () => ptmMeetings(addDays(today, -13), addDays(today, 2)), null),
      safe('TM process (Maths)', () => get('student-learning/overview?subject=Maths&period=last_exam'), null),
      safe('TM process (Science)', () => get('student-learning/overview?subject=Science&period=last_exam'), null),
    ]);

  // Nothing came back at all (no internet, Lighthouse down): keep the data we already have.
  if (!day && !week && errors.length >= 10) throw new Error('Lighthouse could not be reached. The last saved data is still shown.');

  const tmSummaries = (ov) => {
    const out = {};
    for (const s of (ov && ov.data && ov.data.stms) || []) for (const t of s.tms || []) out[t.tmName] = { tmId: t.tmId, ...t.summary };
    return out;
  };
  const workDay = tmSummaries(day);
  const workWeek = tmSummaries(week);

  const chapterOwners = {};
  for (const s of (owners && owners.data && owners.data.stms) || []) for (const t of s.tms || []) chapterOwners[t.tmName] = { tmId: t.tmId, ...t.summary };

  // Student lists: the "All Students" tab, one TM at a time.
  const students = {};
  for (const m of team) {
    const lh = m.lighthouseName || m.name;
    const tmId = (workDay[lh] && workDay[lh].tmId) || (chapterOwners[lh] && chapterOwners[lh].tmId) || m.tmId;
    if (!tmId) continue;
    const j = await safe(`Students of ${m.name}`, () => get(`student-learning?tmId=${tmId}`), null);
    if (j && j.data && j.data.students) students[lh] = j.data.students.map(slimStudent);
    // Attendance for the month so far, from the Attendance Board.
    const att = await safe(`Attendance of ${m.name}`, () => attendance(tmId, monthStart, today), null);
    if (att && students[lh]) for (const st of students[lh]) st.att = att.get(st.id) || null;
  }

  // Next renewal date: Lighthouse only gives it one student at a time, so keep what we
  // learn and re-ask only for new students, passed dates, or answers older than a week.
  {
    let known = {};
    try {
      known = JSON.parse(fs.readFileSync(RENEWALS, 'utf8'));
    } catch {}
    const all = Object.values(students).flat();
    const now = Date.now();
    const stale = (k) => !k || now - k.at > 7 * 864e5 || (k.date && new Date(k.date).getTime() < now && now - k.at > 6 * 36e5);
    const todo = [...new Set(all.map((s) => s.id))].filter((id) => stale(known[id]));
    const stopAt = now + (process.env.VERCEL ? 12000 : 90000);
    let failed = 0;
    const worker = async () => {
      while (todo.length && Date.now() < stopAt && failed < 15) {
        const id = todo.shift();
        try {
          const j = await get(`subscriptions/${id}`, 1);
          const rec = (j && j.data && j.data.subscriptionRec) || {};
          // Lighthouse shows the day after "valid till" as the due date.
          known[id] = { at: Date.now(), date: rec.validTill ? new Date(new Date(rec.validTill).getTime() + 1).toISOString() : null, auto: Boolean(rec.renew) };
        } catch (e) {
          if (e.auth) known[id] = { at: Date.now(), date: null };
          failed++;
        }
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    if (failed >= 15) errors.push('Renewal dates: Lighthouse did not answer for some students.');
    const ids = new Set(all.map((s) => String(s.id)));
    for (const k of Object.keys(known)) if (!ids.has(k)) delete known[k];
    try {
      fs.mkdirSync(DATA, { recursive: true });
      fs.writeFileSync(RENEWALS, JSON.stringify(known));
    } catch {}
    for (const s of all) s.renewal = (known[s.id] && known[s.id].date) || null;
  }

  const data = {
    fetchedAt: new Date().toISOString(),
    date: today,
    prevDate: yesterday,
    monthStart,
    errors,
    workDay,
    workPrevDay: tmSummaries(prevDay),
    workWeek,
    evalList,
    liftList,
    missingChapters: missing,
    chapterOwners,
    health,
    onboarding,
    pcf,
    tickets: { all: tickets, today: ticketsToday, overdue: ticketsOverdue },
    nc15,
    ptm,
    process: { Maths: procPct(procMaths), Science: procPct(procScience) },
    students,
  };
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(LATEST, JSON.stringify(data));
  return data;
}

function loadLatest() {
  try {
    return JSON.parse(fs.readFileSync(LATEST, 'utf8'));
  } catch {
    return null;
  }
}

// Parent-teacher meetings (PTMs) the team hosts, from Lighthouse's Parent Meetings page.
// History stops at today, so today's meetings still to come are added from the team list.
async function ptmMeetings(from, to) {
  const [hist, upcoming] = await Promise.all([
    get(`parent-addon-sessions/tm-meetings/team/history?from=${from}&to=${to}`),
    get('parent-addon-sessions/tm-meetings/team').catch(() => null),
  ]);
  const byId = new Map();
  for (const m of [...(((hist || {}).data || {}).meetings || []), ...(((upcoming || {}).data) || [])]) {
    if (!m || !m.sessionId || (m.date && (m.date < from || m.date > to))) continue;
    byId.set(m.sessionId, {
      id: m.sessionId,
      host: m.hostName || '',
      hostId: m.hostId,
      studentId: m.studentId,
      student: m.studentName || `Student #${m.studentId}`,
      date: m.date,
      slot: m.slotTime,
      start: m.meetingStartTime,
      end: m.meetingEndTime,
      status: m.status,
      parentJoined: m.parentJoined,
      parentMinutes: m.attendedSeconds == null ? null : Math.round(m.attendedSeconds / 60),
      recording: Boolean(m.hasRecording),
      agenda: m.agenda || '',
      with: (m.attendees || []).map((a) => a.name).filter(Boolean),
    });
  }
  return [...byId.values()].sort((a, b) => String(a.start).localeCompare(String(b.start)));
}

// Every PTM ever booked for one student (any TM), with the parent's name.
async function studentPtms(studentId) {
  const j = await get(`parent-addon-sessions/tm-meetings?studentId=${Number(studentId)}`);
  return ((j && j.data) || []).map((m) => ({
    id: m.id,
    host: m.hostName || '',
    date: m.date,
    start: m.meetingStartTime,
    end: m.meetingEndTime,
    status: m.status,
    parent: m.guardianName || '',
    agenda: (m.meta && m.meta.agenda) || '',
    bookedFrom: (m.meta && m.meta.bookedFrom) || '',
    bookedAt: m.createdAt || null,
    cancelReason: (m.meta && (m.meta.cancelReason || m.meta.cancellationReason)) || '',
  }));
}

module.exports = { fetchAll, loadLatest, istDate, addDays, ptmMeetings, studentPtms };
