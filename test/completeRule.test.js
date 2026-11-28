const test = require('node:test');
const assert = require('node:assert');
const { mayComplete } = require('../lib/teamTasks');

const auto = { auto: { key: 'approvals', items: [] }, assignee: 'Preety Gour', createdByEmail: 'owner@x' };
const own = { auto: null, assignee: 'Preety Gour', createdByEmail: 'owner@x' };
const tm = { role: 'tm', name: 'Preety Gour', email: 'preety@x' };
const other = { role: 'tm', name: 'Nida Afreen', email: 'nida@x' };
const owner = { role: 'owner', name: 'Roshan Adhikari', email: 'owner@x' };

test('a TM cannot complete a predefined Lighthouse task, even one they made themselves', () => {
  assert.equal(mayComplete(auto, tm), false);
  assert.equal(mayComplete({ ...auto, createdByEmail: 'preety@x' }, tm), false);
});
test('the owner still can', () => {
  assert.equal(mayComplete(auto, owner), true);
});
test('other tasks: the assignee, the creator and the owner can; nobody else', () => {
  assert.equal(mayComplete(own, tm), true);
  assert.equal(mayComplete({ ...own, createdByEmail: 'nida@x' }, other), true);
  assert.equal(mayComplete(own, owner), true);
  assert.equal(mayComplete(own, other), false);
});
