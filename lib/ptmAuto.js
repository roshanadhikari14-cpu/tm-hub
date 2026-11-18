// Writes a PTM plan WITHOUT any AI: reads the Monthly Learning Report text and the evaluators' own notes
// (from Lighthouse) and fills the plan with real numbers. Free, instant, same layout as the AI version.
const num = (x) => (x == null ? null : Number(x));
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const lvl = (p, hi = 90, mid = 75) => (p >= hi ? 'ok' : p >= mid ? 'mid' : 'warn');
const tex = (s) => String(s).replace(/\\?(?:text|mathrm|mathbf)\s*\{([^}]*)\}?/g, ' $1').replace(/\\(?:times|cdot)/g, '×').replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '$1/$2').replace(/[\\{}$]/g, '').replace(/\s{2,}/g, ' ').trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);
const MONTHS = { jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June', jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December' };

// ---------- read the monthly report text ----------
function parseMonthly(text, first) {
  const pages = String(text || '').split(/--- page \d+\n/).slice(1);
  const all = pages.join(' ').replace(/\s+/g, ' ');
  const m = (re, i = 1) => {
    const r = all.match(re);
    return r ? r[i] : null;
  };
  const out = { first };
  out.cycle = m(/Monthly Learning Report (?:· )?(\d+ \w+ – \d+ \w+)/) || m(/(\d{1,2} [A-Z][a-z]{2,4} – \d{1,2} [A-Z][a-z]{2,4})/);
  const att2 = all.match(/we conducted (\d+) classes.{0,160}?attended (\d+) of them/) || all.match(/attended (\d+) of (\d+) (?:regular )?classes/);
  out.highlight = m(/reached (\d+)% mastery in (.+?) this month/, 0);
  const hl = all.match(/reached (\d+)% mastery in (.+?) this month/);
  out.hlPct = hl ? Number(hl[1]) : null;
  out.hlChapter = hl ? hl[2].trim() : null;
  const band = all.match(/climbed from band (\w+) to (\w+)/);
  out.band = band ? [band[1], band[2]] : null;
  const att = all.match(/attended (\d+) of the (\d+) regular and extra personalised classes/) || all.match(/attended (\d+) of (\d+) regular and extra personalised classes/);
  const aa = att ? [Number(att[1]), Number(att[2])] : att2 ? (/we conducted/.test(att2[0]) ? [Number(att2[2]), Number(att2[1])] : [Number(att2[1]), Number(att2[2])]) : null;
  out.attended = aa ? aa[0] : null;
  out.classes = aa ? aa[1] : null;
  const ap = all.match(/\((\d+)%,? (up|down) from (\d+)% last month\)/);
  out.attPct = out.classes ? pct(out.attended, out.classes) : null;
  out.attPrev = ap ? Number(ap[3]) : null;
  out.punct = num(m(/(\d+)% on time/));
  out.focus = num(m(/Attentiveness averaged ([\d.]+)%/));
  out.part = num(m(/Participation is at ([\d.]+) ?\/ ?10/));
  out.words = num(m(/speaks roughly (\d+) words/));
  const pr = all.match(/(\d+) of (\d+) practice sheets were submitted/);
  const pn = all.match(/(\d+) practice sheets were assigned but none/);
  out.sheetsIn = pr ? Number(pr[1]) : pn ? 0 : null;
  out.sheetsOf = pr ? Number(pr[2]) : pn ? Number(pn[1]) : null;
  const gaps = all.match(/foundation gaps?:? (.+?)(?: Preetham| [A-Z][a-z]+ stays focused| [A-Z][a-z]+ shows up| [A-Z][a-z]+ is participating| [A-Z][a-z]+ is speaking|$)/);
  out.foundation = gaps ? [...gaps[1].matchAll(/\d+ ([A-Z][A-Za-z ]+?)(?= \d+ [A-Z]|$)/g)].map((x) => x[1].trim()).slice(0, 3) : [];
  out.exams = [...all.matchAll(/\b(MATHS|SCIENCE|Maths|Science) (\d+ \w{3}) ?(?:· ?)?(In \d+ days?|Exam done|Today|Tomorrow)/g)].map((x) => ({ subject: x[1][0] + x[1].slice(1).toLowerCase(), date: x[2], when: x[3] }));
  out.missed = [...all.matchAll(/(Improvement Class|Extra Improvement Class|Evaluation|Teach class)[^.]*?was scheduled for (\d+ \w+ 20\d\d), but the student did not attend/g)].map((x) => `${x[1]} on ${x[2].replace(/ 20\d\d/, '')}`).slice(0, 3);

  // chapters
  out.chapters = [];
  for (const p of pages) {
    const flat = p.replace(/\s+/g, ' ');
    const ac = flat.match(/Across this chapter — (.+?) — \w+ has mastered (\d+) of (\d+) question categories/);
    if (!ac) continue;
    const subject = /S ?C ?I ?E ?N ?C ?E/.test(flat.slice(0, 60)) ? 'Science' : 'Maths';
    let pctNow = (flat.match(/MASTERY % (\d+)%/) || [])[1];
    if (pctNow == null) {
      const jr = flat.split('CHAPTER JOURNEY')[1] || '';
      const blocks = [];
      let last = -1;
      for (const x of jr.matchAll(/(\d+) (CNC|UMIS|CU)\b/g)) {
        const idx = ['CNC', 'UMIS', 'CU'].indexOf(x[2]);
        if (idx <= last || !blocks.length) blocks.push({});
        blocks[blocks.length - 1][x[2]] = Number(x[1]);
        last = idx;
      }
      const b = blocks[blocks.length - 1];
      if (b) pctNow = pct(b.CU || 0, (b.CNC || 0) + (b.UMIS || 0) + (b.CU || 0));
    }
    const gap = flat.match(/starting with (.+?)\.(?= |$)/);
    const imp = flat.match(/improve cumulatively by (\d+)%/);
    out.chapters.push({ name: ac[1].trim(), subject, mastered: Number(ac[2]), total: Number(ac[3]), pct: pctNow == null ? null : Number(pctNow), gap: gap ? gap[1].trim() : null, improved: imp ? Number(imp[1]) : null });
  }
  // oral evaluations (Science)
  out.orals = [];
  for (const p of pages) {
    if (!/Oral Evaluations/.test(p)) continue;
    const lines = p.split('\n').map((l) => l.trim());
    const di = lines.findIndex((l) => /^Oral evaluation · /.test(l));
    const kp = p.replace(/\s+/g, ' ').match(/(\d+)% Key points covered/);
    if (di > 0 && kp) out.orals.push({ chapter: lines[di - 1].replace(/ ?\d+ of \d+ this month$/, ''), date: lines[di].replace('Oral evaluation · ', ''), pct: Number(kp[1]) });
  }
  const aw = all.match(/Marks alignment is (?:strong|still building up) at (\d+)%/);
  out.align = aw ? Number(aw[1]) : null;
  out.blank = num(m(/(\d+) of \d+ were left unattempted/));
  return out;
}

