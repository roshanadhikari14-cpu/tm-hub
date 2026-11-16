// Where saved data lives. On Vercel only /tmp is writable; lib/persist.js
// copies it to and from the cloud database around each request.
const path = require('path');

const CLOUD = Boolean(process.env.VERCEL);
const DATA = CLOUD ? '/tmp/tm-hub-data' : path.join(__dirname, '..', 'data');

module.exports = { DATA, CLOUD };
