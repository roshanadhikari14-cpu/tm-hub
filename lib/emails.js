// Email HTML: one mail per TM per slot, plus one team board mail (TMs in CC).
// Inline styles and tables only, so Gmail/Outlook render them faithfully.
const { TASKS, fmtDay } = require('./model');

const TEAL = '#0d5c63';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SLOT = {
  morning: { title: "Today's Task Targets", tag: '11 AM', subject: "Today's Task Targets" },
  progress: { title: 'Progress Update', tag: '5 PM', subject: 'Progress Update (5 PM)' },
  closure: { title: 'Task Closure', tag: '8 PM', subject: 'Task Closure (8 PM)' },
};

const PILL = {
  clear: ['#e7f6ee', '#17734a', 'All clear'],
  ok: ['#e6f2f3', TEAL, 'On track'],
  watch: ['#fff4dc', '#9a6200', 'Watch'],
  critical: ['#fde8e8', '#b42318', 'Needs attention'],
};
const CLOSURE_PILL = {
  clear: ['#e7f6ee', '#17734a', '✓ Achieved'],
  ok: ['#e7f6ee', '#17734a', '✓ Achieved'],
  watch: ['#fff4dc', '#9a6200', '~ Close'],
  critical: ['#fde8e8', '#b42318', '✕ Missed'],
};
const pill = (status, slot) => {
  const [bg, fg, label] = (slot === 'closure' ? CLOSURE_PILL : PILL)[status] || PILL.ok;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${bg};color:${fg};font-size:12px;font-weight:600;white-space:nowrap">${label}</span>`;
};
const bar = (p) => {
  const v = Math.max(0, Math.min(100, p || 0));
  const c = v >= 100 ? '#17734a' : v >= 60 ? TEAL : v >= 30 ? '#c98a00' : '#b42318';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:110px;border-collapse:collapse"><tr><td style="background:#e5ecec;border-radius:4px;height:8px;padding:0"><div style="width:${v}%;background:${c};height:8px;border-radius:4px"></div></td><td style="padding-left:8px;font-size:12px;color:#334;white-space:nowrap">${v}%</td></tr></table>`;
};

const th = (t, align = 'left') => `<th bgcolor="${TEAL}" align="${align}" style="background-color:${TEAL};color:#fff;font-size:12px;font-weight:600;text-align:${align};padding:9px 10px;border:1px solid ${TEAL}"><font color="#ffffff">${esc(t)}</font></th>`;
const td = (v, opts = {}) =>
  `<td${opts.bg ? ` bgcolor="${opts.bg}"` : ''} align="${opts.align || 'left'}" style="padding:8px 10px;border:1px solid #dfe7e7;font-size:13px;color:#1d2b2c;text-align:${opts.align || 'left'};${opts.bold ? 'font-weight:600;' : ''}${opts.bg ? `background-color:${opts.bg};` : ''}">${opts.raw ? v : esc(v)}</td>`;
const table = (head, rows) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="1" bordercolor="#dfe7e7" style="border-collapse:collapse;width:100%;margin:6px 0 18px">${head}${rows}</table>`;

function shell({ title, tag, date, who, body, sender }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f2f6f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f2f6f6" style="background-color:#f2f6f6;padding:20px 0"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:760px;background-color:#fff;border-radius:12px;overflow:hidden;font-family:Segoe UI,Helvetica,Arial,sans-serif">
<tr><td bgcolor="${TEAL}" style="background-color:${TEAL};padding:22px 26px;color:#fff"><font color="#ffffff">
<div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.8">${esc(tag)} · ${esc(date)}</div>
<div style="font-size:22px;font-weight:700;margin-top:4px">${esc(title)}</div>
${who ? `<div style="font-size:14px;margin-top:2px;opacity:.9">${esc(who)}</div>` : ''}
</font></td></tr>
<tr><td style="padding:22px 26px 8px;color:#1d2b2c;font-size:14px;line-height:1.55">${body}
<p style="margin:26px 0 4px">Regards,<br><b>${esc(sender.name)}</b><br><span style="color:#5b6b6c">${esc(sender.title)}</span></p>
</td></tr>
<tr><td style="padding:12px 26px 20px;color:#8a9899;font-size:11px">Data from Lighthouse at ${esc(sender.dataAt)}. Sent by the TM Hub.</td></tr>
</table></td></tr></table></body></html>`;
}

function sectionTitle(t, sub) {
  return `<div style="margin:22px 0 4px;font-size:15px;font-weight:700;color:${TEAL}">${t}${sub ? ` <span style="font-weight:400;color:#6b7b7c;font-size:12px">${esc(sub)}</span>` : ''}</div>`;
}

