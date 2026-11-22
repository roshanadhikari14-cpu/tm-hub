// Runs inside the signed-in Vantage "Renewal Discussion" page (see README.md here).
// Reads every student from the table (100 per page), then pushes the rows to the TM Hub with a private key.
// __KEY__ is replaced by the scheduled task from tools/vantage/.key (never committed).
(async () => {
  const HUB = 'https://tm-task-mailer.vercel.app/api/cron/renewals-push';
  const KEY = '__KEY__';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tbl = () => [...document.querySelectorAll('table')].sort((a, b) => b.querySelectorAll('tr').length - a.querySelectorAll('tr').length)[0];
  const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => /per page/.test(o.text)));
  if (!sel || !tbl()) return 'ERROR: the Renewal Discussion table was not found (signed out?)';
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, '100');
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(2500);
  const val = (c) => {
    const s = c.querySelector('select');
    if (s) return (s.options[s.selectedIndex] || {}).text || '';
    const i = c.querySelector('input,textarea');
    return i ? i.value : c.innerText.replace(/\s+/g, ' ').trim();
  };
  const grab = () => {
    const tb = tbl();
    const leaves = [...tb.querySelectorAll('thead th')].map((h) => h.innerText.replace(/\s+/g, ' ').replace(/[⇅+−]/g, '').trim()).slice(14);
    return [...tb.querySelectorAll('tbody tr')].map((r) => {
      const o = {};
      [...r.children].forEach((c, i) => (o[leaves[i] || 'c' + i] = val(c)));
      return o;
    });
  };
  const all = [];
  const seen = new Set();
  for (let guard = 0; guard < 12; guard++) {
    let added = 0;
    for (const r of grab()) {
      if (!seen.has(r['Student ID'])) {
        seen.add(r['Student ID']);
        all.push(r);
        added++;
      }
    }
    const nb = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Next page');
    if (!nb || nb.disabled || !added) break;
    nb.click();
    await sleep(1800);
  }
  const c = (s) => {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s === '—' ? '' : s;
  };
  const rows = all.map((r) => ({
    id: c(r['Student ID']), name: c(r['Student Name']), school: c(r['School']), grade: c(r['Grade']), batch: c(r['Batch']), tm: c(r['TM']), stm: c(r['STM']),
    office: c(r['Office']), city: c(r['City']), sam: c(r['SAM']), status: c(r['Student Status']), atStatus: c(r['Status']), pulse: c(r['AT Pulse']),
    remarks: c(r['Remarks']), poc: c(r['Next Steps POC']), issues: c(r['Identified Issues']), health: c(r['Student Health']), product: c(r['Product Type']),
    lastPaid: c(r['Last Paid Month']), sub: c(r['Subscription Category']), att: c(r['Regular attendance %']), band: c(r['Attendance band']),
    calls: c(r['TM calls over 4 min']), due: c(r['Renewal Due']), lastPay: c(r['Last Payment']), amount: c(r['Last Payment Amount']), rtype: c(r['Renewal Type']),
    tmChanges: c(r['TM changes']), tmWho: c(r['Who and when']),
  }));
  if (rows.length < 50) return 'ERROR: only ' + rows.length + ' rows were read';
  const m = document.body.innerText.match(/Renewal Cycle\s*\n?\s*([A-Za-z]+ \d{4})/i);
  await fetch(HUB, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key: KEY, source: 'Vantage · Renewal Discussion' + (m ? ' · ' + m[1] : ''), rows }) });
  return 'SENT ' + rows.length + ' rows';
})();
