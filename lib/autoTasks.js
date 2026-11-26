// Predefined tasks taken from the live Lighthouse lists ("clear your pending approvals"). The task remembers which
// items were pending when it was given, and counts as done once Lighthouse no longer shows any of them.
const CATEGORIES = [
  { key: 'onboarding', label: 'Onboarding', sources: ['Onboarding'] },
  { key: 'approvals', label: 'Pending approvals', sources: ['Pending approvals'] },
  { key: 'negfb', label: 'Negative feedback', sources: ['Negative feedback'] },
  { key: 'concerns', label: 'Concerns and requests', sources: ['Concerns'] },
  { key: 'nc15', label: 'NC-15 parent connect', sources: ['NC-15'] },
  { key: 'ic2', label: 'IC2 booking', sources: ['IC2 to-book'] },
  { key: 'eval', label: 'Eval booking', sources: ['Eval to-book'] },
  { key: 'chapters', label: 'Chapter planning missing', sources: ['Missing chapters', 'Chapter owners'] },
];
const byKey = (key) => CATEGORIES.find((c) => c.key === key);

// If Lighthouse did not answer for a list, it looks empty; nothing may be marked done from it
const unreliable = (key, errors) => (errors || []).some((e) => byKey(key).sources.some((s) => String(e).startsWith(s)));

const itemsOf = (row, key) => ((row && row.tasks && row.tasks[key] && row.tasks[key].items) || []);

function snapshot(row, key) {
  const seen = new Set();
  return itemsOf(row, key)
    .filter((x) => x.id != null && !seen.has(String(x.id)) && seen.add(String(x.id)))
    .map((x) => ({
      id: String(x.id),
      name: String((x.cells || [])[0] || 'Item'),
      note: (x.cells || []).slice(1).filter((c) => c !== '' && c != null).join(' · ').slice(0, 160),
      link: x.taskLink || x.link || '',
    }));
}

// Which of the remembered items are still pending now: null when it cannot be told safely
function stillPending(task, row, data) {
  if (!row || !data || !data.fetchedAt) return null;
  if (unreliable(task.auto.key, data.errors)) return null;
  // only Lighthouse data read after the task was given counts
  if (new Date(data.fetchedAt) <= new Date(task.assignedAt)) return null;
  const now = new Set(itemsOf(row, task.auto.key).map((x) => String(x.id)));
  return task.auto.items.filter((x) => now.has(x.id)).map((x) => x.id);
}

module.exports = { CATEGORIES, byKey, unreliable, snapshot, stillPending };