function alertBox(row, slot) {
  const crit = TASKS.filter((t) => row.tasks[t.key].status === 'critical');
  if (!crit.length) return '';
  const lines = crit
    .map((t) => {
      const s = row.tasks[t.key];
      const why =
        t.kind === 'talk'
          ? slot === 'morning'
            ? `only ${s.yesterday} min yesterday (target ${s.target})`
            : `${s.minutes} of ${s.target} min so far`
          : t.kind === 'booking'
            ? `${s.done} of ${s.target} booked`
            : s.flagged
              ? `${s.flagged} overdue / ageing item${s.flagged > 1 ? 's' : ''}`
              : `${s.pending} still open`;
      return `<li style="margin:2px 0"><b>${t.icon} ${esc(t.label)}</b>: ${esc(why)}</li>`;
    })
    .join('');
  return `<div style="background:#fdf1f0;border-left:4px solid #b42318;border-radius:6px;padding:12px 16px;margin:14px 0"><div style="font-weight:700;color:#b42318;margin-bottom:4px">Priority today</div><ul style="margin:0;padding-left:18px">${lines}</ul></div>`;
}

// One or two lines shown under a task row that needs attention.
function noteRow(s, cols) {
  if (s.status !== 'critical' || !s.hints.length) return '';
  return `<tr><td colspan="${cols}" bgcolor="#fff6f5" style="padding:7px 10px 9px 34px;border:1px solid #dfe7e7;border-top:0;background-color:#fff6f5;font-size:12.5px;color:#8a2a1c;line-height:1.5">${s.hints.slice(0, 2).map(esc).join(' ')}</td></tr>`;
}

function summaryTable(row, slot) {
  const R = row.tasks;
  if (slot === 'morning') {
    const head = `<tr>${th('Task')}${th('Pending', 'center')}${th("Today's target", 'center')}${th('Status', 'center')}</tr>`;
    const rows = TASKS.map((t) => {
      const s = R[t.key];
      const pend = t.kind === 'talk' ? `${s.yesterday} min yesterday` : String(t.kind === 'booking' ? s.morning : s.pending);
      const tgt = t.kind === 'talk' ? `${s.target} min` : t.kind === 'booking' ? `Book ${s.target}` : s.pending ? `Close all ${s.pending}` : '—';
      const bg = s.status === 'critical' ? '#fff6f5' : '';
      return `<tr>${td(`${t.icon} ${t.label}`, { bold: true, bg })}${td(pend, { align: 'center', bg })}${td(tgt, { align: 'center', bg })}${td(pill(s.status, slot), { raw: true, align: 'center', bg })}</tr>${noteRow(s, 4)}`;
    }).join('');
    return table(head, rows);
  }
  const head =
    slot === 'progress'
      ? `<tr>${th('Task')}${th('At 11 AM', 'center')}${th('Closed so far', 'center')}${th('Still open', 'center')}${th('Target', 'center')}${th('Progress')}${th('Status', 'center')}</tr>`
      : `<tr>${th('Task')}${th('At 11 AM', 'center')}${th('Closed', 'center')}${th('Target', 'center')}${th('Achieved')}${th('Result', 'center')}</tr>`;
  const rows = TASKS.map((t) => {
    const s = R[t.key];
    const p = s.target ? Math.round((100 * s.done) / s.target) : 100;
    const bg = s.status === 'critical' ? '#fff6f5' : '';
    const unit = t.kind === 'talk' ? ' min' : '';
    const cells = [
      td(`${t.icon} ${t.label}`, { bold: true, bg }),
      td(t.kind === 'talk' ? '—' : String(s.morning), { align: 'center', bg }),
      td(`${s.done}${unit}`, { align: 'center', bg }),
    ];
    if (slot === 'progress') cells.push(td(t.kind === 'talk' ? `${s.pending} min to go` : `${s.pending}${s.fresh ? ` (+${s.fresh} new)` : ''}`, { align: 'center', bg }));
    cells.push(td(`${s.target}${unit}`, { align: 'center', bg }), td(bar(p), { raw: true, bg }), td(pill(s.status, slot), { raw: true, align: 'center', bg }));
    return `<tr>${cells.join('')}</tr>${noteRow(s, cells.length)}`;
  }).join('');
  return table(head, rows);
}

