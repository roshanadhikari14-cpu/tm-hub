// Daily offline copy of the TM Hub on this laptop: one folder per day with Excel-friendly CSV files, a searchable
// page that opens without internet, and the raw data. Run by the Windows task "Lighthouse daily backup".
// Usage: node backup.js [hub address]   (default: the live site). The key is read from ../vantage/.key.
const fs = require('fs');
const path = require('path');

const HUB = process.argv[2] || 'https://tm-task-mailer.vercel.app';
const ROOT = process.env.BACKUP_DIR || 'C:/Users/MY PC/Lighthouse/Backups';
const KEEP_DAYS = 60;

const log = (line) => {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.appendFileSync(path.join(ROOT, 'backup-log.txt'), `${new Date().toLocaleString('en-GB')}  ${line}\n`);
  console.log(line);
};
const ist = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const text = (v) => (v == null ? '' : Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v));

function sheets(d) {
  const phone = (id) => {
    const p = d.parents && d.parents[id];
    const list = (p && (p.g || p)) || [];
    return Array.isArray(list) ? list.map((x) => `${x.name || ''} (${x.relation || ''}) ${x.phone || ''}`.trim()).join(' | ') : '';
  };
  const labels = Object.fromEntries((d.tasks || []).map((t) => [t.key, t]));
  const tasks = [];
  for (const row of (d.board && d.board.rows) || [])
    for (const [key, t] of Object.entries(row.tasks || {}))
      for (const it of t.items || []) tasks.push([row.name, (labels[key] || {}).label || key, (it.cells || []).join(' | '), it.link || '']);
  return [
    ['students', 'Students', ['TM', 'Student ID', 'Student', 'Class', 'School', 'Batch', 'Parents and phones', 'Green %', 'Process %', 'Last contact', 'Renewal'],
      (d.students || []).map((s) => [s.tm, s.id, s.name, s.grade, s.school, s.batch, phone(s.id), s.greenPct, s.processPct, ist(s.lastContact), text(s.renewal)])],
    ['tasks', 'Pending tasks', ['TM', 'Task', 'Details', 'Link'], tasks],
    ['ptms', 'PTMs', ['Date', 'Time', 'TM', 'Student ID', 'Student', 'Status', 'Parent minutes', 'Agenda', 'Remark'],
      (d.ptms || []).map((m) => [m.date, ist(m.start), m.host, m.studentId, m.student, m.status, m.parentMinutes, m.agenda, m.remark ? m.remark.text : ''])],
    ['renewals', 'Renewals', ['Student ID', 'Student', 'School', 'Class', 'TM', 'Office', 'Sales status', 'Academic status', 'Renewal', 'Attendance %', 'Remarks'],
      ((d.renewals && d.renewals.rows) || []).map((r) => [r.id, r.name, r.school, r.grade, r.tm, r.office, r.status, r.atStatus, r.rtype, r.att, r.remarks])],
    ['tutors', 'Tutors', ['Tutor ID', 'Tutor', 'Mobile', 'Mail', 'Type', 'Subject', 'Class', 'Other classes', 'City', 'Language', 'Joined', 'Tutor manager', 'Sr tutor manager', 'Leaving status', 'Last working day'],
      ((d.tutors && d.tutors.rows) || []).map((t) => [t.id, t.name, t.mobile, t.email, t.type, t.subject, t.grade, t.grades2, t.city, t.lang, t.joined, t.tm, t.stm, t.leaving, t.lwdRec || t.lwd])],
    ['assigned-tasks', 'Assigned tasks', ['Task', 'Details', 'Assigned to', 'Assigned by', 'Assigned on', 'Due', 'Status', 'Completed on', 'Remarks'],
      (d.teamTasks || []).map((t) => [t.title, t.details, t.assignee, t.createdBy, ist(t.assignedAt), t.due, t.status, ist(t.doneAt), t.comment])],
    ['tutor-leaves', 'Tutor leaves', ['Tutor', 'Tutor manager', 'Type', 'From', 'To', 'Remarks'], (d.leaves || []).map((l) => [l.name, l.tm, l.type, l.from, l.to, l.remarks])],
  ];
}

