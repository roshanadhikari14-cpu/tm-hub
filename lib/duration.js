// Minutes as people read them: "44 min" up to 59, then "1 hr 14 mins". `unit` is what follows a short value.
// public/app.js carries the same function for the pages.
function dur(minutes, unit = ' min') {
  const n = Math.round(Number(minutes) || 0);
  if (n < 60) return n + unit;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h + (h === 1 ? ' hr' : ' hrs') + (m ? ' ' + m + (m === 1 ? ' min' : ' mins') : '');
}
module.exports = { dur };