// A short 2-3 line plan: overdue items first, then bookings, then talk time.
function actionPlan(row, slot) {
  const R = row.tasks;
  const lists = TASKS.filter((t) => t.kind === 'list' && R[t.key].pending);
  const name = (t, n) => `${n} ${t.short.toLowerCase()}`;
  const urgent = lists.filter((t) => R[t.key].flagged);
  const lines = [];
  const when = slot === 'morning' ? 'First' : slot === 'progress' ? 'Before 8 PM' : 'First thing tomorrow';
  if (urgent.length) lines.push(`<b>${when}:</b> clear the overdue / ageing items (${urgent.map((t) => name(t, R[t.key].flagged)).join(', ')}).`);
  const rest = lists.filter((t) => R[t.key].pending - R[t.key].flagged > 0);
  if (rest.length) lines.push(`<b>${urgent.length ? 'Then' : when}:</b> close the remaining ${rest.map((t) => name(t, R[t.key].pending - R[t.key].flagged)).join(', ')}.`);
  const book = TASKS.filter((t) => t.kind === 'booking' && R[t.key].target > R[t.key].done);
  const mid = slot === 'progress';
  const talkLeft = R.talk.target - (mid ? R.talk.minutes : 0);
  const bits = [];
  if (book.length) bits.push(`book ${book.map((t) => `${R[t.key].target - R[t.key].done}${mid ? ' more' : ''} ${t.key === 'ic2' ? 'IC2' : 'eval'}`).join(' and ')} (longest-waiting students first)`);
  if (talkLeft > 0) bits.push(mid ? `add ${talkLeft} min talk time` : `reach ${R.talk.target} min talk time`);
  if (bits.length) lines.push(`<b>${mid ? 'By 8 PM' : 'Through the day'}:</b> ${bits.join(', and ')}.`);
  if (!lines.length) return '';
  const list = lines.slice(0, 3).map((l) => `<li style="margin:4px 0">${l}</li>`).join('');
  return sectionTitle(slot === 'closure' ? '🎯 Action plan for tomorrow' : '🎯 Action plan') + `<ol style="margin:4px 0 0;padding-left:20px;font-size:13.5px">${list}</ol>`;
}

function detailTables(row, slot, limit = 25) {
  let html = '';
  for (const t of TASKS) {
    const s = row.tasks[t.key];
    if (t.kind === 'talk' || !s.items.length) continue;
    const head = `<tr>${th('#', 'center')}${t.cols.map((c) => th(c)).join('')}</tr>`;
    const rows = s.items
      .slice(0, limit)
      .map((it, i) => {
        const bg = it.flag ? '#fff1f0' : i % 2 ? '#f8fbfb' : '';
        return `<tr>${td(String(i + 1), { align: 'center', bg })}${it.cells.map((c, j) => td(c, { bg, bold: it.flag && j === it.cells.length - 1 })).join('')}</tr>`;
      })
      .join('');
    const more = s.items.length > limit ? `<div style="font-size:12px;color:#6b7b7c;margin:-12px 0 16px">+ ${s.items.length - limit} more in Lighthouse</div>` : '';
    const sub = slot === 'morning' ? `${s.items.length} pending` : `${s.items.length} still open`;
    html += sectionTitle(`${t.icon} ${esc(t.label)}`, `${sub}${s.flagged ? ` · ${s.flagged} flagged in red` : ''}`) + table(head, rows) + more;
  }
  return html ? sectionTitle(slot === 'closure' ? '📋 Carry forward to tomorrow' : '📋 Student / batch-wise list') + html : '';
}

function intro(row, slot) {
  const R = row.tasks;
  if (slot === 'morning') {
    const open = TASKS.filter((t) => t.kind !== 'talk').reduce((a, t) => a + (t.kind === 'booking' ? R[t.key].target : R[t.key].pending), 0);
    return `<p style="margin:0 0 8px">Hi ${esc(row.first)},</p><p style="margin:0">Here are today's targets. You have <b>${open}</b> items to close or book and a talk-time target of <b>${R.talk.target} min</b>. Items in <span style="color:#b42318;font-weight:600">red</span> are overdue or ageing, so please take them first.</p>`;
  }
  const done = TASKS.filter((t) => ['clear', 'ok'].includes(R[t.key].status)).length;
  if (slot === 'progress')
    return `<p style="margin:0 0 8px">Hi ${esc(row.first)},</p><p style="margin:0">Quick 5 PM check-in: <b>${done} of ${TASKS.length}</b> tasks are on track. You have three hours left. Focus on the rows marked “Needs attention”.</p>`;
  return `<p style="margin:0 0 8px">Hi ${esc(row.first)},</p><p style="margin:0">Here's how today closed: <b>${done} of ${TASKS.length}</b> targets achieved, ${R.talk.minutes} min talk time. ${done === TASKS.length ? 'Brilliant day, thank you!' : 'Anything still open is listed below and carries forward to tomorrow.'}</p>`;
}

