// Runs inside the signed-in Vantage "Tutor Master Dashboard" (https://vantage.uprio.com/tutor-portal).
// The page's own Export link returns every active tutor as CSV; this reads it and pushes the rows to the TM Hub
// Tutor Management tab with the private key. The key placeholder below is filled in by the scheduled task from tools/vantage/.key (never committed).
(async () => {
  const HUB = 'https://tm-task-mailer.vercel.app/api/cron/tutors-push';
  const KEY = '__KEY__';
  if (!/\/tutor-portal/.test(location.pathname)) return 'ERROR: open https://vantage.uprio.com/tutor-portal first';
  const link = [...document.querySelectorAll('a')].find((a) => /\/datasets\/tutor-portal\/export/.test(a.getAttribute('href') || ''));
  const res = await fetch(link ? link.getAttribute('href') : '/datasets/tutor-portal/export?status=active', { credentials: 'same-origin' });
  if (!res.ok) return 'ERROR: export returned ' + res.status + ' (signed out?)';
  const text = (await res.text()).replace(/^﻿/, '');
  const out = [];
  let r = [], c = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { r.push(c); c = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; r.push(c); c = ''; if (r.length > 1 || r[0]) out.push(r); r = []; }
    else c += ch;
  }
  if (c || r.length) { r.push(c); out.push(r); }
  const H = out[0] || [];
  if (H.indexOf('Tutor ID') < 0 || H.indexOf('Tutor Name') < 0) return 'ERROR: the export columns were not recognised';
  const col = (row, n) => String(row[H.indexOf(n)] == null ? '' : row[H.indexOf(n)]).replace(/\s+/g, ' ').trim();
  const rows = out.slice(1).map((x) => ({
    id: col(x, 'Tutor ID'), name: col(x, 'Tutor Name'), mobile: col(x, 'Mobile Number'), email: col(x, 'Tutor Mail ID'), status: col(x, 'Status'), type: col(x, 'tutor_type'),
    subject: col(x, 'Subject'), grade: col(x, 'Primary Grade'), grades2: col(x, 'Secondary Grades'), lang: col(x, 'Language'), city: col(x, 'City'),
    joined: col(x, 'Date of Joining'), handover: col(x, 'Date of Handover'), lwd: col(x, 'Last Working Day'), resigned: col(x, 'Resignation Recorded'), lwdRec: col(x, 'Last Working Day (recorded)'),
    notice: col(x, 'Notice Served'), rtype: col(x, 'Resignation Type'), rnote: col(x, 'Resignation Note'), filledBy: col(x, 'Form Filled By'), filledOn: col(x, 'Filled On'),
    daysLeft: col(x, 'Days To Last Day'), leaving: col(x, 'Leaving Status'), tm: col(x, 'Tutor Manager'), tmId: col(x, 'Tutor Manager ID'), tmEmail: col(x, 'Tutor Manager Email'), stm: col(x, 'Sr Tutor Manager'),
  })).filter((x) => x.id && x.name);
  if (rows.length < 100) return 'ERROR: only ' + rows.length + ' tutors were read';
  await fetch(HUB, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key: KEY, source: 'Vantage · Tutor Master Dashboard', rows }) });
  return 'SENT ' + rows.length + ' tutors';
})();
