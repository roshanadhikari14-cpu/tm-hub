// Everything still open for one student, for the task popup: Lighthouse tasks and tickets, the concerns board, and the
// hub's own lists (negative feedback, NC-15, classes still to be booked), grouped by kind.
const BASE = 'https://backend.uprio.com/api/v2/';
const CRM = 'https://lighthouse.uprio.com/tutoring-crm';

function headers() {
  const h = { Accept: 'application/json' };
  if (process.env.LIGHTHOUSE_AUTH) h.Authorization = process.env.LIGHTHOUSE_AUTH;
  if (process.env.LIGHTHOUSE_COOKIE) h.Cookie = process.env.LIGHTHOUSE_COOKIE;
  return h;
}
async function get(path) {
  const r = await fetch(BASE + path, { headers: headers(), signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

const GROUPS = [
  { key: 'concerns', label: 'Concerns and requests', icon: '⚠️' },
  { key: 'negfb', label: 'Negative feedback', icon: '💬' },
  { key: 'nc15', label: 'NC-15 parent connect', icon: '📵' },
  { key: 'classes', label: 'Improvement and catch-up classes', icon: '📈' },
  { key: 'onboarding', label: 'Onboarding tasks', icon: '🚀' },
  { key: 'calls', label: 'Calls and discussions', icon: '📞' },
  { key: 'other', label: 'Other tasks and tickets', icon: '🗂️' },
];

// which group a Lighthouse task belongs to, from its name
function groupOf(name) {
  const n = String(name || '').toLowerCase();
  if (/improvement class|bridge class|catch-?up|extra class|practice class|book/.test(n)) return 'classes';
  if (/onboard|diagnostic/.test(n)) return 'onboarding';
  if (/call|discussion|feedback/.test(n)) return 'calls';
  return 'other';
}

const istDay = (iso) => (iso ? new Date(new Date(iso).getTime() + 5.5 * 3600000).toISOString().slice(0, 10) : '');
const daysPast = (due, today) => (due && due < today ? Math.round((Date.parse(today) - Date.parse(due)) / 86400000) : 0);
const tidy = (v) => String(v || '').replace(/^Learning Process\s*[—-]\s*/i, '').trim();

async function openTasks(id) {
  const lists = await Promise.all(
    ['pastDue', 'today', 'upcoming'].map((type) => get(`tasks?pageSize=100&page=1&filter[studentId][0]=${Number(id)}&filter[viewType]=all&filter[taskType]=${type}&sort[createdAt]=desc`))
  );
  const seen = new Set();
  return lists.flatMap((j) => (j && j.docs) || []).filter((t) => t.id && !seen.has(t.id) && seen.add(t.id) && !['completed', 'closed', 'cancelled'].includes(t.status));
}
async function openConcerns(id) {
  const lists = await Promise.all(['pastDue', 'dueToday', 'upcoming'].map((type) => get(`ai-agent-logs/concerns-kanban?page=1&pageSize=50&studentIds=${Number(id)}&taskType=${type}`)));
  const seen = new Set();
  return lists
    .flatMap((j) => ((j && j.data && j.data.items) || []).filter((s) => Number(s.studentId) === Number(id)).flatMap((s) => s.tasks || []))
    .filter((c) => !seen.has(c.taskEventId || c.feedbackId) && seen.add(c.taskEventId || c.feedbackId));
}

const cache = new Map();
// local: { negfb:[{title,meta,link}], nc15:[...], booking:[...] } taken from the hub's own lists
async function pendingFor(id, today, local = {}) {
  const hit = cache.get(Number(id));
  let live = hit && Date.now() - hit.at < 60000 ? hit.live : null;
  if (!live) {
    const [tasks, concerns] = await Promise.allSettled([openTasks(id), openConcerns(id)]);
    live = {
      tasks: tasks.status === 'fulfilled' ? tasks.value : null,
      concerns: concerns.status === 'fulfilled' ? concerns.value : null,
    };
    if (live.tasks && live.concerns) cache.set(Number(id), { at: Date.now(), live });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
  }
  const crm = `${CRM}/students/view/${Number(id)}`;
  const items = Object.fromEntries(GROUPS.map((g) => [g.key, []]));
  for (const c of live.concerns || [])
    items.concerns.push({
      title: [c.category, c.subcategory].filter(Boolean).join(' · ') || c.feedbackType || 'Concern',
      meta: [c.feedbackType, c.priority && c.priority + ' priority', c.assignedOwner || c.owner ? 'with ' + (c.assignedOwner || c.owner) : '', c.ageDays != null ? c.ageDays + ' days old' : ''].filter(Boolean).join(' · '),
      late: Boolean(c.tatBreached),
      lateText: c.tatBreached ? 'TAT breached' : '',
      link: `${crm}?activeTab=concernsAndRequests&focusFeedback=${encodeURIComponent(c.feedbackId || '')}`,
    });
  for (const t of live.tasks || []) {
    const due = istDay(t.dueDate);
    const past = daysPast(due, today);
    items[groupOf(t.name)].push({
      title: tidy(t.name),
      meta: [t.priority && t.priority + ' priority', due ? 'due ' + new Date(due + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''].filter(Boolean).join(' · '),
      due,
      late: past > 0,
      lateText: past ? past + (past === 1 ? ' day past' : ' days past') : due === today ? 'due today' : '',
      link: `${CRM}/task/student/${Number(id)}?taskId=${encodeURIComponent(t.id)}`,
    });
  }
  for (const key of ['negfb', 'nc15']) for (const x of local[key] || []) items[key].push(x);
  for (const x of local.booking || []) items.classes.push(x);
  for (const k of Object.keys(items)) items[k].sort((a, b) => Number(b.late) - Number(a.late) || String(a.due || '9').localeCompare(String(b.due || '9')));
  return {
    groups: GROUPS.map((g) => ({ ...g, items: items[g.key] })),
    error: !live.tasks || !live.concerns ? 'Lighthouse did not answer for part of this. Open the CRM page for the full picture.' : '',
  };
}

module.exports = { pendingFor, groupOf, GROUPS };