function tmEmail(row, board, slot, sender) {
  const S = SLOT[slot];
  const date = fmtDay(`${board.date}T12:00:00+05:30`);
  const body = intro(row, slot) + alertBox(row, slot) + sectionTitle('📊 Summary') + summaryTable(row, slot) + actionPlan(row, slot) + detailTables(row, slot);
  const s = { ...sender, dataAt: new Date(board.fetchedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) };
  return {
    subject: `${S.subject} – ${date} | ${row.first}`,
    html: shell({ title: S.title, tag: S.tag, date, who: row.name, body, sender: s }),
  };
}

// One basic task-wise table for the whole team.
function teamEmail(board, slot, sender) {
  const S = SLOT[slot];
  const date = fmtDay(`${board.date}T12:00:00+05:30`);
  const rows = board.rows;
  const cell = (t, s) => {
    if (slot === 'morning') return t.kind === 'talk' ? `${s.yesterday}m <span style="color:#6b7b7c">/ ${s.target}m</span>` : t.kind === 'booking' ? `${s.morning} <span style="color:#6b7b7c">[book ${s.target}]</span>` : `${s.pending}`;
    return t.kind === 'talk' ? `${s.minutes}m <span style="color:#6b7b7c">/ ${s.target}m</span>` : `${s.done} <span style="color:#6b7b7c">/ ${s.target}</span>`;
  };
  const tone = (s) => (s.status === 'critical' ? '#fde8e8' : s.status === 'watch' ? '#fff7e6' : s.status === 'clear' ? '#eaf7f0' : '');
  const head = `<tr>${th('Task')}${rows.map((r) => th(r.first, 'center')).join('')}${th('Team', 'center')}</tr>`;
  const body = TASKS.map((t) => {
    const tot = rows.reduce(
      (a, r) => {
        const s = r.tasks[t.key];
        a.p += slot === 'morning' ? (t.kind === 'booking' ? s.morning : t.kind === 'talk' ? s.yesterday : s.pending) : s.done;
        a.t += s.target;
        return a;
      },
      { p: 0, t: 0 }
    );
    const total = slot === 'morning' && t.kind === 'list' ? String(tot.p) : `${tot.p}${t.kind === 'talk' ? 'm' : ''} / ${tot.t}${t.kind === 'talk' ? 'm' : ''}`;
    return `<tr>${td(`${t.icon} ${t.label}`, { bold: true })}${rows.map((r) => td(cell(t, r.tasks[t.key]), { raw: true, align: 'center', bg: tone(r.tasks[t.key]) })).join('')}${td(total, { align: 'center', bold: true })}</tr>`;
  }).join('');
  const score = `<tr>${td('⭐ Performance score', { bold: true, bg: '#f2f7f7' })}${rows.map((r) => td(`${r.perf.score}`, { align: 'center', bold: true, bg: '#f2f7f7' })).join('')}${td(String(Math.round(rows.reduce((a, r) => a + r.perf.score, 0) / (rows.length || 1))), { align: 'center', bold: true, bg: '#f2f7f7' })}</tr>`;
  const legend =
    slot === 'morning'
      ? 'Numbers are pending items as of 11 AM. IC2 / Eval show “to book [target]”. Talk time shows yesterday / daily target.'
      : 'Numbers are closed / target since 11 AM. Talk time shows minutes today / daily target.';
  const flagged = rows.filter((r) => r.concerns.length);
  const alert = flagged.length
    ? `<div style="background:#fdf1f0;border-left:4px solid #b42318;border-radius:6px;padding:10px 14px;margin:12px 0;font-size:13px"><b style="color:#b42318">Needs attention:</b><br>${flagged.map((r) => `<b>${esc(r.first)}</b>: ${esc(r.concerns.join(', '))}`).join('<br>')}</div>`
    : '';
  const html = shell({
    title: `Team Task Board · ${S.title}`,
    tag: S.tag,
    date,
    who: 'All TMs',
    body: `<p style="margin:0 0 8px">Hi team,</p><p style="margin:0 0 6px">${slot === 'morning' ? "Today's task-wise targets for everyone." : slot === 'progress' ? 'Where we stand at 5 PM.' : "Today's closure, task-wise."} Your personal mail has the student-wise list and action plan.</p>${alert}${table(head, body + score)}<div style="font-size:12px;color:#6b7b7c;margin-top:-8px"><span style="background:#fde8e8;padding:1px 6px;border-radius:3px">red</span> needs attention · <span style="background:#fff7e6;padding:1px 6px;border-radius:3px">amber</span> watch · <span style="background:#eaf7f0;padding:1px 6px;border-radius:3px">green</span> clear. ${legend}</div>`,
    sender: { ...sender, dataAt: new Date(board.fetchedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) },
  });
  return { subject: `Team Task Board – ${date} | ${S.title}`, html };
}

module.exports = { tmEmail, teamEmail, SLOT };
