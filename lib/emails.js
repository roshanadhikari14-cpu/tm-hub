// Email HTML: one mail per TM per slot, plus one team board mail (TMs in CC).
// Inline styles and tables only, so Gmail/Outlook render them faithfully.
const { TASKS, fmtDay, taskPage } = require('./model');

const link = (href, text) => (href ? `<a href="${esc(href)}" target="_blank" style="color:#33379e;text-decoration:underline">${text}</a>` : text);

const TEAL = '#33379e';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SLOT = {
  morning: { title: "Today's Tasks", tag: '11 AM', subject: "Today's Tasks" },
  progress: { title: 'Progress Update', tag: '5 PM', subject: 'Progress Update (5 PM)' },
  closure: { title: 'Day Closure', tag: '8 PM', subject: 'Day Closure (8 PM)' },
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

// ---- Numbers used by every mail: no targets, only "total in the morning" and "done since" ----
const work = TASKS.filter((t) => t.kind !== 'talk');
const verb = (t) => (t.key === 'nc15' ? 'connected' : t.kind === 'booking' ? 'booked' : 'closed');
const totalOf = (t, s) => s.morning || 0;
const doneOf = (t, s) => (t.kind === 'list' ? s.closed : s.done) || 0;
const leftOf = (t, s) => (t.kind === 'list' ? s.pending : Math.max(totalOf(t, s) - doneOf(t, s), 0));
const pctOf = (t, s) => (totalOf(t, s) ? Math.min(100, Math.round((100 * doneOf(t, s)) / totalOf(t, s))) : 100);
const lagTag = '<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#fde8e8;color:#b42318;font-size:12px;font-weight:600;white-space:nowrap">Lagged</span>';
const doneTag = '<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#e7f6ee;color:#17734a;font-size:12px;font-weight:600;white-space:nowrap">✓ Done</span>';

function dayTotals(row) {
  let total = 0;
  let done = 0;
  for (const t of work) {
    total += totalOf(t, row.tasks[t.key]);
    done += doneOf(t, row.tasks[t.key]);
  }
  return { total, done, pct: total ? Math.min(100, Math.round((100 * done) / total)) : 0, talk: row.tasks.talk.minutes || 0 };
}
const teamTalk = (rows) => Math.round(rows.reduce((a, r) => a + (r.tasks.talk.minutes || 0), 0) / (rows.length || 1));

// Where a TM fell behind: under half of the morning list done, or talk time well under the team average.
function lags(row, rows) {
  const out = [];
  for (const t of TASKS) {
    const s = row.tasks[t.key];
    if (t.kind === 'talk') {
      const avg = teamTalk(rows);
      if (avg && (s.minutes || 0) < avg * 0.75) out.push({ t, text: `${s.minutes || 0} min (team average ${avg} min)` });
      continue;
    }
    const total = totalOf(t, s);
    if (total && doneOf(t, s) / total < 0.5) out.push({ t, text: `${doneOf(t, s)} of ${total} ${verb(t)}, ${leftOf(t, s)} still open` });
  }
  return out;
}

// Top performer: a weighted score of the day's work. Talk time, NC-15, onboarding and
// negative feedback count three times as much as the other tasks.
const TOP_WEIGHT = { talk: 3, nc15: 3, onboarding: 3, negfb: 3 };
const topWeight = (t) => TOP_WEIGHT[t.key] || 1;
function topScore(row, rows) {
  const best = Math.max(...rows.map((r) => r.tasks.talk.minutes || 0), 0);
  let got = 0;
  let max = 0;
  for (const t of TASKS) {
    const s = row.tasks[t.key];
    // Talk time is measured against the best in the team today; a task with nothing to do is left out.
    const share = t.kind === 'talk' ? (best ? (s.minutes || 0) / best : null) : totalOf(t, s) ? Math.min(doneOf(t, s) / totalOf(t, s), 1) : null;
    if (share == null) continue;
    got += topWeight(t) * share;
    max += topWeight(t);
  }
  return max ? Math.round((100 * got) / max) : 0;
}
function topPerformer(rows) {
  const ranked = rows.map((r) => ({ r, score: topScore(r, rows), ...dayTotals(r) })).sort((x, y) => y.score - x.score || y.done - x.done || y.talk - x.talk);
  return ranked.length && (ranked[0].done > 0 || ranked[0].talk > 0) ? ranked[0] : null;
}
function topBox(rows, slot) {
  const top = topPerformer(rows);
  if (!top) return '';
  const R = top.r.tasks;
  const part = (key, word) => (totalOf({ kind: 'list' }, R[key]) ? `${word} ${R[key].closed || 0} of ${R[key].morning}` : '');
  const bits = [`talk time ${top.talk} min`, part('nc15', 'NC-15 connected'), part('onboarding', 'onboarding'), part('negfb', 'negative feedback')].filter(Boolean);
  return `<div style="background:#fff8e1;border-left:4px solid #e0a800;border-radius:6px;padding:12px 16px;margin:14px 0;font-size:13.5px"><b style="color:#8a5a00">🏆 Top performer ${slot === 'closure' ? 'today' : 'so far'}: ${esc(top.r.name)}</b><br>${esc(bits.join(' · '))}. ${top.done} task${top.done === 1 ? '' : 's'} done in all since 11 AM.<br><span style="color:#6b7b7c;font-size:12px">Ranked mainly on talk time, NC-15, onboarding and negative feedback; other tasks count less.</span></div>`;
}

function redBox(title, lines) {
  if (!lines.length) return '';
  return `<div style="background:#fdf1f0;border-left:4px solid #b42318;border-radius:6px;padding:12px 16px;margin:14px 0"><div style="font-weight:700;color:#b42318;margin-bottom:4px">${title}</div><ul style="margin:0;padding-left:18px">${lines.map((l) => `<li style="margin:2px 0">${l}</li>`).join('')}</ul></div>`;
}

// Morning and 5 PM: overdue items. 8 PM: where the day lagged.
function alertBox(row, slot, rows) {
  if (slot === 'closure') return redBox('Where the day lagged', lags(row, rows).map((l) => `<b>${l.t.icon} ${esc(l.t.label)}</b>: ${esc(l.text)}`));
  const od = TASKS.filter((t) => t.kind === 'list' && row.tasks[t.key].flagged);
  return redBox(
    slot === 'morning' ? 'Take these first' : 'Overdue items still open',
    od.map((t) => `<b>${t.icon} ${esc(t.label)}</b>: ${row.tasks[t.key].flagged} overdue / ageing item${row.tasks[t.key].flagged > 1 ? 's' : ''}`)
  );
}

function summaryTable(row, slot, rows) {
  const R = row.tasks;
  if (slot === 'morning') {
    const head = `<tr>${th('Task')}${th('Total today', 'center')}${th('Overdue / ageing', 'center')}</tr>`;
    const body = TASKS.map((t) => {
      const s = R[t.key];
      const bg = s.flagged ? '#fff6f5' : '';
      const total = t.kind === 'talk' ? `${s.yesterday} min yesterday` : String(totalOf(t, s));
      return `<tr>${td(`${t.icon} ${t.label}`, { bold: true, bg })}${td(total, { align: 'center', bg })}${td(s.flagged ? String(s.flagged) : '—', { align: 'center', bg, bold: Boolean(s.flagged) })}</tr>`;
    }).join('');
    return table(head, body);
  }
  const end = slot === 'closure';
  const lagged = end ? new Set(lags(row, rows).map((l) => l.t.key)) : new Set();
  const head = `<tr>${th('Task')}${th('At 11 AM', 'center')}${th(end ? 'Done today' : 'Done since morning', 'center')}${th('Still open', 'center')}${th('Progress')}${end ? th('', 'center') : ''}</tr>`;
  const body = TASKS.map((t) => {
    const s = R[t.key];
    const bg = lagged.has(t.key) ? '#fff6f5' : '';
    const talk = t.kind === 'talk';
    const cells = [
      td(`${t.icon} ${t.label}`, { bold: true, bg }),
      td(talk ? '—' : String(totalOf(t, s)), { align: 'center', bg }),
      td(talk ? `${s.minutes || 0} min` : String(doneOf(t, s)), { align: 'center', bg, bold: true }),
      td(talk ? '—' : `${leftOf(t, s)}${s.fresh ? ` (+${s.fresh} new)` : ''}`, { align: 'center', bg }),
      td(talk || !totalOf(t, s) ? '—' : bar(pctOf(t, s)), { raw: true, bg }),
    ];
    if (end) cells.push(td(lagged.has(t.key) ? lagTag : !talk && totalOf(t, s) && !leftOf(t, s) ? doneTag : '', { raw: true, align: 'center', bg }));
    return `<tr>${cells.join('')}</tr>`;
  }).join('');
  return table(head, body);
}

// A short plan with no numbers to hit: overdue first, then the rest, then bookings and connects.
function actionPlan(row, slot) {
  const R = row.tasks;
  const lists = TASKS.filter((t) => t.kind === 'list' && t.key !== 'nc15' && R[t.key].pending);
  const name = (t, n) => `${n} ${t.short.toLowerCase()}`;
  const urgent = lists.filter((t) => R[t.key].flagged);
  const lines = [];
  const when = slot === 'morning' ? 'First' : slot === 'progress' ? 'Before 8 PM' : 'First thing tomorrow';
  if (urgent.length) lines.push(`<b>${when}:</b> clear the overdue / ageing items (${urgent.map((t) => name(t, R[t.key].flagged)).join(', ')}).`);
  const rest = lists.filter((t) => R[t.key].pending - R[t.key].flagged > 0);
  if (rest.length) lines.push(`<b>${urgent.length ? 'Then' : when}:</b> work through the remaining ${rest.map((t) => name(t, R[t.key].pending - R[t.key].flagged)).join(', ')}.`);
  const bits = [];
  const book = TASKS.filter((t) => t.kind === 'booking' && leftOf(t, R[t.key]));
  if (book.length) bits.push(`book ${book.map((t) => (t.key === 'ic2' ? 'IC2' : 'eval')).join(' and ')} for the longest-waiting students`);
  if (R.nc15 && R.nc15.pending) bits.push('connect the NC-15 parents, longest silence first');
  bits.push('keep the parent calls going');
  lines.push(`<b>${slot === 'closure' ? 'Through tomorrow' : slot === 'progress' ? 'By 8 PM' : 'Through the day'}:</b> ${bits.length > 2 ? `${bits.slice(0, -1).join(', ')}, and ${bits[bits.length - 1]}` : bits.join(', and ')}.`);
  const list = lines.slice(0, 3).map((l) => `<li style="margin:4px 0">${l}</li>`).join('');
  return sectionTitle(slot === 'closure' ? '🎯 Plan for tomorrow' : '🎯 Action plan') + `<ol style="margin:4px 0 0;padding-left:20px;font-size:13.5px">${list}</ol>`;
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
        return `<tr>${td(String(i + 1), { align: 'center', bg })}${it.cells.map((c, j) => td(j === 0 ? link(it.link, esc(c)) : j === 1 ? link(it.taskLink, esc(c)) : esc(c), { raw: true, bg, bold: it.flag && j === it.cells.length - 1 })).join('')}</tr>`;
      })
      .join('');
    const more = s.items.length > limit ? `<div style="font-size:12px;color:#6b7b7c;margin:-12px 0 16px">+ ${s.items.length - limit} more in Lighthouse</div>` : '';
    const sub = slot === 'morning' ? `${s.items.length} pending` : `${s.items.length} still open`;
    html += sectionTitle(`${t.icon} ${link(taskPage(t.key), esc(t.label))}`, `${sub}${s.flagged ? ` · ${s.flagged} flagged in red` : ''} · click a name to open it in Lighthouse`) + table(head, rows) + more;
  }
  return html ? sectionTitle(slot === 'closure' ? '📋 Carry forward to tomorrow' : '📋 Student / batch-wise list') + html : '';
}

