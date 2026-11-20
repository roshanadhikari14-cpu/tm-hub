// Chapter reports (Lighthouse > Reports > Maths/Science chapter reports): parse the PDF and turn it into a short analysis.
const ST = ['CU', 'UMIS', 'CNC', 'CNS'];
const DATE = /^\d{1,2} [A-Z][a-z]{2}( \(Ab\))?$/;
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const spaced = (l) => String(l).replace(/\s/g, '');

// pages: array of arrays of text lines (from pdfread.pagesText)
function parse(item, pages) {
  const all = pages.flat().map(norm).filter(Boolean);
  const out = { steps: [], cats: [], missed: [], notes: '' };

  // --- journey: mastery % after each class
  const ji = all.findIndex((l) => spaced(l).toUpperCase() === 'CHAPTERJOURNEY');
  if (ji >= 0) {
    const after = all.slice(ji + 1);
    const pcts = after.filter((l) => /^\d{1,3}%$/.test(l)).map((l) => parseInt(l, 10));
    const axis = [0, 25, 50, 75, 100];
    const bars = pcts.slice(0, 5).join() === axis.join() ? pcts.slice(5) : pcts;
    const labels = [];
    for (let i = 0; i < after.length; i++) {
      const l = after[i];
      if (/^Evaluation$/.test(l)) labels.push({ label: 'Evaluation', date: '' });
      else if (/^(Extra )?Improvement Class$/.test(l)) {
        let num = '';
        if (/^\d+( & \d+)*$/.test(after[i + 1] || '')) num = ' ' + after[i + 1];
        labels.push({ label: (l.startsWith('Extra') ? 'Extra class' : 'Class') + num, date: '' });
      } else if (DATE.test(l) && labels.length) {
        const L = labels[labels.length - 1];
        if (/\(Ab\)/.test(l) && !L.date) L.absent = true;
        else if (!L.date) L.date = l.replace(/ \(Ab\)/, '');
      }
      if (/^M ?I ?S ?S ?E ?D/.test(l) || /^Q ?U ?E ?S ?T ?I ?O ?N/.test(l)) break;
    }
    const present = labels.filter((x) => !x.absent);
    const lab = present.length === bars.length ? present : labels;
    out.steps = bars.map((p, i) => ({ pct: p, label: (lab[i] && lab[i].label) || `Step ${i + 1}`, date: (lab[i] && lab[i].date) || '' }));
  }

  // --- missed sessions
  for (const l of all) {
    const m = l.match(/^(.+?) was scheduled for (\d{1,2} [A-Z][a-z]{2})[a-z]* \d{4}, but the student did not attend/);
    if (m) out.missed.push({ what: m[1], date: m[2] });
  }

  // --- narrative
  const ni = all.findIndex((l) => /^Across the chapter/.test(l));
  if (ni >= 0) {
    const txt = [];
    for (let i = ni; i < all.length; i++) {
      if (/^UPRIO · Chapter Report/.test(all[i]) || spaced(all[i]).toUpperCase().startsWith('QUESTIONCATEGORIES')) break;
      txt.push(all[i]);
    }
    out.notes = txt.join(' ');
  }

  // --- question categories timeline: "<name> CU – – CU –"
  const ti = all.findIndex((l) => spaced(l).toUpperCase().startsWith('QUESTIONCATEGORIES—TIMELINE'));
  if (ti >= 0) {
    const isHead = (l) => /^Question Category$/.test(l) || /^Evaluation$/.test(l) || DATE.test(l) || /^(Extra )?Improvement$/.test(l) || /^\d+( & \d+)*$/.test(l);
    let i = ti + 1;
    while (i < all.length && isHead(all[i])) i++;
    let name = [];
    const tail = /(?:^|\s)((?:(?:CU|UMIS|CNC|CNS|–|-)\s*)+)$/;
    for (; i < all.length; i++) {
      const l = all[i];
      if (/^UPRIO · Chapter Report/.test(l)) continue;
      if (/^Question Categories in this Chapter/i.test(l)) break;
      const m = l.match(tail);
      if (m && (name.length || l.replace(tail, '').trim())) {
        const toks = m[1].trim().split(/\s+/).map((t) => (t === '-' ? '–' : t));
        const nm = norm(name.concat(l.replace(tail, '')).join(' '));
        const real = toks.filter((t) => t !== '–');
        out.cats.push({ name: nm, first: real[0] || '', now: real[real.length - 1] || '' });
        name = [];
      } else name.push(l);
    }
  }
  // --- Science chapter reports: knowledge blocks, answer-writing skills, focus areas
  if (all.some((l) => /^S ?C ?I ?E ?N ?C ?E · /.test(l)) || (!out.steps.length && all.some((l) => /KNOWLEDGE BLOCKS/i.test(spaced(l))))) {
    const sci = { blocks: '', aligned: null, structured: null, focus: [], more: 0, answers: 0 };
    const bi = all.findIndex((l) => /^\d+ KNOWLEDGE BLOCKS?/i.test(l));
    if (bi >= 0) sci.blocks = all[bi].replace(/^(\d+) KNOWLEDGE BLOCKS?\s*/i, '$1 knowledge block' + (/^1 /.test(all[bi]) ? '' : 's') + ': ').replace(/: $/, '');
    const am = all.find((l) => /answered \d+ descriptive/.test(l));
    const ac = am && am.match(/answered (\d+) descriptive/);
    if (ac) sci.answers = Number(ac[1]);
    for (let i = 0; i < all.length - 1; i++) {
      if (/^\d{1,3}%$/.test(all[i]) && /^Marks aligned/i.test(all[i + 1])) sci.aligned = parseInt(all[i], 10);
      if (/^\d{1,3}%$/.test(all[i]) && /^Structured/i.test(all[i + 1])) sci.structured = parseInt(all[i], 10);
    }
    const fi = all.findIndex((l) => spaced(l).toUpperCase() === 'WHEREWEWILLFOCUS');
    if (fi >= 0) {
      const STATUS = /^(NOT ATTEMPTED|CONCEPT NOT CLEAR|PARTIALLY UNDERSTOOD|NOT UNDERSTOOD|COULD NOT ANSWER|UNDERSTOOD)$/;
      let cur = null;
      for (let i = fi + 1; i < all.length; i++) {
        const l = all[i];
        if (/^\+ \d+ more/.test(l)) { sci.more = parseInt(l.replace(/^\+ /, ''), 10); break; }
        if (spaced(l).toUpperCase().startsWith('ANSWERWRITINGSKILLSTOIMPROVE') || /^UPRIO · Chapter Report/.test(l)) break;
        const m = l.match(/^(\d{1,2}) (.+)$/);
        if (STATUS.test(l)) { if (cur) { cur.status = l; sci.focus.push(cur); cur = null; } }
        else if (m && !cur) cur = { name: m[2], note: '', status: '' };
        else if (cur) cur.note = (cur.note + ' ' + l).trim();
      }
    }
    out.sci = sci;
  }
  return out;
}