// ---------- turn the evaluator's note on one question into "what happened / how to fix" ----------
const TAGS = [
  [/decimal/i, 'Decimal slip', 'Count the decimal places, then check the answer is sensible.'],
  [/unit|convert|conversion/i, 'Unit slip', 'Convert units first, and check the unit the question asks for.'],
  [/omit|left out|incomplete|stopped|did not (?:calculate|complete|write|provide)|missing|final step|last/i, 'Step left out', 'Before moving on, re-read the question for its last part.'],
  [/sign|negative|reciprocal|invert/i, 'Sign / step slip', 'Write each step in full and check signs and the order of operations.'],
  [/arithmetic|calculation|addition|multipl|divis|subtract|sum/i, 'Calculation slip', 'Re-do the calculation once, from the start, before the next question.'],
  [/formula/i, 'Formula slip', 'Write the formula first, then substitute carefully.'],
];
function mistakeFrom(c) {
  const t = c.text.replace(/\u0000/g, ' ').replace(/\s+/g, ' ');
  const head = (t.match(/^Q\d+ · (.+?)(?= (?:[A-Z][a-z]+ ?[A-Za-z’' ,:()-]{0,60})?(?:FULLY|UNDERSTANDS|MISTAKE|CONCEPT|COULD|NOT |PARTIALLY|[A-Z]{4,}))/) || t.match(/^Q\d+ · ([^|]{5,80})/) || [])[1] || 'Question';
  const type = clip(String(c.type || head).replace(/\s+/g, ' ').trim(), 60);
  const gap = (t.match(/Primary Gap: (.+?)\.(?= |$)/) || [])[1] || '';
  // summary sentence(s) the evaluator wrote after "AI-Powered"
  const after = (t.split(/AI-Powered/)[1] || '').trim();
  const summary = (after.match(/^(The student .+?[.])(?= Primary Gap| Apply| Convert| –|$)/) || after.match(/^(.+?[.])(?= |$)/) || [])[1] || '';
  // a concrete "should be … but the student wrote …" sentence, if any
  const concrete = (t.match(/(The student[^.]*?(?:should be|instead of|equals|correct (?:value|sum|answer|product))[^.]*\.[^.]*?)(?= |$)/) || [])[1] || '';
  // sentences with the actual numbers ("wrote 175 instead of 1750", "sum is 1490, correct sum is 1780")
  const sentences = c.text.replace(/\[shape\]/g, 'Σ').split(/AI-Powered/).slice(1).join(' ').split(/(?<=[.?!])\s+(?=[A-Z])|\u0000|\s{3,}|\n|(?=\bThe student\b)|(?=\bWhile\b)/).map((x) => tex(x).trim()).filter(Boolean);
  const numeric = sentences
    .filter((x) => /\d{2,}/.test(x) && /(wrote|written|calculated|got|obtained|instead|should|correct|expected|resulting|result|answer|multiplied|divided|added|subtracted|placed|put|mistook|copied)/i.test(x) && !/^Apply|^Convert|^Find|^Compute|^Organize|^Use /.test(x) && x !== summary)
    .sort((a, b) => (new Set(b.match(/\d[\d,.]*/g)).size) - (new Set(a.match(/\d[\d,.]*/g)).size))
    .slice(0, 2)
    .filter((x, i, arr) => i === 0 || (arr[0] + ' ' + x).length <= 300);
  const fixNum = (numeric.join(' ').match(/(?:should (?:be|have been)|correct (?:value|sum|answer|product|result|total|quotient|difference)(?: is| was)?|expected(?: answer| value)?(?: is| was)?|instead of)\s+(?:the )?([\d][\d,.\/×x+\-= ]*\d|\d)/i) || [])[1];
  const detail = numeric.length ? clip(numeric.join(' '), 300) : concrete || summary || (gap ? `Main gap: ${gap}.` : '');
  const key = `${gap} ${detail}`;
  const tag = TAGS.find(([re]) => re.test(key)) || [null, 'Mistake', 'Re-check each step against the question.'];
  const science = /Knowledge Accuracy/.test(t);
  let what = detail;
  let right = tag[2];
  if (science) {
    const sc = (t.match(/Knowledge Accuracy \w+ (?:AI-Powered )?(.+?)(?= BLOOM| ANSWER| Marks:)/) || [])[1] || '';
    what = clip(sc.replace(/AI-Powered\s*/g, '').trim(), 230);
    if (what.length < 25 || /ANSWER QUALITY/.test(what)) what = /PARTIALLY/.test(c.status) ? 'The answer covered only part of the marking points.' : /COULD NOT|NOT ATTEMPT/.test(c.status) ? 'This answer was left blank.' : 'The answer was brief and missed some marking points.';
    right = 'Cover every marking point and use the key terms in the answer.';
  }
  const cs = c.status;
  const tagName = science ? 'Writing' : /COULD NOT|NOT ATTEMPT|COULD NOT SOLVE/.test(cs) ? 'Skipped' : tag[1];
  if (!what) what = /COULD NOT|NOT ATTEMPT/.test(cs) ? 'This question was left unattempted or could not be solved.' : 'This answer lost marks in the working.';
  what = tex(what);
  right = tex(right);
  if (fixNum && !science) right = `The correct answer is ${fixNum.trim()}. ${right}`;
  return { type, what: clip(what.replace(/\s+/g, ' '), numeric.length ? 320 : 230), right, tag: tagName, subject: c.subject, date: c.date, gap };
}

const RANK = { 'UNDERSTANDS CONCEPT, MISTAKE IN STEPS': 0, 'MISTAKE IN STEPS': 0, 'PARTIALLY UNDERSTOOD': 1, 'CONCEPT NOT CLEAR': 2, 'NOT UNDERSTOOD': 2, 'COULD NOT SOLVE': 3, 'COULD NOT ANSWER': 3, 'NOT ATTEMPTED': 4 };
const dFmt = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : `${d.getUTCDate()} ${d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
};

// ---------- the plan ----------
function write(ctx, monthlyText, candidates, month) {
  const s = ctx.student;
  const first = String(s.name).split(' ')[0];
  const parts = String(monthlyText || '').split('=== EARLIER CYCLE ===');
  const M = parseMonthly(parts[0], first);
  const older = parts.slice(1).map((t) => parseMonthly(t, first)).filter((o) => o.cycle || o.attPct != null);
  const cycles = [M, ...older].map((o) => ({ ...o })).reverse(); // oldest first, before merging
  let period = M.cycle ? M.cycle.replace(' – ', ' – ') : '';
  if (older.length) {
    const sum = (k) => cycles.reduce((a, o) => a + (o[k] || 0), 0);
    const avg = (k) => {
      const v = cycles.map((o) => o[k]).filter((x) => x != null);
      return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
    };
    M.classes = sum('classes');
    M.attended = sum('attended');
    M.attPct = M.classes ? pct(M.attended, M.classes) : null;
    M.attPrev = cycles[0].attPct; // attendance in the first report
    M.focus = avg('focus');
    M.part = avg('part');
    M.words = avg('words') ? Math.round(avg('words')) : null;
    M.sheetsIn = sum('sheetsIn');
    M.sheetsOf = sum('sheetsOf');
    const seenCh = new Set();
    const merged = [];
    for (const o of [M, ...older]) for (const c of o.chapters || []) if (!seenCh.has(c.subject + c.name)) (seenCh.add(c.subject + c.name), merged.push(c));
    M.chapters = merged;
    M.orals = [M, ...older].flatMap((o) => o.orals || []);
    M.foundation = [...new Set([M, ...older].flatMap((o) => o.foundation || []))].slice(0, 3);
    M.missed = [...new Set([M, ...older].flatMap((o) => o.missed || []))];
    M.blank = cycles.reduce((a, o) => a + (o.blank || 0), 0) || M.blank;
    const st = cycles.map((o) => (o.cycle || '').split(' – ')[0]).find(Boolean);
    const en = (M.cycle || '').split(' – ')[1];
    if (st && en) period = `${st} – ${en}`;
  }
  const spanLabel = older.length ? (ctx.window === 'all' ? 'since joining' : 'last 60 days') : '';
  const reportsLabel = older.length ? `${cycles.length} reports` : '';
  const chM = M.chapters.filter((c) => c.subject === 'Maths' && c.pct != null);
  const chS = M.chapters.filter((c) => c.subject === 'Science');
  const best = [...chM, ...chS].filter((c) => c.pct != null).sort((a, b) => b.pct - a.pct)[0];
  const at100 = M.chapters.filter((c) => c.pct === 100);
  const isBoard = Number(s.grade) >= 9;

  // stats
  const attLvl = M.attPct == null ? 'mid' : lvl(M.attPct, 90, 80);
  const sheets = M.sheetsOf ? pct(M.sheetsIn, M.sheetsOf) : null;
  const stats = [
    { value: M.attPct != null ? `${M.attPct}%` : '—', label: `Attendance<br>${M.attended ?? '—'} of ${M.classes ?? '—'} classes${older.length ? ` · ${spanLabel}` : M.attPrev != null ? ` · was ${M.attPrev}%` : ''}`, level: attLvl, tag: attLvl === 'ok' ? 'Healthy' : attLvl === 'mid' ? 'Monitor' : 'Needs routine' },
    { value: M.focus != null ? `${Math.round(M.focus)}%` : '—', label: older.length ? `Focus in class<br>average over ${reportsLabel}` : 'Focus in class<br>average attentiveness', level: M.focus == null ? 'mid' : lvl(M.focus, 85, 75), tag: M.focus >= 85 ? 'Healthy' : 'Monitor' },
    { value: M.part != null ? `${M.part}<small>/10</small>` : '—', label: `Participation<br>${M.words ? `~${M.words} words per class` : 'in class'}`, level: M.part == null ? 'mid' : lvl(M.part * 10, 80, 70), tag: M.part >= 8 ? 'Healthy' : 'Can grow' },
    { value: M.sheetsOf != null ? `${M.sheetsIn} of ${M.sheetsOf}` : '—', label: older.length ? `Practice sheets<br>submitted, ${spanLabel}` : 'Practice sheets<br>submitted at home', level: sheets == null ? 'mid' : lvl(sheets, 90, 60), tag: sheets >= 90 ? 'Healthy' : sheets >= 60 ? 'Halfway' : 'Needs support' },
  ];

  // snapshot: weakest and strongest chapters, then Science oral tests
  const snap = [];
  const byPct = [...chM].sort((a, b) => a.pct - b.pct);
  const picks = [...new Set([...byPct.slice(0, 2), ...byPct.slice(-2)])].slice(0, 4);
  for (const c of picks) snap.push({ name: `Maths · ${c.name}`, sub: `${c.mastered} of ${c.total} question types`, score: c.pct, level: lvl(c.pct), tag: c.pct >= 90 ? 'Strong' : c.pct >= 75 ? 'Building' : 'Revise', meaning: c.gap ? clip(`Next: ${c.gap}`, 50) : c.pct >= 90 ? 'Strong' : 'Needs more practice' });
  const oralBy = {};
  for (const o of M.orals) (oralBy[o.chapter] ||= []).push(o.pct);
  for (const [ch, v] of Object.entries(oralBy).slice(0, 2)) {
    const avg = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
    snap.push({ name: `Science · ${ch}`, sub: `Oral tests, ${v.length} (key points covered)`, score: avg, level: lvl(avg, 85, 65), tag: avg >= 85 ? 'Strong' : avg >= 65 ? 'Building' : 'Revise', meaning: avg >= 85 ? 'Explains well aloud' : 'Needs exact facts and terms' });
  }
  if (!snap.length) snap.push({ name: 'Maths and Science', sub: 'Chapter results', score: 0, level: 'mid', tag: 'Pending', meaning: 'Chapter results appear after the next evaluation' });

  // mistakes: step slips first, then partial answers, then others; one per question type
  const seen = new Set();
  const picked = [];
  for (const c of [...candidates].sort((a, b) => (RANK[a.status] ?? 5) - (RANK[b.status] ?? 5))) {
    const mk = mistakeFrom(c);
    const k = mk.type.slice(0, 30);
    if (seen.has(k)) continue;
    seen.add(k);
    picked.push({ c, mk });
    if (picked.length >= 4) break;
  }
  const mistakes = picked.map(({ c, mk }) => ({ photo: c.id, title: `${clip(mk.type, 44)} · ${dFmt(c.date)}`, what: mk.what, right: mk.right, tag: mk.tag }));
  const slipTags = new Set(picked.map((p) => p.mk.tag));
  const stepSlips = [...slipTags].filter((t) => /slip|left out/i.test(t));

  // text
  const gain = M.band ? `Maths climbed from band <b>${M.band[0]} to ${M.band[1]}</b>` : M.hlChapter ? `reached <b>${M.hlPct}% mastery in ${M.hlChapter}</b>` : best ? `is strongest in <b>${best.name}</b> (${best.pct}%)` : 'is making steady progress';
  const gainText = `${first} ${gain}`;
  const concern = [];
  if (M.attPct != null && M.attPct < 80) concern.push(`<b>attendance (${M.attPct}%)</b>`);
  if (sheets != null && sheets < 70) concern.push(`<b>practice sheets (${M.sheetsIn} of ${M.sheetsOf})</b>`);
  if (stepSlips.length) concern.push('<b>small slips in the last step</b>');
  const hero = `${older.length ? `Across ${reportsLabel} (${period}), ` : ''}${gainText}${M.attPct != null ? `, with <b>${M.attPct}% attendance</b>` : ''}. ${concern.length ? `The main areas to work on are ${concern.join(', ')}.` : 'The focus now is to keep this rhythm and close the remaining gaps.'}${isBoard ? ' Pre-Boards and Boards cover the whole syllabus, so every chapter matters.' : ''}`;
  const big = best ? [`${best.pct}%`, `Best chapter mastery<br>${clip(best.name, 28)}`] : [M.attPct != null ? `${M.attPct}%` : '—', 'Attendance<br>this cycle'];

  const nextExam = M.exams.find((e) => e.when !== 'Exam done');
  const talk = [
    at100.length ? `Celebrate: ${at100.length} chapter${at100.length > 1 ? 's' : ''} at 100% mastery` : 'Celebrate this cycle’s progress',
    nextExam ? `${nextExam.subject} exam about ${nextExam.date}: the revision plan` : 'The plan for next month (page 3)',
    mistakes.length ? `Show the ${mistakes.length} slips (page 2) with the correct way` : 'Chapter gaps and how we will close them',
    sheets != null && sheets < 70 ? `Practice sheets: ${M.sheetsIn} of ${M.sheetsOf}. Agree a daily slot` : M.attPct != null && M.attPct < 85 ? `Attendance ${M.attPct}%: agree a steady routine` : 'Keep up attendance and practice',
  ];
  const strengths = [];
  if (M.focus >= 85) strengths.push(`Focused in class (${Math.round(M.focus)}% attentiveness)`);
  if (M.part >= 8) strengths.push(`Speaks up confidently (${M.part}/10)`);
  if (at100.length) strengths.push(`${at100.length} chapter${at100.length > 1 ? 's' : ''} fully mastered`);
  if (M.punct >= 90) strengths.push(`Punctual (${M.punct}% on time)`);
  if (M.attPct >= 90) strengths.push(`Regular (${M.attPct}% attendance)`);
  while (strengths.length < 3) strengths.push(['Responds to improvement classes', 'Steady progress through the chapters', 'Willing to learn'][strengths.length]);
  const workOn = [];
  if (stepSlips.length) workOn.push('<b>Last-step and calculation checks</b>');
  if (M.attPct != null && M.attPct < 90) workOn.push(`<b>Attendance and routine</b> (${M.attPct}%)`);
  if (sheets != null && sheets < 90) workOn.push(`<b>Practice sheets</b> at home (${M.sheetsIn} of ${M.sheetsOf})`);
  const lowest = byPct[0];
  if (lowest && lowest.pct < 85) workOn.push(`<b>${lowest.name}</b> (${lowest.pct}%)`);
  if (M.part != null && M.part < 7.5) workOn.push('<b>Speaking up</b> in class');
  for (const x of ['Written answers', 'Revision of earlier chapters', 'Daily practice']) if (workOn.length < 3) workOn.push(`<b>${x}</b>`);

  const also = [];
  for (const c of [...chM, ...chS].filter((c) => c.gap && c.pct < 100).slice(0, 2)) also.push(`<b>${c.name}</b>: next focus is ${clip(c.gap, 80)}.`);
  for (const x of M.missed.slice(0, 1)) also.push(`Missed: ${x}. Please encourage attending these sessions.`);
  if (M.blank) also.push(`<b>${M.blank}</b> descriptive answers were left unattempted this month. Attempt every question.`);
  if (older.length) {
    const cyc = cycles;
    const trend = (label, f, unit) => {
      const v = cyc.map(f);
      return v.every((x) => x != null) ? `${label} ${v.map((x) => x + unit).join(' → ')}` : '';
    };
    const bits = [trend('attendance', (o) => o.attPct, '%'), trend('practice sheets submitted', (o) => (o.sheetsOf ? Math.round((100 * o.sheetsIn) / o.sheetsOf) : null), '%')].filter(Boolean);
    const names = cyc.map((o) => o.cycle).filter(Boolean);
    if (bits.length) also.unshift(`<b>Trend over ${cyc.length} reports${names.length ? ` (${names[0].split(' – ')[0]} to ${names[names.length - 1].split(' – ')[1]})` : ''}:</b> ${bits.join('; ')}.`);
  }
  if (!also.length) also.push('No other gaps stand out this cycle.');
  const writing = M.align != null ? `Written Science answers cover about <b>${M.align}%</b> of the marking points. We will practise <b>key terms and full-marks answers</b> in answer-writing classes.` : 'We will practise writing complete answers with the key terms in answer-writing classes.';

  // goals from the school chapter plan
  const ongoing = (sub) => ctx.plan.filter((p) => p.startsWith(sub + ':')).map((p) => p.replace(/^\w+: /, '').split(' — ')[0]);
  const mO = ongoing('Maths');
  const sO = ongoing('Science');
  const mGap = byPct.find((c) => c.pct < 90);
  const goals = {
    maths: { points: [mO[0] ? `Finish “${mO[0]}”` : 'Continue the school chapters', mGap ? `Improvement classes on ${clip(mGap.name, 40)}` : 'Keep up with the next school chapters', isBoard ? 'Revise every chapter, weakest first' : 'Practice sheets after each chapter'], target: mGap ? `${clip(mGap.name, 28)} <em>${mGap.pct}% → 90%+</em>` : 'Every chapter <em>above 90%</em>' },
    science: { points: [sO[0] ? `Finish “${sO[0]}”` : 'Continue the school chapters', 'Answer-writing practice', sO[1] ? `Then “${sO[1]}”` : 'Revise earlier chapters'], target: 'Oral tests and written answers <em>above 80%</em>' },
    basics: { points: M.foundation.length ? M.foundation.map((x) => clip(x, 40)).slice(0, 3) : ['Short drills on basic skills', 'Re-check every final answer'], target: stepSlips.length ? '<em>No last-step slips</em>' : 'Basics <em>checked and clear</em>' },
    habits: { points: ['Fixed class routine', 'Daily 15-minute practice slot'], target: '<em>90%+ attendance</em><br><em>All practice sheets</em> on time' },
  };
  while (goals.maths.points.length < 2) goals.maths.points.push('Practice sheets after each chapter');
  const bigExams = ctx.exams.filter((e) => /Annual|Board/i.test(e)).map((e) => e.split(' · '));
  const dd = (iso) => {
    const d = new Date(iso + 'T12:00:00Z');
    return Number.isNaN(d.getTime()) ? '' : `${d.getUTCDate()} ${d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })}`;
  };
  const annual = bigExams.length ? `${bigExams[0][0].replace(/s$/, '')}s (about ${bigExams.slice(0, 2).map((b) => `${dd(String(b[2]).slice(0, 10))} ${b[1]}`).join(', ')}, to be confirmed)` : 'the next school exams';
  return {
    plan: {
      hero,
      period,
      big,
      talk,
      stats,
      snapshot: snap.slice(0, 5).map((x) => ({ ...x })),
      strengths: strengths.slice(0, 3),
      workOn: workOn.slice(0, 3),
      mistakesIntro: mistakes.length ? `These are mostly <b>small, fixable slips</b> in ${first}’s own notebook, shown with the correct way. A short final check on every answer will win these marks back.` : `No answer photos were available this cycle. The chapter results above show where to focus.`,
      mistakes,
      alsoNoticed: also.slice(0, 3),
      writing,
      basics: (M.foundation.length ? M.foundation : ['Basic skills', 'Final-answer checks', 'Daily practice']).slice(0, 3).map((x) => clip(x, 34)),
      exam: nextExam ? `${nextExam.subject} exam about ${nextExam.date} (${nextExam.when.toLowerCase()})` : '',
      goals,
      annual,
    },
    usage: { auto: true },
  };
}

module.exports = { write, parseMonthly, mistakeFrom };
