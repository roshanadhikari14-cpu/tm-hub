const test = require('node:test');
const assert = require('node:assert');
const { maskPhone, maskList } = require('../lib/parents');

// made-up numbers
test('only the first and last 3 digits are left', () => {
  assert.equal(maskPhone('9000012345'), '900••••345');
});
test('the country code and spacing do not take up the visible digits', () => {
  assert.equal(maskPhone('+91 90000 12345'), '900••••345');
  assert.equal(maskPhone('919000012345'), '900••••345');
});
test('a short or unusual number is hidden completely, an empty one stays empty', () => {
  assert.equal(maskPhone('12345'), '•••••');
  assert.equal(maskPhone(''), '');
});
test('only the number changes, and the original list is left alone', () => {
  const list = [{ name: 'A', relation: 'Mother', phone: '9000012345', email: 'a@x.com', primary: true }];
  assert.deepStrictEqual(maskList(list), [{ name: 'A', relation: 'Mother', phone: '900••••345', email: 'a@x.com', primary: true }]);
  assert.equal(list[0].phone, '9000012345');
});
