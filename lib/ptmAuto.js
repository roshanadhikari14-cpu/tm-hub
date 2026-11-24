// Writes a PTM plan WITHOUT any AI: reads the Monthly Learning Report text and the evaluators' own notes
// (from Lighthouse) and fills the plan with real numbers. Free, instant, same layout as the AI version.
const num = (x) => (x == null ? null : Number(x));
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const lvl = (p, hi = 90, mid = 75) => (p >= hi ? 'ok' : p >= mid ? 'mid' : 'warn');
const tex = (s) => String(s).replace(/\\?(?:text|mathrm|mathbf)\s*\{([^}]*)\}?/g, ' $1').replace(/\\(?:times|cdot)/g, '×').replace(/\bleft\(/g, '(').replace(/\bright\)/g, ')').replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '$1/$2').replace(/[\\{}$]/g, '').replace(/\s{2,}/g, ' ').trim();
// ends on a whole sentence where it can, so nothing is cut mid-thought
const sent = (s, n) => {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return i > n * 0.5 ? cut.slice(0, i + 1) : clip(s, n);
};
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
  parseNewFormat(pages, all, out);
  return out;
}

// The newer Monthly Learning Report is laid out like a plan ("<Name>'s December Plan"): headline stats, subject snapshot,
// every chapter at a glance, the monthly plan and "how you can help at home". Read those parts directly.
function parseNewFormat(pages, all, out) {
  if (!/What we will discuss today/.test(all) || !/Where \S+ stands today/.test(all)) return;
  out.newFormat = true;
  const L = (p) => String(p || '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const p1 = L(pages[0]);
  const mm = (re, src = all) => {
    const r = src.match(re);
    return r || null;
  };
  // period and headline
  const per = mm(/UPRIO reports,? (\d{1,2} [A-Z][a-z]{2,4}) ?[–-] ?(\d{1,2} [A-Z][a-z]{2,4})/);
  if (per) out.cycle = `${per[1]} – ${per[2]}`;
  const ti = p1.findIndex((l) => /^Tutor Manager:/.test(l));
  if (ti >= 0) {
    const h = [];
    for (let i = ti + 1; i < p1.length && !/^\d{1,3}%$/.test(p1[i]); i++) h.push(p1[i]);
    out.hero = h.join(' ').replace(/\s+/g, ' ').trim();
  }
  // "What we will discuss today"
  const di = p1.findIndex((l) => /^What we will discuss today/.test(l));
  const wi = p1.findIndex((l) => /^1 Where .* stands today/.test(l));
  if (di >= 0 && wi > di) {
    const items = [];
    for (const l of p1.slice(di + 1, wi)) {
      if (/^\d /.test(l)) items.push(l.replace(/^\d /, ''));
      else if (items.length) items[items.length - 1] += ' ' + l;
    }
    out.talk = items.slice(0, 4);
  }
  // headline stats
  const stat = (label) => {
    const i = p1.findIndex((l) => l === label);
    return i > 0 ? { v: p1[i - 1], note: p1[i + 1] || '', tag: p1[i + 2] || '' } : null;
  };
  const at = stat('Attendance');
  if (at) {
    const a = mm(/(\d+) of (\d+)(?: classes)?(?: · was (\d+)%)?/, at.note);
    if (a) {
      out.attended = Number(a[1]);
      out.classes = Number(a[2]);
      out.attPct = pct(out.attended, out.classes);
      if (a[3]) out.attPrev = Number(a[3]);
    } else if (/^\d+%$/.test(at.v)) out.attPct = parseInt(at.v, 10);
  }
  const fo = stat('Focus in class');
  if (fo && /^\d+%$/.test(fo.v)) out.focus = parseInt(fo.v, 10);
  const pa = stat('Participation');
  if (pa) {
    const v = mm(/^([\d.]+)\s*\/\s*10/, pa.v);
    if (v) out.part = Number(v[1]);
    const w = mm(/~?(\d+) words/, pa.note);
    if (w) out.words = Number(w[1]);
  }
  const ps = stat('Practice sheets');
  if (ps) {
    const s = mm(/^(\d+) of (\d+)/, ps.v);
    if (s) {
      out.sheetsIn = Number(s[1]);
      out.sheetsOf = Number(s[2]);
    } else if (/^\d+$/.test(ps.v)) out.sheetsIn = Number(ps.v);
  }
  const pu = mm(/[Pp]unctual \((\d+)%/);
  if (pu) out.punct = Number(pu[1]);
  // lists on page 1
  const sl = p1.findIndex((l) => /strengths$/.test(l));
  const wl = p1.findIndex((l) => /^What we will work on/.test(l));
  const endL = p1.findIndex((l) => /^UPRIO · Monthly Learning Report/.test(l));
  const lines = (a, b) => {
    const items = [];
    for (const l of p1.slice(a + 1, b < 0 ? undefined : b)) {
      const prev = items[items.length - 1];
      if (prev && prev.length >= 40 && l.length < 28 && !/^(Full tests|Finish|Attempt|Keep|Practice|Revise|Focused|Attendance|Responds)/.test(l)) items[items.length - 1] = prev + ' ' + l;
      else items.push(l);
    }
    return items;
  };
  if (sl >= 0 && wl > sl) out.strengths = lines(sl, wl);
  if (wl >= 0) out.workOn = lines(wl, endL > wl ? endL : -1);
  // snapshot rows of page 1: "Maths · Chapter  10 question types  100% Mastered  From 90% to 100% in 2 improvement classes"
  const sn = p1.findIndex((l) => /^2 Subject snapshot/.test(l));
  const hdr = p1.findIndex((l) => /^SUBJECT · CHAPTER/.test(l));
  const snEnd = p1.findIndex((l) => /strengths$/.test(l));
  if (sn >= 0 && snEnd > sn) {
    const txt = p1.slice((hdr >= 0 ? hdr : sn) + 1, snEnd).join(' ');
    out.snapRows = [];
    const re = /(Maths|Science) · (.+?) (\d+) (?:question types?|knowledge blocks?|[a-z]+ tests?) (\d+)% (Mastered|Improving|Strong|Building|Revise|Polish|Needs work|Developing)\s*(.*?)(?= (?:Maths|Science) · |$)/g;
    let r;
    while ((r = re.exec(txt))) out.snapRows.push({ subject: r[1], name: r[2].trim(), total: Number(r[3]), pct: Number(r[4]), tag: r[5], meaning: r[6].trim() });
  }
  // page 2: blank answers and basic skills
  const blank = mm(/(\d+) questions? (?:were|was) left blank/);
  if (blank) out.blank = Number(blank[1]);
  const bsi = all.search(/Basic skills from earlier classes/);
  if (bsi >= 0) {
    const pg = L(pages.find((p) => /Basic skills from earlier classes/.test(p)));
    const bi = pg.findIndex((l) => /^Basic skills from earlier classes/.test(l));
    const items = [];
    for (let i = bi + 1; i < pg.length; i++) {
      if (/^(Photos are|UPRIO ·)/.test(pg[i])) break;
      if (/^month.s answers:?$|^this month.s answers/i.test(pg[i])) continue;
      items.push(pg[i]);
    }
    out.foundation = items.filter((x) => x.length > 3 && x.length < 60 && !/answers:?$/i.test(x)).slice(0, 3);
  }
  // page 3: chapters waiting for a full test
  const ft = all.match(/Full test pending (.+?) (?:Coming up|UPRIO ·)/);
  if (ft) out.fullTest = [...ft[1].matchAll(/([^·]+?) \((Maths|Science)\)/g)].map((x) => ({ name: x[1].trim(), subject: x[2] }));
  // plan page: "Our plan for the month" rows
  const pp = pages.find((p) => /Our plan for the month/.test(p));
  if (pp) {
    const pl = L(pp);
    const bi = pl.findIndex((l) => /^AREA WHAT WE WILL DO/.test(l));
    const ei = pl.findIndex((l) => /^Every chapter follows/.test(l));
    const rows = {};
    let cur = null;
    for (const l of pl.slice(bi + 1, ei > bi ? ei : undefined)) {
      const m = l.match(/^(Maths|Science|Basics|Habits) (.+)$/);
      if (m) {
        cur = m[1];
        rows[cur] = [m[2]];
      } else if (cur) rows[cur].push(l);
    }
    out.planRows = rows;
    const hi = pl.findIndex((l) => /^2 How you can help/.test(l));
    const ui = pl.findIndex((l) => /^3 How we will keep/.test(l));
    if (hi >= 0) {
      const body = pl.slice(hi + 1, ui > hi ? ui : undefined).join(' ');
      const sents = body.split(/(?<=\.)\s+(?=[A-Z0-9])/).map((x) => x.trim()).filter(Boolean);
      const items = [];
      for (const x of sents) {
        const last = items[items.length - 1];
        if (!last || (last.body && x.length < 42)) items.push({ lead: x, body: '' });
        else if (!last.body && x.length < 42 && !last.lead.endsWith('.')) last.lead += ' ' + x;
        else last.body = (last.body ? last.body + ' ' : '') + x;
      }
      out.help = items.slice(0, 4);
    }
  }
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
    what = sent(sc.replace(/AI-Powered\s*/g, '').trim(), 330);
    if (what.length < 25 || /ANSWER QUALITY/.test(what)) what = /PARTIALLY/.test(c.status) ? 'The answer covered only part of the marking points.' : /COULD NOT|NOT ATTEMPT/.test(c.status) ? 'This answer was left blank.' : 'The answer was brief and missed some marking points.';
    right = 'Cover every marking point and use the key terms in the answer.';
  }
  const cs = c.status;
  const tagName = science ? 'Writing' : /COULD NOT|NOT ATTEMPT|COULD NOT SOLVE/.test(cs) ? 'Skipped' : tag[1];
  if (!what) what = /COULD NOT|NOT ATTEMPT/.test(cs) ? 'This question was left unattempted or could not be solved.' : 'This answer lost marks in the working.';
  what = tex(what);
  right = tex(right);
  if (fixNum && !science) right = `The correct answer is ${fixNum.trim()}. ${right}`;
  return { type, what: sent(what.replace(/\s+/g, ' '), numeric.length ? 420 : 330), right, tag: tagName, subject: c.subject, date: c.date, gap };
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
  // The report is about the chapters of the upcoming exam only.
  const SYL = ctx.syllabus || {};
  const hasSyl = Object.values(SYL).some((v) => v && v.chapters && v.chapters.length);
  const nz = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const same = (x, y) => {
    const p = nz(x), q = nz(y);
    return p && q && (p === q || p.includes(q) || q.includes(p));
  };
  const inSyl = (sub, name) => {
    const l = SYL[sub] && SYL[sub].chapters;
    return !hasSyl || (l ? l.some((c) => same(c.name, name)) : false);
  };
  if (M.newFormat) {
    const have = (sub, name) => M.chapters.some((c) => c.subject === sub && same(c.name, name));
    for (const r of M.snapRows || []) if (!have(r.subject, r.name)) M.chapters.push({ name: r.name.replace(/- /, '-'), subject: r.subject, mastered: Math.round((r.pct * r.total) / 100), total: r.total, pct: r.pct, gap: null, improved: null, note: r.meaning });
    const D0 = detail(ctx, parts[0]);
    for (const sub of ['Maths', 'Science']) for (const r of (D0 && D0.rows && D0.rows[sub]) || []) if (r.pct != null && !have(sub, r.name)) M.chapters.push({ name: r.name, subject: sub, mastered: null, total: null, pct: r.pct, gap: null, improved: null, note: '' });
  }
  const chM = M.chapters.filter((c) => c.subject === 'Maths' && c.pct != null && inSyl('Maths', c.name));
  const chS = M.chapters.filter((c) => c.subject === 'Science' && inSyl('Science', c.name));
  const fmtD = (iso) => (iso ? new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
  const examName = ((SYL.Maths || SYL.Science || {}).exam) || '';
  const examLine = hasSyl ? `${examName} · ${['Maths', 'Science'].filter((x) => SYL[x]).map((x) => `${x} ${fmtD(SYL[x].date)}${SYL[x].status ? ' (' + SYL[x].status + ')' : ''}`).join(' · ')}` : '';
  // mistakes only from evaluations of those chapters (if the evaluation names its chapters)
  const candOK = (c) => !hasSyl || ctx.window === 'all' || !c.chapters || String(c.chapters).split(/\s*[+,]\s*/).some((n) => inSyl(c.subject, n));
  candidates = candidates.filter(candOK);
  const best = [...chM, ...chS].filter((c) => c.pct != null).sort((a, b) => b.pct - a.pct)[0];
  const at100 = [...chM, ...chS].filter((c) => c.pct === 100);
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

  const crOf = (sub, name) => (ctx.chapterData || []).find((c) => c.pct != null && (c.subject === 'science' ? 'Science' : 'Maths') === sub && same(c.name, name));
  // snapshot: the exam chapters (lowest first), with the result where we have one
  const snap = [];
  const byPct = [...chM].sort((a, b) => a.pct - b.pct);
  const oralBy = {};
  for (const o of M.orals) (oralBy[o.chapter] ||= []).push(o.pct);
  const tagOf = (v) => (v >= 90 ? 'Strong' : v >= 75 ? 'Building' : 'Revise');
  if (hasSyl) {
    const rows = [];
    for (const sub of ['Maths', 'Science']) {
      for (const sc of (SYL[sub] && SYL[sub].chapters) || []) {
        const mc = M.chapters.find((c) => c.subject === sub && c.pct != null && same(c.name, sc.name));
        const oralKey = sub === 'Science' && Object.keys(oralBy).find((k) => same(k, sc.name));
        if (mc) rows.push({ name: `${sub} · ${sc.name}`, sub: mc.mastered != null ? `${mc.mastered} of ${mc.total} question types` : 'From the monthly report', score: mc.pct, level: lvl(mc.pct), tag: tagOf(mc.pct), meaning: mc.gap ? clip(`Next: ${mc.gap}`, 50) : mc.note ? clip(mc.note, 50) : mc.pct >= 90 ? 'Fully mastered' : 'Needs more practice' });
        else if (oralKey) {
          const v = oralBy[oralKey];
          const av = Math.round(v.reduce((x, y) => x + y, 0) / v.length);
          rows.push({ name: `${sub} · ${sc.name}`, sub: `Oral tests, ${v.length}`, score: av, level: lvl(av, 85, 65), tag: tagOf(av), meaning: av >= 85 ? 'Explains well aloud' : 'Needs exact facts and terms' });
        } else if (crOf(sub, sc.name)) {
          const cr = crOf(sub, sc.name);
          rows.push({ name: `${sub} · ${sc.name}`, sub: `Chapter report, ${fmtD(String(cr.last).slice(0, 10))}`, score: cr.pct, level: lvl(cr.pct), tag: tagOf(cr.pct), meaning: cr.pct >= 90 ? 'Fully mastered' : cr.pct >= 75 ? 'Building, a little polish' : 'Needs revision before the exam' });
        } else {
          const st = sc.status;
          rows.push({ name: `${sub} · ${sc.name}`, sub: st === 'ongoing' ? 'Being taught now' : st === 'completed' ? 'Taught in class' : 'Not started yet', score: null, level: 'mid', tag: st === 'ongoing' ? 'In progress' : st === 'completed' ? 'No result yet' : 'Coming up', meaning: st === 'completed' ? 'Evaluation result not in this report' : 'Result will follow the evaluation' });
        }
      }
    }
    // up to 3 per subject: weakest scores first, then chapters without a result
    for (const sub of ['Maths', 'Science']) {
      const mine = rows.filter((x) => x.name.startsWith(sub + ' ·')).sort((x, y) => (x.score == null ? 150 : x.score) - (y.score == null ? 150 : y.score));
      snap.push(...mine.slice(0, 3));
    }
  } else {
    const picks = [...new Set([...byPct.slice(0, 2), ...byPct.slice(-2)])].slice(0, 4);
    for (const c of picks) snap.push({ name: `Maths · ${c.name}`, sub: `${c.mastered} of ${c.total} question types`, score: c.pct, level: lvl(c.pct), tag: tagOf(c.pct), meaning: c.gap ? clip(`Next: ${c.gap}`, 50) : c.pct >= 90 ? 'Strong' : 'Needs more practice' });
    for (const [ch, v] of Object.entries(oralBy).slice(0, 2)) {
      const av = Math.round(v.reduce((x, y) => x + y, 0) / v.length);
      snap.push({ name: `Science · ${ch}`, sub: `Oral tests, ${v.length} (key points covered)`, score: av, level: lvl(av, 85, 65), tag: tagOf(av), meaning: av >= 85 ? 'Explains well aloud' : 'Needs exact facts and terms' });
    }
  }
  if (!snap.length) snap.push({ name: 'Maths and Science', sub: 'Chapter results', score: 0, level: 'mid', tag: 'Pending', meaning: 'Chapter results appear after the next evaluation' });

  // mistakes: step slips first, then partial answers, then others; one per question type
  const seen = new Set();
  const picked = [];
  // up to 4 Maths and 2 Science mistakes (whatever is available), Maths first
  for (const [subject, max] of [['Maths', 4], ['Science', 2]]) {
    let n = 0;
    const generic = (mk) => /lost marks in the working|brief and missed|covered only part|left blank/.test(mk.what) || mk.what.length < 40;
    const ranked = candidates
      .filter((x) => x.subject === subject)
      .map((c) => ({ c, mk: mistakeFrom(c) }))
      .filter(({ mk }) => !/unattempted|could not be solved|left blank/i.test(mk.what)) // nothing written to show
      .sort((x, y) => Number(generic(x.mk)) - Number(generic(y.mk)) || (RANK[x.c.status] ?? 5) - (RANK[y.c.status] ?? 5));
    for (const { c, mk } of ranked) {
      const k = subject + mk.type.slice(0, 30);
      if (seen.has(k)) continue;
      seen.add(k);
      picked.push({ c, mk });
      if (++n >= max) break;
    }
  }
  const mistakes = picked.map(({ c, mk }) => ({ photo: c.id, title: `${clip(mk.type, 80)} · ${dFmt(c.date)}`, what: sent(mk.what.replace(/\s*Primary Gap:.*$/i, ''), 300), right: clip(mk.right, 120), tag: mk.tag }));
  const slipTags = new Set(picked.map((p) => p.mk.tag));
  const stepSlips = [...slipTags].filter((t) => /slip|left out/i.test(t));

  // text
  const gain = M.band ? `Maths climbed from band <b>${M.band[0]} to ${M.band[1]}</b>` : M.hlChapter && inSyl('Maths', M.hlChapter) ? `reached <b>${M.hlPct}% mastery in ${M.hlChapter}</b>` : best ? `is strongest in <b>${best.name}</b> (${best.pct}%)` : 'is making steady progress';
  const gainText = `${first} ${gain}`;
  const concern = [];
  if (M.attPct != null && M.attPct < 80) concern.push(`<b>attendance (${M.attPct}%)</b>`);
  if (sheets != null && sheets < 70) concern.push(`<b>practice sheets (${M.sheetsIn} of ${M.sheetsOf})</b>`);
  if (stepSlips.length) concern.push('<b>small slips in the last step</b>');
  const heroAuto = `${older.length ? `Across ${reportsLabel} (${period}), ` : ''}${gainText}${M.attPct != null ? `, with <b>${M.attPct}% attendance</b>` : ''}. ${concern.length ? `The main areas to work on are ${concern.join(', ')}.` : 'The focus now is to keep this rhythm and close the remaining gaps.'}${isBoard ? ' Pre-Boards and Boards cover the whole syllabus, so every chapter matters.' : ''}`;
  const hero = M.newFormat && !older.length && !hasSyl && M.hero ? M.hero : heroAuto;
  const own = M.newFormat && !older.length && !hasSyl; // the monthly report's own wording covers every chapter; with an exam syllabus the text is rebuilt around the exam chapters
  const big = best ? [`${best.pct}%`, `Best chapter mastery<br>${clip(best.name, 28)}`] : [M.attPct != null ? `${M.attPct}%` : '—', 'Attendance<br>this cycle'];

  const nextExam = M.exams.find((e) => e.when !== 'Exam done');
  const talk = own && M.talk && M.talk.length >= 3 ? M.talk.map((x) => x.replace(/\s*\(page \d+\)/g, '')) : [
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
  if (own && M.strengths && M.strengths.length) strengths.splice(0, strengths.length, ...M.strengths.slice(0, 3));
  while (strengths.length < 3) strengths.push(['Responds to improvement classes', 'Steady progress through the chapters', 'Willing to learn'][strengths.length]);
  const workOn = [];
  if (own && M.workOn && M.workOn.length) workOn.push(...M.workOn.slice(0, 3).map((x) => `<b>${x}</b>`));
  else {
  if (stepSlips.length) workOn.push('<b>Last-step and calculation checks</b>');
  if (M.attPct != null && M.attPct < 90) workOn.push(`<b>Attendance and routine</b> (${M.attPct}%)`);
  if (sheets != null && sheets < 90) workOn.push(`<b>Practice sheets</b> at home (${M.sheetsIn} of ${M.sheetsOf})`);
  const lowest = byPct[0];
  if (lowest && lowest.pct < 85) workOn.push(`<b>${lowest.name}</b> (${lowest.pct}%)`);
  if (M.part != null && M.part < 7.5) workOn.push('<b>Speaking up</b> in class');
  for (const x of ['Written answers', 'Revision of earlier chapters', 'Daily practice']) if (workOn.length < 3) workOn.push(`<b>${x}</b>`);
  }

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
  const mO = hasSyl && SYL.Maths ? SYL.Maths.chapters.filter((c) => c.status !== 'completed').map((c) => c.name) : ongoing('Maths');
  const sO = hasSyl && SYL.Science ? SYL.Science.chapters.filter((c) => c.status !== 'completed').map((c) => c.name) : ongoing('Science');
  const mGap = byPct.find((c) => c.pct < 90);
  const goals = {
    maths: { points: [mO[0] ? `Finish “${mO[0]}”` : 'Continue the school chapters', mGap ? `Improvement classes on ${clip(mGap.name, 40)}` : 'Keep up with the next school chapters', isBoard ? 'Revise every chapter, weakest first' : 'Practice sheets after each chapter'], target: mGap ? `${clip(mGap.name, 28)} <em>${mGap.pct}% → 90%+</em>` : 'Every chapter <em>above 90%</em>' },
    science: { points: [sO[0] ? `Finish “${sO[0]}”` : 'Continue the school chapters', 'Answer-writing practice', sO[1] ? `Then “${sO[1]}”` : 'Revise earlier chapters'], target: 'Oral tests and written answers <em>above 80%</em>' },
    basics: { points: M.foundation.length ? M.foundation.map((x) => clip(x, 40)).slice(0, 3) : ['Short drills on basic skills', 'Re-check every final answer'], target: stepSlips.length ? '<em>No last-step slips</em>' : 'Basics <em>checked and clear</em>' },
    habits: { points: ['Fixed class routine', 'Daily 15-minute practice slot'], target: '<em>90%+ attendance</em><br><em>All practice sheets</em> on time' },
  };
  if (hasSyl) {
    if (SYL.Maths) goals.maths.target = `<em>${SYL.Maths.exam}</em> chapters <em>above 80%</em> by ${fmtD(SYL.Maths.date)}`;
    if (SYL.Science) goals.science.target = `<em>${SYL.Science.exam}</em> chapters <em>above 80%</em> by ${fmtD(SYL.Science.date)}`;
  }
  if (M.planRows) {
    const pts = (k) => (M.planRows[k] || []).slice(0, 3).map((x) => clip(x, 60));
    if (pts('Maths').length >= 2) goals.maths.points = pts('Maths');
    if (pts('Science').length >= 2) goals.science.points = pts('Science');
    if (pts('Habits').length >= 2) goals.habits.points = pts('Habits');
  }
  while (goals.maths.points.length < 2) goals.maths.points.push('Practice sheets after each chapter');

  // Support: what we need from home, and what UPRIO will do
  const nm = (x) => clip(x.name, 34);
  const home = [];
  const hd = detail(ctx, parts[0]);
  const lowRows = [...((hd && hd.rows && hd.rows.Maths) || []), ...((hd && hd.rows && hd.rows.Science) || [])].filter((c) => c.pct != null && c.pct < 85).sort((a, b) => a.pct - b.pct);
  if (M.sheetsOf) home.push(M.sheetsIn >= M.sheetsOf ? { lead: `All ${M.sheetsOf} practice sheets submitted.`, body: 'Please keep this routine going: it is a big reason the results are holding.' } : { lead: `Practice sheets: ${M.sheetsIn} of ${M.sheetsOf} submitted.`, body: 'Please remind ' + first + ' daily to finish and submit each sheet.' });
  if (M.attPct != null && M.attPct < 90) home.push({ lead: `Attendance is ${M.attPct}%.`, body: `Please help ${first} join every class on time${M.missed.length ? ' and make up the missed session (' + M.missed[0] + ')' : ''}.` });
  else if (M.missed && M.missed.length) home.push({ lead: 'One missed session.', body: `${M.missed[0]}. Please make sure ${first} joins the next one.` });
  if (M.blank) home.push({ lead: `${M.blank} questions left blank.`, body: 'Encourage attempting every question, even partly: exams give marks for steps.' });
  if (M.fullTest && M.fullTest.length) home.push({ lead: `${M.fullTest.length} chapter${M.fullTest.length === 1 ? '' : 's'} need a full test.`, body: `Please keep the test slots free (${M.fullTest.slice(0, 2).map(nm).join(', ')}${M.fullTest.length > 2 ? ' and more' : ''}).` });
  for (const x of M.help || []) if (home.length < 4 && !home.some((h) => h.lead.split(' ')[0] === x.lead.split(' ')[0])) home.push(x);
  for (const x of [{ lead: '15 minutes a day.', body: 'A short, regular slot works better than long weekend sessions.' }, { lead: 'Encourage and appreciate.', body: `A few minutes talking about what ${first} learnt in class keeps motivation high.` }]) if (home.length < 3) home.push(x);
  const uprio = [];
  if (lowRows.length) uprio.push({ lead: 'Targeted improvement classes.', body: `On ${lowRows.slice(0, 2).map((c) => nm(c) + ' (' + c.pct + '%)').join(' and ')}, weakest first.` });
  if (M.fullTest && M.fullTest.length) uprio.push({ lead: 'Full tests.', body: `On ${M.fullTest.length} chapter${M.fullTest.length === 1 ? '' : 's'} not yet evaluated, so no gap stays hidden.` });
  if ((M.align != null && M.align < 75) || chS.some((c) => c.pct != null && c.pct < 85) || candidates.some((c) => c.subject === 'Science')) uprio.push({ lead: 'Answer-writing practice.', body: 'Key terms and full-marks answers in Science.' });
  if (stepSlips.length || (M.foundation || []).length) uprio.push({ lead: 'Basics and last-step checks.', body: M.foundation && M.foundation.length ? `Short drills on ${M.foundation.slice(0, 2).join(' and ')}.` : 'A final check on every answer.' });
  uprio.push({ lead: 'Regular updates.', body: `A chapter result after each evaluation and a mid-month call with ${s.tm ? s.tm.split(' ')[0] : 'your TM'}.` });
  const support = { home: home.slice(0, 4), uprio: uprio.slice(0, 4) };
  const bigExams = ctx.exams.filter((e) => /Annual|Board/i.test(e)).map((e) => e.split(' · '));
  const dd = (iso) => {
    const d = new Date(iso + 'T12:00:00Z');
    return Number.isNaN(d.getTime()) ? '' : `${d.getUTCDate()} ${d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })}`;
  };
  // each subject in a line or two
  const pct1 = (list) => (list.length ? Math.round(list.reduce((n, c) => n + c.pct, 0) / list.length) : null);
  const mAvg = pct1(chM);
  const mLow = [...chM].sort((x, y) => x.pct - y.pct)[0];
  const mHigh = [...chM].sort((x, y) => y.pct - x.pct)[0];
  const mSlips = [...new Set(picked.filter((p) => p.c.subject === 'Maths').map((p) => p.mk.tag.toLowerCase()).filter((t) => t !== 'mistake'))].slice(0, 3);
  const maths = chM.length
    ? `<b>${mAvg}%</b> average mastery across ${chM.length} exam chapter${chM.length === 1 ? '' : 's'}. Strongest: <b>${clip(mHigh.name, 30)}</b> (${mHigh.pct}%)${mLow && mLow.pct < 90 && mLow !== mHigh ? `; needs work: <b>${clip(mLow.name, 30)}</b> (${mLow.pct}%)` : ''}.${mSlips.length ? ` Slips seen: ${mSlips.join(', ')}.` : ''}`
    : hasSyl && SYL.Maths ? `No evaluation result yet for the ${SYL.Maths.exam} chapters.${(SYL.Maths.chapters.find((c) => c.status === 'ongoing') || {}).name ? ' Being taught now: ' + SYL.Maths.chapters.find((c) => c.status === 'ongoing').name + '.' : ''}` : 'Chapter results will show here after the next evaluation.';
  const oralAvg = M.orals.length ? Math.round(M.orals.reduce((n, o) => n + o.pct, 0) / M.orals.length) : null;
  const sCands = candidates.filter((c) => c.subject === 'Science');
  const sLow = chS.filter((c) => c.pct != null).sort((x, y) => x.pct - y.pct)[0];
  const scCr = hasSyl && SYL.Science ? SYL.Science.chapters.map((c) => ({ c, cr: crOf('Science', c.name) })).filter((x) => x.cr) : [];
  const science = [
    scCr.length ? 'Exam chapters, latest chapter report: ' + scCr.map((x) => `<b>${clip(x.c.name, 46)}</b> (${x.cr.pct}%)`).join(', ') + '.' : '',
    oralAvg != null ? `Oral tests average <b>${oralAvg}%</b> across ${Object.keys(oralBy).length} chapter${Object.keys(oralBy).length === 1 ? '' : 's'}.` : '',
    chS.length && sLow && sLow.pct != null ? `Exam-chapter mastery lowest in <b>${clip(sLow.name, 30)}</b> (${sLow.pct}%).` : '',
    (ctx.evals || []).filter((e) => e.subject === 'Science').length ? `Based on ${(ctx.evals || []).filter((e) => e.subject === 'Science').length} recent evaluation${(ctx.evals || []).filter((e) => e.subject === 'Science').length === 1 ? '' : 's'}.` : '',
    sCands.length ? `${sCands.length} written answer${sCands.length === 1 ? '' : 's'} lost marks, mostly on key points and exact terms.` : '',
  ].filter(Boolean).join(' ') || (hasSyl && SYL.Science ? `No evaluation result yet for the ${SYL.Science.exam} chapters.${(SYL.Science.chapters.find((c) => c.status === 'ongoing') || {}).name ? ' Being taught now: ' + SYL.Science.chapters.find((c) => c.status === 'ongoing').name + '.' : ''}` : 'Science results will show here after the next evaluation.');
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
      subjects: { maths, science },
      examLine,
      detail: detail(ctx, monthlyText),
      support,
      alsoNoticed: also.slice(0, 3),
      writing,
      basics: (M.foundation.length ? M.foundation : ['Basic skills', 'Final-answer checks', 'Daily practice']).slice(0, 3).map((x) => clip(x, 34)),
      exam: hasSyl ? `Upcoming: ${examLine}` : nextExam ? `${nextExam.subject} exam about ${nextExam.date} (${nextExam.when.toLowerCase()})` : '',
      goals,
      annual,
    },
    usage: { auto: true },
  };
}

// Page 2 of the report: what this month's Monthly Learning Report says, for the chapters of the upcoming exam.
function detail(ctx, monthlyText) {
  const part = String(monthlyText || '').split('=== EARLIER CYCLE ===')[0]; // the current month only
  const pages = part.split(/--- page \d+\n/).slice(1);
  if (!pages.length) return null;
  const SYL = ctx.syllabus || {};
  const hasSyl = Object.values(SYL).some((v) => v && v.chapters && v.chapters.length);
  const nz = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const same = (x, y) => {
    const p = nz(x), q = nz(y);
    return p && q && (p === q || p.includes(q) || q.includes(p));
  };
  const first = String(ctx.student.name).split(' ')[0];
  const M = parseMonthly(part, first);
  const flat = (p) => p.replace(/\s+/g, ' ');
  // "Every chapter at a glance": name, score and tag for each chapter of the whole syllabus
  const gp = pages.find((p) => /Every chapter at a glance/i.test(p));
  const glance = { Maths: [], Science: [] };
  if (gp) {
    const g = flat(gp);
    const mi = g.search(/Maths \d+ chapters/);
    const si = g.search(/Science \d+ chapters/);
    const seg = (from, to) => g.slice(from, to < 0 ? undefined : to).replace(/^(Maths|Science) \d+ chapters/, '');
    const parse = (txt) => {
      const out = [];
      const re = /(.+?)\s+(?:(\d+)%\s+(Strong|Polish|Revise first|Building)|(Coming up)|(Test pending))(?=\s|$)/g;
      let m;
      while ((m = re.exec(txt.replace(/UPRIO · Monthly Learning Report.*$/, '')))) out.push({ name: m[1].trim(), pct: m[2] != null ? Number(m[2]) : null, tag: m[3] || m[4] || m[5] });
      return out;
    };
    if (mi >= 0) glance.Maths = parse(seg(mi, si > mi ? si : -1));
    if (si >= 0) glance.Science = parse(seg(si, -1));
  }
  const rows = { Maths: [], Science: [] };
  for (const sub of ['Maths', 'Science']) {
    const list = hasSyl && SYL[sub] ? SYL[sub].chapters : null;
    if (list) {
      for (const sc of list) {
        const g = glance[sub].find((x) => same(x.name, sc.name));
        const mc = M.chapters.find((c) => c.subject === sub && c.pct != null && same(c.name, sc.name));
        const pctV = g && g.pct != null ? g.pct : mc ? mc.pct : null;
        const tag = g ? g.tag : pctV != null ? (pctV >= 90 ? 'Strong' : pctV >= 75 ? 'Polish' : 'Revise first') : sc.status === 'ongoing' ? 'In progress' : 'Coming up';
        rows[sub].push({ name: sc.name, pct: pctV, tag, status: sc.status });
      }
    } else rows[sub] = glance[sub].filter((x) => x.pct != null || x.tag === 'Test pending').slice(0, 12).map((x) => ({ ...x, status: '' }));
  }
  // journeys: "From 43% to 100% in 3 improvement classes" (page 1 of the monthly report)
  const progress = [];
  const p1 = flat(pages[0] || '');
  for (const segm of p1.split(/(?=(?:Maths|Science) · )/).slice(1)) {
    const nm = (segm.match(/^(?:Maths|Science) · (.+?)(?: \d+ question types?| \d+%| Key points|\(oral)/) || [])[1];
    const fr = segm.match(/From (\d+)% to (\d+)% in (\d+) improvement class(?:es)?/);
    const sub = segm.startsWith('Maths') ? 'Maths' : 'Science';
    if (nm && fr && (!hasSyl || (SYL[sub] && SYL[sub].chapters.some((c) => same(c.name, nm))))) progress.push({ subject: sub, chapter: nm.trim(), from: Number(fr[1]), to: Number(fr[2]), classes: Number(fr[3]) });
  }
  // "Also noticed" lines of the monthly report (page 2)
  const np = pages.find((p) => /Also noticed|What we noticed/i.test(p));
  const noticed = [];
  if (np) {
    const body = flat(np).split(/Also noticed/i)[1] || '';
    const txt = body.split(/Basic skills from earlier/i)[0].replace(/UPRIO · Monthly Learning Report.*$/, '').trim();
    for (const sentence of txt.split(/(?<=[.!?])\s+(?=[A-Z])/)) if (sentence.length > 25) noticed.push(sentence.trim());
  }
  // engagement this month, as bars
  const eng = [];
  if (M.attPct != null) eng.push({ label: 'Attendance', value: `${M.attPct}%`, pct: M.attPct, note: `${M.attended} of ${M.classes} classes${M.attPrev != null ? ` · last month ${M.attPrev}%` : ''}` });
  if (M.punct != null) eng.push({ label: 'On time', value: `${M.punct}%`, pct: M.punct, note: 'joined classes on time' });
  if (M.focus != null) eng.push({ label: 'Focus in class', value: `${Math.round(M.focus)}%`, pct: Math.round(M.focus), note: 'average attentiveness' });
  if (M.part != null) eng.push({ label: 'Participation', value: `${M.part}/10`, pct: Math.round(M.part * 10), note: M.words ? `about ${M.words} words per class` : 'speaking in class' });
  if (M.sheetsOf) eng.push({ label: 'Practice sheets', value: `${M.sheetsIn} of ${M.sheetsOf}`, pct: pct(M.sheetsIn, M.sheetsOf), note: 'submitted at home' });
  // priorities before the exam
  const prio = { revise: [], test: [], now: [] };
  for (const sub of ['Maths', 'Science']) for (const c of rows[sub]) {
    if (c.pct != null && c.pct < 75) prio.revise.push(`${c.name} (${sub}, ${c.pct}%)`);
    else if (c.pct == null && c.status === 'completed') prio.test.push(`${c.name} (${sub})`);
    else if (c.pct == null) prio.now.push(`${c.name} (${sub})`);
  }
  return { cycle: M.cycle || '', eng, prio, rows, progress: progress.slice(0, 5), noticed: noticed.slice(0, 4), basics: M.foundation || [], punct: M.punct, missed: (M.missed || []).slice(0, 2), blank: M.blank || 0 };
}
module.exports = { write, parseMonthly, mistakeFrom, detail };
