// Turns one typed line ("Ask Preety to schedule PTM with Paridhi tomorrow 5pm, urgent") into the fields of a task:
// who, which student, subject line, date, time and priority. Plain rules, no outside service, so student names never
// leave the hub. Anything it had to assume is flagged, and the result is only a preview until the user confirms it.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// words that are never read as a student's first name on their own
const STOP = new Set(
  ('a an and are as ask assign at be by call can class classes client for from get give has have he her him his in is it ' +
    'of on or our parent parents please pls remind report send share she sir maam student students tell that the their them ' +
    'they this to today tomorrow tonight we will with you your may june july march april august math maths science exam test ' +
    'meeting ptm tm all team everyone myself urgent asap high low medium priority week month day morning evening noon afternoon ' +
    'next before after about regarding follow followup up update check review plan planning chapter fee fees renewal payment ' +
    'attendance feedback concern doubt booking book eval onboarding approval approvals pending clear schedule conduct connect ' +
    'new old not no yes do does done need needs should must also very more less one two three four five six seven eight nine ten')
    .split(' ')
);

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const addDays = (day, n) => {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (day) => new Date(day + 'T00:00:00Z').getUTCDay();
const pad = (n) => String(n).padStart(2, '0');
const realDate = (y, m, d) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
};
// a day and month without a year: this year, or the next one when that day has already gone
function upcoming(d, m, y, today) {
  if (y) return realDate(y < 100 ? 2000 + y : y, m, d);
  const year = Number(today.slice(0, 4));
  const first = realDate(year, m, d);
  if (first && first >= today) return first;
  return realDate(year + 1, m, d) && (first || realDate(year + 1, m, d)) ? realDate(year + 1, m, d) : null;
}