const month = (iso) => new Date(new Date(iso).getTime() + 5.5 * 3600000).toISOString().slice(0, 7);
const fmt = (iso) => new Date(new Date(iso).getTime() + 5.5 * 3600000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const short = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const tidyCat = (s) => s.replace(/\(involving ([^)]+)\)/i, (m, a) => '· ' + a.toLowerCase()).replace(/\s*\((?:using|with)[^)]*\)/i, '').replace(/^Word Problems on /i, 'Word problems: ').replace(/^Problems on /i, '');

// chapters: [{...meta from the API, parsed}] -> view model for the report
function view(chapters, syllabus) {
  const now = month(new Date().toISOString());
  const prevD = new Date(Date.now() + 5.5 * 3600000);
  prevD.setUTCDate(1);
  prevD.setUTCMonth(prevD.getUTCMonth() - 1);
  const prev = prevD.toISOString().slice(0, 7);
  const inExam = (sub, name) => {
    const ch = ((syllabus || {})[sub] || {}).chapters || [];
    const k = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
    return ch.some((c) => String(c.name).toLowerCase().replace(/[^a-z0-9]/g, '') === k);
  };
  const list = (chapters || [])
    .filter((c) => c && c.name)
    .sort((a, b) => String(b.last).localeCompare(String(a.last)))
    .map((c, _i, arr) => {
      const dense = arr.length > 4;
      const sub = c.subject === 'science' ? 'Science' : 'Maths';
      const P = c.parsed || { steps: [], cats: [], missed: [], notes: '' };
      const sci = P.sci;
      const gap = P.cats.filter((x) => ['CNC', 'CNS', 'UMIS'].includes(x.now));
      const fixed = P.cats.filter((x) => ['CNC', 'CNS', 'UMIS'].includes(x.first) && x.now === 'CU');
      const steps = P.steps.length ? P.steps : [];
      const first = steps.length ? steps[0].pct : null;
      const last = steps.length ? steps[steps.length - 1].pct : c.pct;
      const classes = Math.max(0, steps.length - 1);
      const mon = month(c.last);
      const line =
        sci && sci.aligned != null && sci.aligned < 70 ? `Written answers cover about ${sci.aligned}% of the marking points. Practise full-marks answers with every key term.`
        : sci && !sci.aligned && sci.focus.length && sci.focus.every((x) => /NOT ATTEMPTED/.test(x.status)) ? 'The questions of this chapter have not been answered yet, so it needs to be introduced and practised.'
        : c.pct >= 85 ? 'Strong. A short revision test before the exam will keep it fresh.'
        : steps.length > 1 && last > first ? `Improving: ${first}% at the first evaluation to ${last}% after ${classes} improvement class${classes === 1 ? '' : 'es'}.`
        : steps.length > 1 && last === first && classes > 0 ? `Mastery has stayed at ${last}% across ${classes} improvement class${classes === 1 ? '' : 'es'}, so the gap categories need a different approach.`
        : steps.length > 1 && last < first ? `Mastery dipped from ${first}% to ${last}%. This chapter needs revision.`
        : c.pct == null ? '' : 'Evaluated once so far. Improvement classes will follow.';
      return {
        subject: sub,
        name: c.name,
        range: `${fmt(c.first)} – ${fmt(c.last)}`,
        when: mon === now ? 'This month' : mon === prev ? 'Last month' : new Date(c.last).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
        pct: c.pct,
        improvement: c.improvement,
        taught: c.taught,
        mastered: c.mastered,
        steps: steps.slice(-6),
        gaps: sci ? sci.focus.slice(0, 3).map((x) => short(x.name + (x.status ? ' (' + x.status.toLowerCase() + ')' : ''), 54)) : gap.slice(0, dense ? 2 : 3).map((x) => short(tidyCat(x.name), 46)),
        gapMore: sci ? Math.max(0, sci.more + Math.max(0, sci.focus.length - 3)) : Math.max(0, gap.length - (dense ? 2 : 3)),
        sci: sci ? { blocks: sci.blocks, aligned: sci.aligned, structured: sci.structured, answers: sci.answers } : null,
        fixed: fixed.slice(0, dense ? 1 : 2).map((x) => short(tidyCat(x.name), 46)),
        missed: P.missed.slice(0, 2).map((m) => `${m.what} on ${m.date}`),
        line,
        exam: inExam(sub, c.name),
      };
    });
  const withPct = list.filter((c) => c.pct != null);
  const avg = withPct.length ? Math.round(withPct.reduce((n, c) => n + c.pct, 0) / withPct.length) : null;
  const best = [...withPct].sort((a, b) => b.pct - a.pct)[0];
  const low = [...withPct].sort((a, b) => a.pct - b.pct)[0];
  const up = [...list].filter((c) => c.improvement != null).sort((a, b) => b.improvement - a.improvement)[0];
  const miss = list.reduce((n, c) => n + c.missed.length, 0);
  return { list: list.slice(0, 6), total: list.length, avg, best: best ? { name: best.name, pct: best.pct } : null, low: low && low !== best ? { name: low.name, pct: low.pct } : null, up: up && up.improvement > 0 && !(best && up.name === best.name) ? { name: up.name, v: up.improvement } : null, missed: miss };
}
module.exports = { parse, view };
