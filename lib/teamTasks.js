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

function create({ title, details, assignee, assigneeEmail, due, by, byEmail }, today) {
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
    status: 'open',
    doneAt: null,
    doneBy: '',
    comment: '',
    mail: '',
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
const reopen = (id) => update(id, (t) => Object.assign(t, { status: 'open', doneAt: null, doneBy: '' }));
function remove(id) {
  const tasks = load();
  const left = tasks.filter((x) => x.id !== id);
  if (left.length !== tasks.length) save(left);
  return left.length !== tasks.length;
}

module.exports = { load, create, update, complete, reopen, remove };
