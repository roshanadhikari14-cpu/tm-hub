// Tasks the senior TM or a TM assigns to someone in the team (Task tracker tab). Kept in the hub only.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA } = require('./paths');

const FILE = path.join(DATA, 'team-tasks.json');
function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8')).tasks || [];
  } catch {
    return [];
  }
}
function save(tasks) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ tasks }));
}

const clean = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n);

const timeOf = (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v || '') ? v : '');
// the students a task is about, kept as a small snapshot
const studentsOf = (list) => (Array.isArray(list) ? list : []).slice(0, 10).map((s) => ({ id: Number(s.id), name: clean(s.name, 120), grade: clean(s.grade, 10), school: clean(s.school, 160), tm: clean(s.tm, 60) })).filter((s) => s.id && s.name);
const PRIORITIES = ['High', 'Medium', 'Low'];
const priorityOf = (p) => (PRIORITIES.includes(p) ? p : 'Medium');
function create({ title, details, assignee, assigneeEmail, due, dueTime, priority, by, byEmail, auto, students }, today) {
  const t = clean(title, 200);
  if (t.length < 3) throw new Error('Write what needs to be done.');
  if (!assignee) throw new Error('Choose who the task is for.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due || '')) throw new Error('Pick the due date.');
  if (due < today) throw new Error('The due date cannot be in the past.');
  const task = {
    id: crypto.randomBytes(9).toString('hex'),
    title: t,
    details: clean(details, 2000),
    assignee,
    assigneeEmail: assigneeEmail || '',
    createdBy: by,
    createdByEmail: byEmail || '',
    assignedAt: new Date().toISOString(),
    due,
    dueTime: timeOf(dueTime),
    students: studentsOf(students),
    priority: priorityOf(priority),
    remarks: [],
    status: 'open',
    doneAt: null,
    doneBy: '',
    comment: '',
    mail: '',
    auto: auto || null,
  };
  save([task, ...load()]);
  return task;
}
// change one task and save; returns it, or null when it is not there
function update(id, change) {
  const tasks = load();
  const t = tasks.find((x) => x.id === id);
  if (!t) return null;
  change(t);
  save(tasks);
  return t;
}
function complete(id, comment, by) {
  const c = clean(comment, 2000);
  if (c.length < 3) throw new Error('Write a remark about what was done.');
  return update(id, (t) => Object.assign(t, { status: 'done', doneAt: new Date().toISOString(), doneBy: by, comment: c }));
}
// a note on the task, at any time
function remark(id, text, by) {
  const c = clean(text, 1000);
  if (c.length < 2) throw new Error('Write the remark first.');
  return update(id, (t) => (t.remarks = [...(t.remarks || []), { text: c, by, at: new Date().toISOString() }]));
}
function edit(id, { title, details, due, dueTime, priority }) {
  const name = clean(title, 200);
  if (name.length < 3) throw new Error('Write what needs to be done.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due || '')) throw new Error('Pick the due date.');
  return update(id, (t) => Object.assign(t, { title: name, details: clean(details, 2000), due, dueTime: dueTime === undefined ? t.dueTime || '' : timeOf(dueTime), priority: priorityOf(priority) }));
}
const reopen = (id) => update(id, (t) => Object.assign(t, { status: 'open', doneAt: null, doneBy: '' }));
function remove(id) {
  const tasks = load();
  const left = tasks.filter((x) => x.id !== id);
  if (left.length !== tasks.length) save(left);
  return left.length !== tasks.length;
}

module.exports = { load, create, update, complete, remark, edit, reopen, remove };
