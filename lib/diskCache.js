// Answers that take a few seconds to build from Lighthouse (PTM lists, tutor leaves) are also kept as files, which are
// synced to the database. A freshly started server then answers at once from the last copy and refreshes behind it.
const fs = require('fs');
const path = require('path');
const { DATA } = require('./paths');

const file = (name) => path.join(DATA, 'cache', name + '.json');

function get(name) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch {
    return null;
  }
}
// written only when the content changed or the copy is 15 minutes old, so the database is not rewritten on every read
function put(name, data) {
  const old = get(name);
  const same = (d) => JSON.stringify(d && !Array.isArray(d) ? { ...d, at: undefined } : d); // ignore the read time
  // within 15 minutes an unchanged list is left alone; a changed one is saved at most every 5 minutes
  if (old && Date.now() - old.at < (same(old.data) === same(data) ? 15 : 5) * 60 * 1000) return;
  fs.mkdirSync(path.dirname(file(name)), { recursive: true });
  fs.writeFileSync(file(name), JSON.stringify({ at: Date.now(), data }));
}

module.exports = { get, put };