function findDate(text, today) {
  const t = text.toLowerCase();
  let m;
  const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const month = (w) => MONTHS.indexOf(w.slice(0, 3)) + 1;
  if (/\bday after tomorrow\b/.test(t)) return addDays(today, 2);
  if (/\b(tomorrow|tmrw|tmr|tommorow|tomorow)\b/.test(t)) return addDays(today, 1);
  if ((m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON}\\b(?:\\s*,?\\s*(\\d{4}))?`)))) return upcoming(+m[1], month(m[2]), m[3] ? +m[3] : 0, today);
  if ((m = t.match(new RegExp(`\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(\\d{4}))?`)))) return upcoming(+m[2], month(m[1]), m[3] ? +m[3] : 0, today);
  if ((m = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?\b/))) return upcoming(+m[1], +m[2], m[3] ? +m[3] : 0, today);
  if ((m = t.match(/\b(?:in|after|within)\s+(\d{1,2})\s+days?\b/))) return addDays(today, +m[1]);
  if (/\bnext week\b/.test(t)) return addDays(today, 7);
  if (/\b(end of (the |this )?week|eow|this week)\b/.test(t)) return addDays(today, (6 - weekdayOf(today) + 7) % 7);
  for (let i = 0; i < 7; i++)
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(t)) return addDays(today, (i - weekdayOf(today) + 7) % 7 || 7);
  if (/\b(today|tonight|eod|end of (the )?day)\b/.test(t)) return today;
  return null;
}

function findTime(text) {
  const t = text.toLowerCase();
  let m;
  const out = (h, min) => (h >= 0 && h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null);
  if ((m = t.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/))) {
    const h = +m[1];
    if (h >= 1 && h <= 12) return { time: out((h % 12) + (m[3].startsWith('p') ? 12 : 0), +(m[2] || 0)), assumed: false };
  }
  if ((m = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/))) return { time: out(+m[1], +m[2]), assumed: false };
  // "at 5", "by 6": office hours, so 1 to 7 means evening
  const months = MONTHS.join('|');
  if ((m = t.match(new RegExp(`\\b(?:at|by|before)\\s+(\\d{1,2})\\b(?!\\s*(?:st|nd|rd|th|[/-]|:|\\.\\d|days?|students?|parents?|chapters?|${months}))`)))) {
    const h = +m[1];
    if (h >= 1 && h <= 12) return { time: out(h <= 7 ? h + 12 : h, 0), assumed: true };
  }
  if (/\b(eod|end of (the )?day)\b/.test(t)) return { time: '20:00', assumed: true };
  if (/\bnoon\b/.test(t)) return { time: '12:00', assumed: true };
  if (/\bafternoon\b/.test(t)) return { time: '15:00', assumed: true };
  if (/\bmorning\b/.test(t)) return { time: '11:00', assumed: true };
  if (/\bevening\b/.test(t)) return { time: '18:00', assumed: true };
  return { time: '', assumed: false };
}

function findPriority(text) {
  const t = text.toLowerCase();
  if (/\b(low priority|priority\s*:?\s*low|whenever|no rush|not urgent)\b/.test(t)) return { priority: 'Low', assumed: false };
  if (/\b(urgent|urgently|asap|immediately|high priority|priority\s*:?\s*high|important|critical|top priority)\b/.test(t)) return { priority: 'High', assumed: false };
  if (/\b(medium priority|priority\s*:?\s*medium)\b/.test(t)) return { priority: 'Medium', assumed: false };
  return { priority: 'Medium', assumed: true };
}

// first match wins, so the more specific lines come first
const CATEGORIES = [
  [/\bptm\b|parent[- ]teacher|parents? meeting/, 'Schedule PTM'],
  [/renewal|renew\b|payment|\bfees?\b|auto ?debit/, 'Renewal follow-up'],
  [/negative feedback|neg\.? feedback|bad rating/, 'Negative feedback follow-up'],
  [/onboard|welcome call/, 'Onboarding'],
  [/approval|approve/, 'Pending approvals'],
  [/chapter plan|planner|chapter planning/, 'Chapter planning'],
  [/attendance|absent|missing class|missed class|not joining|not attending/, 'Attendance follow-up'],
  [/improvement class|\bic2\b|extra class|revision class/, 'Improvement class booking'],
  [/evaluation|\beval\b/, 'Evaluation booking'],
  [/doubt/, 'Doubt session'],
  [/report/, 'Report sharing'],
  [/concern|complaint|issue|escalat/, 'Concern resolution'],
  [/\bcall\b|connect with|speak to|talk to|ring\b|nc-?15/, 'Parent call'],
  [/follow[- ]?up/, 'Follow-up'],
];

// names of people in the team, as written in the text
function findPeople(text, people, me) {
  const t = ' ' + norm(text) + ' ';
  const found = [];
  for (const person of people) {
    const names = [person.name, ...(person.aliases || [])].map(norm).sort((a, b) => b.length - a.length);
    for (const n of names) {
      const at = t.indexOf(' ' + n + ' ');
      if (at >= 0) {
        const before = t.slice(0, at + 1);
        // "ask Nida ...", "Nida to ...", "assign to Nida", or the name at the very start: it is addressed to them
        const directed = /(^ | )(ask|tell|assign to|assigned to|assign|remind|for|to be done by)( [a-z]+){0,1} $/.test(before) ? !/ with $/.test(before) : before.trim() === '' || /^ (hi|hey|dear|please|pls)? ?$/.test(before) || new RegExp(`^ ${esc(n)} (to|should|will|must|and|please|pls)\\b`).test(t.slice(at));
        found.push({ name: person.name, at, directed, len: n.length });
        break;
      }
    }
  }
  // "Nida and Renuka to ..." : the joined names count together
  for (const f of found)
    if (!f.directed)
      for (const g of found)
        if (g.directed && Math.abs(f.at - g.at) <= g.len + f.len + 6 && / (and|&) /.test(t.slice(Math.min(f.at, g.at), Math.max(f.at, g.at) + 1) + ' ')) f.directed = true;
  if (/\b(all tms?|all the tms?|every tm|everyone|everybody|all of you|whole team|entire team|team wide)\b/.test(t))
    return { names: people.filter((p) => !p.owner).map((p) => p.name), all: true };
  if (!found.some((f) => f.directed) && /\b(remind me|for me|myself|assign to me|i need to|i have to)\b/.test(t)) return { names: [me], all: false };
  const directed = found.filter((f) => f.directed);
  return { names: (directed.length ? directed : found).sort((a, b) => a.at - b.at).map((f) => f.name), all: false };
}

function findStudents(text, students, people, assignees) {
  const raw = String(text);
  const t = ' ' + norm(raw) + ' ';
  const teamWords = new Set(people.flatMap((p) => [p.name, ...(p.aliases || [])]).flatMap((n) => norm(n).split(' ')));
  const mine = (s) => (assignees.includes(s.tm) ? 0 : 1);
  const view = (s) => ({ id: s.id, name: s.name, grade: s.grade || '', school: s.school || '', tm: s.tm || '', own: assignees.includes(s.tm) });
  const out = [];
  const used = new Set(); // words already explained by a match
  const push = (mention, matches, exact) => {
    const list = matches.slice().sort((a, b) => mine(a) - mine(b) || a.name.localeCompare(b.name)).slice(0, 12);
    out.push({ mention, exact, matches: list.map(view), selected: list.length === 1 ? list[0].id : null });
  };

  // 1. student IDs
  for (const m of t.matchAll(/ (\d{3,6})(?= )/g)) {
    const s = students.find((x) => String(x.id) === m[1]);
    if (s) {
      push(m[1], [s], true);
      used.add(m[1]);
    }
  }
  // 2. full names (two words or more)
  const full = new Map();
  for (const s of students) {
    const n = norm(s.name);
    if (n.includes(' ') && t.includes(' ' + n + ' ')) full.set(n, [...(full.get(n) || []), s]);
  }
  for (const [n, list] of [...full].sort((a, b) => b[0].length - a[0].length)) {
    if (n.split(' ').every((w) => used.has(w))) continue;
    push(n, list, true);
    n.split(' ').forEach((w) => used.add(w));
  }
  // 3. first names, narrowed by the next word when it starts a surname or is its initial
  const words = t.trim().split(' ');
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.length < 3 || used.has(w) || STOP.has(w) || teamWords.has(w) || /^\d+$/.test(w)) continue;
    let list = students.filter((s) => norm(s.name).split(' ')[0] === w);
    if (!list.length) continue;
    const next = words[i + 1];
    let exact = false;
    if (next && !STOP.has(next) && list.length > 1) {
      const narrowed = list.filter((s) => {
        const rest = norm(s.name).split(' ').slice(1);
        return rest.some((r) => r === next || (next.length >= 3 && r.startsWith(next)) || (next.length === 1 && r.startsWith(next)));
      });
      if (narrowed.length) {
        list = narrowed;
        used.add(next);
        exact = list.length === 1;
      }
    }
    used.add(w);
    push(next && used.has(next) ? `${w} ${next}` : w, list, exact);
  }
  return out;
}

// the sentence without the "ask Nida to" part at the front
function actionOf(text, people) {
  const names = people.flatMap((p) => [p.name, ...(p.aliases || [])]).sort((a, b) => b.length - a.length).map(esc).join('|');
  const who = `(?:${names}|all tms?|everyone|me|myself|team)`;
  const list = `${who}(?:\\s*(?:,|and|&)\\s*${who})*`;
  let s = String(text).replace(/\s+/g, ' ').trim();
  s = s.replace(/^(?:please|pls|kindly|hi|hey)[\s,]+/i, '');
  s = s.replace(new RegExp(`^(?:ask|tell|assign(?:\\s+(?:a\\s+)?task)?(?:\\s+to)?|remind)\\s+${list}\\s*(?:,|:|-|to|that|for)?\\s+`, 'i'), '');
  s = s.replace(new RegExp(`^${list}\\s*(?::|-|–|,)\\s*`, 'i'), '');
  s = s.replace(new RegExp(`^${list}\\s+(?:to|should|must|will you(?: please)?|will|please|pls)\\s+`, 'i'), '');
  s = s.replace(/^(?:to|please|pls|kindly)\s+/i, '').trim();
  if (!s) return '';
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return /[.!?]$/.test(s) ? s : s + '.';
}

function subjectOf(action, students) {
  const t = action.toLowerCase();
  const cat = (CATEGORIES.find(([re]) => re.test(t)) || [])[1] || '';
  const maths = /\bmaths?\b|mathematics/.test(t);
  const science = /\bscience\b|physics|chemistry|biology/.test(t);
  const school = maths && science ? 'Maths and Science' : maths ? 'Maths' : science ? 'Science' : '';
  const names = students.filter((s) => s.selected != null).map((s) => s.matches.find((m) => m.id === s.selected).name);
  let head = cat;
  if (!head) {
    head = action.split(/[.!?\n]/)[0].replace(/\b(today|tomorrow|tonight|asap|urgent(ly)?|by eod|eod)\b/gi, '').replace(/\s+/g, ' ').trim();
    if (head.length > 70) head = head.slice(0, 69).replace(/\s+\S*$/, '') + '…';
  }
  const who = names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
  return { category: cat, schoolSubject: school, subject: [head + (cat && school ? ' · ' + school : ''), who].filter(Boolean).join(' – ') };
}

function parseTask(text, ctx) {
  const input = String(text == null ? '' : text).slice(0, 2000);
  const { today, now = '00:00', people = [], students = [], me = '', role = 'owner' } = ctx;
  const warnings = [];

  const found = findPeople(input, people, me);
  let assignees = found.names;
  const found_ = findStudents(input, students, people, assignees);
  let assumedAssignee = false;
  if (!assignees.length) {
    const tms = [...new Set(found_.filter((s) => s.selected != null).map((s) => s.matches[0].tm))].filter((n) => people.some((p) => p.name === n));
    if (role === 'tm') assignees = [me];
    else if (tms.length === 1) assignees = tms;
    assumedAssignee = assignees.length > 0;
  }
  // now that the assignee is known, mark and list their own students first
  const mentioned = findStudents(input, students, people, assignees);

  const date = findDate(input, today);
  const due = date || today;
  const time = findTime(input);
  const priority = findPriority(input);
  const action = actionOf(input, people);
  const subject = subjectOf(action, mentioned);

  if (!input.trim()) warnings.push('Type the task first.');
  if (!assignees.length) warnings.push('Choose who the task is for.');
  if (date && date < today) warnings.push('That date has already passed.');
  if (time.time && due === today && time.time < now) warnings.push('That time has already passed today.');
  for (const s of mentioned) {
    if (s.selected == null) warnings.push(`“${s.mention}” matches ${s.matches.length} students: pick the right one.`);
    else {
      const m = s.matches.find((x) => x.id === s.selected);
      if (m.tm && assignees.length && !assignees.includes(m.tm)) warnings.push(`${m.name} is ${m.tm.split(' ')[0]}'s student.`);
    }
  }

  return {
    input,
    assignees,
    due,
    time: time.time || '',
    priority: priority.priority,
    action,
    subject: subject.subject,
    category: subject.category,
    schoolSubject: subject.schoolSubject,
    students: mentioned,
    assumed: { assignee: assumedAssignee, date: !date, time: Boolean(time.assumed), priority: priority.assumed },
    warnings,
  };
}

module.exports = { parseTask, findDate, findTime, subjectOf };