function intro(row, slot, rows) {
  const d = dayTotals(row);
  const hi = `<p style="margin:0 0 8px">Hi ${esc(row.first)},</p>`;
  if (slot === 'morning')
    return `${hi}<p style="margin:0">Here are today's tasks. You have <b>${d.total}</b> items on your list this morning. Items in <span style="color:#b42318;font-weight:600">red</span> are overdue or ageing, so please take them first.</p>`;
  if (slot === 'progress')
    return `${hi}<p style="margin:0">5 PM check-in: since 11 AM you have completed <b>${d.done} of ${d.total}</b> items and logged <b>${d.talk} min</b> of talk time.</p>`;
  const n = lags(row, rows).length;
  return `${hi}<p style="margin:0">Here's how today closed: <b>${d.done} of ${d.total}</b> items completed and <b>${d.talk} min</b> of talk time. ${n ? `${n} area${n > 1 ? 's' : ''} lagged today and ${n > 1 ? 'are' : 'is'} marked below.` : 'Nothing lagged today. Thank you!'} Anything still open carries forward to tomorrow.</p>`;
}

function tmEmail(row, board, slot, sender) {
  const S = SLOT[slot];
  const date = fmtDay(`${board.date}T12:00:00+05:30`);
  const rows = board.rows;
  const body =
    intro(row, slot, rows) + alertBox(row, slot, rows) + sectionTitle('📊 Summary') + summaryTable(row, slot, rows) + actionPlan(row, slot) + detailTables(row, slot);
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
  const morning = slot === 'morning';
  const end = slot === 'closure';
  const lagged = new Map(rows.map((r) => [r.name, end ? lags(r, rows) : []]));
  const grey = (x) => `<span style="color:#6b7b7c">${x}</span>`;
  const cell = (t, s) => {
    if (t.kind === 'talk') return `${morning ? s.yesterday : s.minutes || 0}m`;
    if (morning) return `${totalOf(t, s)}${s.flagged ? ` ${grey(`[${s.flagged} ${t.kind === 'booking' ? 'waiting 5+ days' : 'overdue'}]`)}` : ''}`;
    return `${doneOf(t, s)} ${grey(`of ${totalOf(t, s)}`)}`;
  };
  const tone = (t, r) => {
    const s = r.tasks[t.key];
    if (morning) return s.flagged ? '#fde8e8' : t.kind !== 'talk' && !totalOf(t, s) ? '#eaf7f0' : '';
    if (lagged.get(r.name).some((l) => l.t.key === t.key)) return '#fde8e8';
    return t.kind !== 'talk' && totalOf(t, s) && !leftOf(t, s) ? '#eaf7f0' : '';
  };
  const head = `<tr>${th('Task')}${rows.map((r) => th(r.first, 'center')).join('')}${th('Team', 'center')}</tr>`;
  const body = TASKS.map((t) => {
    const sum = (fn) => rows.reduce((a, r) => a + fn(r.tasks[t.key]), 0);
    const total =
      t.kind === 'talk' ? `${sum((s) => (morning ? s.yesterday : s.minutes) || 0)}m` : morning ? String(sum((s) => totalOf(t, s))) : `${sum((s) => doneOf(t, s))} of ${sum((s) => totalOf(t, s))}`;
    return `<tr>${td(`${t.icon} ${t.label}`, { bold: true })}${rows.map((r) => td(cell(t, r.tasks[t.key]), { raw: true, align: 'center', bg: tone(t, r) })).join('')}${td(total, { align: 'center', bold: true })}</tr>`;
  }).join('');
  const all = rows.map(dayTotals);
  const sumAll = all.reduce((a, d) => ({ total: a.total + d.total, done: a.done + d.done }), { total: 0, done: 0 });
  const totalRow = `<tr>${td(morning ? '📌 Total tasks' : '✅ Total done since 11 AM', { bold: true, bg: '#f2f7f7' })}${all
    .map((d) => td(morning ? String(d.total) : `${d.done} of ${d.total}`, { align: 'center', bold: true, bg: '#f2f7f7' }))
    .join('')}${td(morning ? String(sumAll.total) : `${sumAll.done} of ${sumAll.total}`, { align: 'center', bold: true, bg: '#f2f7f7' })}</tr>`;
  const score = `<tr>${td('⭐ Performance score', { bold: true, bg: '#f2f7f7' })}${rows.map((r) => td(`${r.perf.score}`, { align: 'center', bold: true, bg: '#f2f7f7' })).join('')}${td(String(Math.round(rows.reduce((a, r) => a + r.perf.score, 0) / (rows.length || 1))), { align: 'center', bold: true, bg: '#f2f7f7' })}</tr>`;
  const legend = morning
    ? 'Numbers are the total tasks as of 11 AM. Talk time shows yesterday’s minutes. <span style="background:#fde8e8;padding:1px 6px;border-radius:3px">Red</span> has overdue or ageing items.'
    : `Numbers are done since 11 AM, of the morning total. Talk time shows today’s minutes. <span style="background:#eaf7f0;padding:1px 6px;border-radius:3px">Green</span> is fully done.${end ? ' <span style="background:#fde8e8;padding:1px 6px;border-radius:3px">Red</span> lagged today (under half done, or talk time well under the team average).' : ''}`;
  const lagLines = rows.filter((r) => lagged.get(r.name).length).map((r) => `<b>${esc(r.first)}</b>: ${esc(lagged.get(r.name).map((l) => `${l.t.short} (${l.t.kind === 'talk' ? `${r.tasks.talk.minutes || 0} min` : `${doneOf(l.t, r.tasks[l.t.key])} of ${totalOf(l.t, r.tasks[l.t.key])}`})`).join(', '))}`);
  const html = shell({
    title: `Team Task Board · ${S.title}`,
    tag: S.tag,
    date,
    who: 'All TMs',
    body: `<p style="margin:0 0 8px">Hi team,</p><p style="margin:0 0 6px">${morning ? "Today's tasks for everyone, task-wise." : slot === 'progress' ? 'Work done since the morning, as of 5 PM.' : "Today's total progress, task-wise."} Your personal mail has the student-wise list.</p>${morning ? '' : topBox(rows, slot)}${redBox('Where the day lagged', lagLines)}${table(head, body + totalRow + score)}<div style="font-size:12px;color:#6b7b7c;margin-top:-8px">${legend}</div>`,
    sender: { ...sender, dataAt: new Date(board.fetchedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) },
  });
  return { subject: `Team Task Board – ${date} | ${S.title}`, html };
}

module.exports = { tmEmail, teamEmail, SLOT };