// quoted, and never read by Excel as a formula
const csvCell = (v) => {
  let s = text(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
const csv = (head, rows) => '\uFEFF' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

function page(d, list) {
  const data = JSON.stringify(list.map(([id, title, head, rows]) => ({ id, title, head, rows: rows.map((r) => r.map(text)) }))).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lighthouse backup ${d.date}</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;margin:20px;color:#14202b;background:#f6f7f9}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 12px;color:#5b6773;font-size:13px}
button{border:1px solid #cfd6de;background:#fff;border-radius:8px;padding:7px 12px;margin:0 6px 6px 0;cursor:pointer}button.on{background:#2b2f8f;color:#fff;border-color:#2b2f8f}
input{padding:8px 12px;border:1px solid #cfd6de;border-radius:8px;width:320px;max-width:100%;margin:4px 0 12px}.wrap{overflow:auto;max-height:75vh;background:#fff;border:1px solid #e1e6ec;border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:12.5px}th,td{padding:7px 10px;border-bottom:1px solid #eef1f4;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#f1f4f8}</style></head>
<body><h1>Lighthouse backup · ${d.date}</h1><p>Saved ${ist(d.at)} from the hub. Lighthouse data of ${ist(d.dataAt) || 'unknown time'}. Works without internet.${d.errors && d.errors.length ? ' <b style="color:#b83223">Some parts could not be read: ' + d.errors.join('; ').replace(/[<>&]/g, '') + '</b>' : ''}</p>
<div id="tabs"></div><input id="q" placeholder="Search this list…"><div id="count" style="font-size:12px;color:#5b6773;margin-bottom:6px"></div><div class="wrap"><table id="t"></table></div>
<script>const S=${data};let cur=0;const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cell=v=>/^https:\\/\\//.test(v)?'<a href="'+esc(v)+'" target="_blank" rel="noopener">open</a>':esc(v);
function draw(){const s=S[cur];const q=document.getElementById('q').value.trim().toLowerCase();const rows=s.rows.filter(r=>!q||r.join(' ').toLowerCase().includes(q));
document.getElementById('count').textContent=rows.length+' of '+s.rows.length+(rows.length>800?' (first 800 shown, search to narrow)':'');
document.getElementById('t').innerHTML='<thead><tr>'+s.head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(0,800).map(r=>'<tr>'+r.map(v=>'<td>'+cell(v)+'</td>').join('')+'</tr>').join('')+'</tbody>';
document.querySelectorAll('#tabs button').forEach((b,i)=>b.classList.toggle('on',i===cur));}
document.getElementById('tabs').innerHTML=S.map((s,i)=>'<button data-i="'+i+'">'+esc(s.title)+' ('+s.rows.length+')</button>').join('');
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{cur=+b.dataset.i;draw()});document.getElementById('q').oninput=draw;draw();</script></body></html>`;
}

(async () => {
  const key = fs.readFileSync(path.join(__dirname, '..', 'vantage', '.key'), 'utf8').trim();
  let res;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(HUB + '/api/cron/backup', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key }), signal: AbortSignal.timeout(90000) });
      if (res.ok) break;
      throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 150));
    } catch (e) {
      res = null;
      log(`attempt ${attempt} failed: ${e.message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 60000));
    }
  }
  if (!res) {
    log('NOT SAVED today. Earlier folders are untouched.');
    process.exit(1);
  }
  const d = await res.json();
  if (!d.students || !d.students.length) {
    log('NOT SAVED: the hub returned no students (' + (d.errors || []).join('; ') + ')');
    process.exit(1);
  }
  const dir = path.join(ROOT, d.date);
  fs.mkdirSync(dir, { recursive: true });
  const list = sheets(d);
  for (const [id, , head, rows] of list) fs.writeFileSync(path.join(dir, id + '.csv'), csv(head, rows));
  fs.writeFileSync(path.join(dir, 'Open backup.html'), page(d, list));
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(d));
  // keep the last KEEP_DAYS days
  const days = fs.readdirSync(ROOT).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
  for (const old of days.slice(0, Math.max(0, days.length - KEEP_DAYS))) fs.rmSync(path.join(ROOT, old), { recursive: true, force: true });
  log(`saved ${d.date}: ${list.map(([id, , , rows]) => `${rows.length} ${id}`).join(', ')}${d.errors.length ? ' | problems: ' + d.errors.join('; ') : ''}${d.recovery ? ' | old PTM remarks: ' + d.recovery.state + (d.recovery.added != null ? ' (' + d.recovery.added + ' brought back)' : '') : ''}`);
})().catch((e) => {
  log('FAILED: ' + e.message);
  process.exit(1);
});
