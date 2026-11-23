// "Create PTM report": builds a 3-page parent plan for one student from Lighthouse, in four steps
// that the browser runs one after another (each fits in one server request):
//   gather  → student, report list, school chapter plan, exams, past PTMs
//   read    → text of a report PDF, and the photos of questions with mistakes
//   write   → Claude writes the plan (JSON) from that material
//   publish → PDF in the UPRIO design, uploaded to the Google Drive folder
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const pdfread = require('./pdfread');
const T = require('./ptmTemplate');
const PA = require('./ptmAuto');
const CH = require('./ptmChapters');
const G = require('./google');

const BASE = 'https://backend.uprio.com/api/v2/';
const MODEL = 'claude-opus-5-5';
const GRADE_IDS = { 6: '65a62b9fbd260fbc50701e1b', 7: '65a62b9fbd260fbc50701e1c', 8: '65a62b9fbd260fbc50701e1f' };

function headers() {
  const h = { Accept: 'application/json' };
  if (process.env.LIGHTHOUSE_AUTH) h.Authorization = process.env.LIGHTHOUSE_AUTH;
  if (process.env.LIGHTHOUSE_COOKIE) h.Cookie = process.env.LIGHTHOUSE_COOKIE;
  return h;
}
async function lh(p) {
  const r = await fetch(BASE + p, { headers: headers() });
  if (r.status === 401 || r.status === 403) throw new Error('Lighthouse refused the login. Paste a fresh login in Settings.');
  if (!r.ok) throw new Error(`Lighthouse HTTP ${r.status} for ${p.split('?')[0]}`);
  const j = await r.json();
  return j.data ?? j;
}
const arr = (d) => (Array.isArray(d) ? d : (d && (d.docs || d.reports || d.items)) || []);
const day = (x) => (x ? String(x).slice(0, 10) : '');
const istDay = (x) => (x ? new Date(new Date(x).getTime() + 5.5 * 3600000).toISOString().slice(0, 10) : '');
const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// ---------- 1. gather ----------
async function gather(studentId, latest, win) {
  win = ['30', '60', 'all'].includes(String(win)) ? String(win) : '30';
  const id = Number(studentId);
  if (!id) throw new Error('Enter a valid student ID.');
  const found = arr((await lh(`student-learning/search?q=${id}`)).students).find((s) => Number(s.studentId) === id);
  if (!found) throw new Error(`Student ${id} was not found in Lighthouse.`);
  // School and batch from the hub's latest pull (all TMs' students).
  let hub = null;
  for (const list of Object.values((latest && latest.students) || {})) {
    hub = (list || []).find((s) => Number(s.id) === id);
    if (hub) break;
  }
  const [monthly, mathEval, sciEval, examDocs, ptms, mathCh, sciCh] = await Promise.all([
    lh(`learning-process-tasks/monthly-updates/student/${id}`).catch(() => []),
    lh(`learning-process-tasks/evaluation-reports/student/${id}?subject=math`).catch(() => []),
    lh(`learning-process-tasks/evaluation-reports/student/${id}?subject=science`).catch(() => []),
    lh(`exam-paper-student-reports?studentId=${id}`).catch(() => null),
    lh(`parent-addon-sessions/tm-meetings?studentId=${id}`).catch(() => []),
    lh(`learning-process-tasks/chapter-reports/student/${id}?subject=math`).catch(() => []),
    lh(`learning-process-tasks/chapter-reports/student/${id}?subject=science`).catch(() => []),
  ]);
  const months = arr(monthly).filter((r) => r.pdfUrl && r.status === 'completed').sort((a, b) => String(b.reportMonth).localeCompare(String(a.reportMonth)));
  const m = months[0];
  const earlier = months.slice(1, win === '30' ? 1 : win === '60' ? 2 : 6);
  const since = win === 'all' ? '0000-00-00' : new Date(Date.now() - (win === '60' ? 75 : 45) * 86400000).toISOString().slice(0, 10);
  const perSubject = win === 'all' ? 4 : win === '60' ? 3 : 2;
  const pick = (list, subject) =>
    arr(list)
      .filter((r) => r.pdfUrl && r.status === 'completed' && day(r.evalDate || r.generatedAt) >= since)
      .sort((a, b) => String(b.evalDate || b.generatedAt).localeCompare(String(a.evalDate || a.generatedAt)))
      .slice(0, perSubject)
      .map((r) => ({ url: r.pdfUrl, subject, date: day(r.evalDate || r.generatedAt), chapters: r.chapterName || '' }));
  let evals = [...pick(mathEval, 'Maths'), ...pick(sciEval, 'Science')];

  // Chapter reports: this month and last month (30-day window), more for the longer windows
  const nowIst = new Date(Date.now() + 5.5 * 3600000);
  const prevStart = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const chSince = win === 'all' ? '0000-00-00' : win === '60' ? new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10) : prevStart;
  let chapterReports = [...arr(mathCh), ...arr(sciCh)]
    .filter((r) => r.pdfUrl && r.status === 'completed' && day(r.lastClassDate || r.generatedAt) >= chSince)
    .sort((a, b) => String(b.lastClassDate || b.generatedAt).localeCompare(String(a.lastClassDate || a.generatedAt)))
    .slice(0, win === 'all' ? 60 : 8)
    .map((r) => ({ url: r.pdfUrl, subject: r.subject, name: r.chapterName, first: r.firstClassDate, last: r.lastClassDate || r.generatedAt, taught: r.taught, mastered: r.mastered, pct: r.masteryPct, improvement: r.improvementPct }));
  let examReports = arr(examDocs && examDocs.docs ? examDocs.docs : examDocs)
    .filter((d) => d && d.report && d.examName)
    .slice(0, 4)
    .map((d) => ({ subject: d.subjectName, exam: d.examName, date: day(d.examDate), taught: d.report.taughtPct, evaluated: d.report.evaluatedPct, chapters: d.syllabusChapters }));

  // School chapter plan for the student's own batch, and upcoming exams.
  const schoolId = hub && hub.schoolId;
  const gradeId = (arr(examDocs)[0] || {}).gradeId || GRADE_IDS[Number(found.gradeName)];
  const batchNo = hub && (String(hub.batch || '').match(/Batch \d+/) || [])[0];
  const plan = [];
  const exams = [];
  const syllabus = {}; // the chapters of each subject's next exam (from the school planner)
  if (schoolId && gradeId) {
    const ex = await lh(`students/schools/${schoolId}/exam-schedules?academicYear=2026-27&gradeId=${gradeId}`).catch(() => null);
    const target = {}; // subject -> the earliest exam still to be written (today counts)
    for (const e of (ex && ex.examSchedules) || [])
      for (const s of e.subjects || []) {
        if (!['Maths', 'Science'].includes(s.subjectName) || istDay(s.examDate) < istToday()) continue;
        const d = istDay(s.examDate);
        if (!target[s.subjectName] || d < target[s.subjectName].date) target[s.subjectName] = { id: e.id, name: e.examName, date: d, confirmed: !!s.isSyllabusConfirmed };
      }
    for (const subj of ['Maths', 'Science']) {
      const cp = await lh(`school-planner/chapter-planning?schoolId=${schoolId}&gradeId=${gradeId}&subjectName=${subj}&academicYear=2026-27`).catch(() => null);
      if (!cp) continue;
      const B = (cp.batches || []).find((b) => batchNo && b.batchName.startsWith(batchNo + ' '));
      if (!B) continue;
      const mine = (cp.rows || []).map((r) => ({ r, b: (r.batches || []).find((x) => x.batchId === B.batchId) })).filter((x) => x.b);
      const tg = target[subj];
      const nextOf = (x) => (x.r.examMappings || []).find((e) => (tg ? e.examId === tg.id : e.kind === 'next'));
      let inExam = mine.filter((x) => nextOf(x));
      const official = inExam.filter((x) => x.r.confidence && x.r.confidence.level === 'confirmed');
      if (((tg && tg.confirmed) || (!tg && cp.exams && cp.exams.next && cp.exams.next.isSyllabusConfirmed)) && official.length) inExam = official;
      if (inExam.length) {
        const ex0 = nextOf(inExam[0]);
        syllabus[subj] = { exam: ex0.examName, date: istDay(ex0.examDate), status: '', chapters: [...new Map(inExam.map((x) => [String(x.r.chapterName).toLowerCase().trim(), { name: x.r.chapterName, status: x.b.status }])).values()] };
      }
      const rows = mine
        .filter((x) => x.b && x.b.status !== 'completed')
        .sort((a, b) => (a.b.queuePosition ?? 99) - (b.b.queuePosition ?? 99))
        .slice(0, 8);
      for (const { r, b } of rows)
        plan.push(`${subj}: ${r.chapterName} — ${b.status}${b.estimatedTeachCompletionOn ? `, expected done ${day(b.estimatedTeachCompletionOn)}` : ''}${(r.examMappings || []).filter((e) => e.kind !== 'over').map((e) => `, in ${e.examName} (${day(e.examDate)})`).join('')}`);
    }
    for (const e of (ex && ex.examSchedules) || [])
      for (const s of e.subjects || []) if (['Maths', 'Science'].includes(s.subjectName) && istDay(s.examDate) >= istToday()) {
        if (syllabus[s.subjectName] && syllabus[s.subjectName].exam === e.examName) syllabus[s.subjectName].status = s.dateStatus || '';
        exams.push(`${e.examName} · ${s.subjectName} · ${istDay(s.examDate)} (${s.dateStatus})`);
      }
  }
  // The exam's own chapters always get their latest reports, even when they are older than the 30-day window
  // (a Science chapter taught in September still matters for a late-November exam).
  const nm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');
  const subjOf = (s) => (String(s).toLowerCase().startsWith('sci') ? 'Science' : 'Maths');
  const inSyl = (sub, name) => {
    const l = syllabus[sub] && syllabus[sub].chapters;
    return !!l && l.some((c) => nm(c.name) === nm(name));
  };
  const hasSyl = Object.keys(syllabus).length > 0;
  // Since joining there can be dozens of chapters: only the exam's own chapters get their answer photos read
  if (win === 'all') chapterReports = chapterReports.map((x) => ({ ...x, noPhotos: hasSyl ? !inSyl(subjOf(x.subject), x.name) : true }));
  if (hasSyl) {
    // only the upcoming exam's coverage strip, not an old one
    examReports = examReports.filter((e) => syllabus[e.subject] && syllabus[e.subject].exam === e.exam);
    const have = new Set(chapterReports.map((c) => subjOf(c.subject) + nm(c.name)));
    const extra = [...arr(mathCh), ...arr(sciCh)]
      .filter((r) => r.pdfUrl && r.status === 'completed' && r.chapterName && inSyl(subjOf(r.subject), r.chapterName) && !have.has(subjOf(r.subject) + nm(r.chapterName)))
      .sort((a, b) => String(b.lastClassDate || b.generatedAt).localeCompare(String(a.lastClassDate || a.generatedAt)))
      .map((r) => ({ url: r.pdfUrl, subject: r.subject, name: r.chapterName, first: r.firstClassDate, last: r.lastClassDate || r.generatedAt, taught: r.taught, mastered: r.mastered, pct: r.masteryPct, improvement: r.improvementPct }));
    chapterReports = [...chapterReports, ...extra];
    // evaluations that covered an exam chapter (latest two per subject, beyond the date window)
    const haveEv = new Set(evals.map((e) => e.url));
    for (const [list, sub] of [[mathEval, 'Maths'], [sciEval, 'Science']]) {
      const more = arr(list)
        .filter((r) => r.pdfUrl && r.status === 'completed' && !haveEv.has(r.pdfUrl) && String(r.chapterName || '').split(/\s*,\s*/).some((n) => n && inSyl(sub, n)))
        .sort((a, b) => String(b.evalDate || b.generatedAt).localeCompare(String(a.evalDate || a.generatedAt)))
        .slice(0, Math.max(0, 3 - evals.filter((e) => e.subject === sub).length))
        .map((r) => ({ url: r.pdfUrl, subject: sub, date: day(r.evalDate || r.generatedAt), chapters: r.chapterName || '' }));
      evals = [...evals, ...more];
    }
  }
  const meetings = arr(ptms)
    .slice(-4)
    .map((p) => `${p.date} ${p.status}${p.meta && p.meta.agenda ? ` — agenda: ${p.meta.agenda}` : ''}`);
  return {
    student: { id, name: found.studentName, grade: String(found.gradeName || ''), school: found.schoolName || (hub && hub.school) || '', tm: found.tmName || '' },
    window: win,
    monthly: m ? { url: m.pdfUrl, month: m.reportMonth } : null,
    earlier: earlier.map((r) => ({ url: r.pdfUrl, month: r.reportMonth })),
    evals,
    chapterReports,
    examReports,
    plan,
    syllabus,
    exams,
    meetings,
  };
}

// ---------- 2. read ----------
// The student's own handwriting is a coloured photo; the plain question image has no colour and is mostly white.
const ownWork = (p) => p.sat >= 10 && p.flat < 0.7 && p.lum < 245;
const STATUS = /^(FULLY UNDERSTOOD|UNDERSTANDS CONCEPT, MISTAKE IN STEPS|MISTAKE IN STEPS|CONCEPT NOT CLEAR|COULD NOT SOLVE|COULD NOT ANSWER|NOT UNDERSTOOD|NOT ATTEMPTED|PARTIALLY UNDERSTOOD)$/;
const RANK = { 'UNDERSTANDS CONCEPT, MISTAKE IN STEPS': 0, 'MISTAKE IN STEPS': 0, 'PARTIALLY UNDERSTOOD': 1, 'CONCEPT NOT CLEAR': 2, 'NOT UNDERSTOOD': 2, 'COULD NOT SOLVE': 3, 'COULD NOT ANSWER': 3, 'NOT ATTEMPTED': 4 };
const tidy = (s) => s;
async function read(item, kind, tag) {
  const r = await fetch(item.url);
  if (!r.ok) throw new Error(`Could not download a report (HTTP ${r.status}).`);
  const doc = await pdfread.open(Buffer.from(await r.arrayBuffer()));
  const pages = await pdfread.pagesText(doc);
  if (kind === 'chapter') {
    const parsed = CH.parse(item, pages);
    const subj = item.subject === 'science' ? 'Science' : 'Maths';
    const cands = [];
    const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');
    const MAP = { 'UNDERSTOOD WITH MISTAKE IN STEPS': 'UNDERSTANDS CONCEPT, MISTAKE IN STEPS', 'UNDERSTANDS CONCEPT, MISTAKE IN STEPS': 'UNDERSTANDS CONCEPT, MISTAKE IN STEPS', 'CONCEPT NOT CLEAR': 'CONCEPT NOT CLEAR', 'COULD NOT SOLVE': 'COULD NOT SOLVE' };
    for (let i = 0; i < pages.length && cands.length < 4 && !item.noPhotos; i++) {
      const lines = pages[i];
      if (subj === 'Science') {
        // written answers: same layout as the evaluation reports
        const q = lines.findIndex((l) => /^Q\d+ · /.test(l));
        const st = lines.find((l) => STATUS.test(l));
        if (q < 0 || !st || st === 'FULLY UNDERSTOOD') continue;
        const si = lines.indexOf(st);
        const photos = await pdfread.pagePhotos(doc, i + 1);
        const best = photos.filter((p) => ownWork(p)).sort((a, b) => b.w * b.h - a.w * a.h)[0];
        if (!best) continue;
        cands.push({ id: `${tag || 'C.'}${cands.length + 1}`, subject: 'Science', chapters: item.name, date: day(item.last), status: st, type: lines.slice(q, Math.max(q + 1, si - 1)).join(' ').replace(/^Q\d+ · /, ''), text: lines.slice(q, q + 90).join(' ').slice(0, 1400), photo: best.b64 });
        continue;
      }
      // Maths: "Question Category k of N: <name>" pages with the student's own working
      const hi = lines.findIndex((l) => /^Question Category \d+ of \d+:/.test(l));
      const sl = lines.findIndex((l) => /^STATUS: /.test(l));
      if (hi < 0 || sl < 0) continue;
      const stRaw = lines[sl].replace(/^STATUS: /, '').trim().toUpperCase();
      if (/COMPLETELY UNDERSTOOD|FULLY UNDERSTOOD/.test(stRaw)) continue;
      const status = MAP[stRaw] || 'CONCEPT NOT CLEAR';
      const head = lines[hi].replace(/^Question Category \d+ of \d+: /, '');
      const cat = (parsed.cats || []).find((c) => norm(c.name).startsWith(norm(head).slice(0, 22)) || norm(head).startsWith(norm(c.name).slice(0, 22)));
      const ei = lines.findIndex((l) => /^CONCEPTUAL EVALUATION/.test(l));
      const gi = lines.findIndex((l) => /^Primary gap/i.test(l));
      const evalText = ei >= 0 ? lines.slice(ei + 1, gi > ei ? gi : ei + 6).join(' ').replace(/^(?:In)?correct Process Followed\s*/i, '').trim() : '';
      const gap = gi >= 0 ? lines[gi].replace(/^Primary gap:?\s*/i, '').trim() : '';
      // only real slips: the evaluator's note must describe a mistake (not just a correct method)
      if (!/mistake|error|incorrect|wrong|missed|miss(?:ing)?\b|fail|omit|forgot|did not|didn't|not (?:correctly|complete|apply|follow)|miscalc|instead of|slip|confus|unable/i.test(evalText + ' ' + gap) || (/^none/i.test(gap) && !/incorrect|wrong|missed|fail|error|mistake/i.test(evalText))) continue;
      const photos = await pdfread.pagePhotos(doc, i + 1);
      const best = photos.filter((p) => ownWork(p)).sort((a, b) => b.w * b.h - a.w * a.h)[0];
      if (!best) continue;
      const k =(lines[hi].match(/Category (\d+) of/) || [])[1];
      const type = cat ? cat.name : head;
      cands.push({ id: `${tag || 'C.'}${cands.length + 1}`, subject: 'Maths', chapters: item.name, date: day(item.last), status, type, text: `Q${k} · ${type} ${status} AI-Powered ${evalText} ${gap ? 'Primary Gap: ' + gap + '.' : ''}`.slice(0, 1400), photo: best.b64 });
    }
    return { chapter: { ...item, parsed }, candidates: cands };
  }
  if (kind === 'monthly') return { text: tidy(pages.map((p, i) => `--- page ${i + 1}\n${p.join('\n')}`).join('\n')).slice(0, 70000) };
  const cands = [];
  for (let i = 0; i < pages.length; i++) {
    const lines = pages[i];
    const q = lines.findIndex((l) => /^Q\d+ · /.test(l));
    const st = lines.find((l) => STATUS.test(l));
    if (q < 0 || !st || st === 'FULLY UNDERSTOOD') continue;
    const si = lines.indexOf(st);
    cands.push({ page: i + 1, status: st, type: tidy(lines.slice(q, Math.max(q + 1, si - 1)).join(' ')).replace(/^Q\d+ · /, ''), text: tidy(lines.slice(q, q + 90).join(' ')).slice(0, 1400) });
  }
  cands.sort((a, b) => (RANK[a.status] ?? 5) - (RANK[b.status] ?? 5));
  const out = [];
  for (const c of cands.slice(0, 12)) {
    const photos = await pdfread.pagePhotos(doc, c.page);
    if (!photos.length) continue;
    // Only the student's own work counts: a coloured photo, not the plain white question image.
    const best = photos.filter((p) => ownWork(p)).sort((a, b) => b.w * b.h - a.w * a.h)[0];
    if (!best) continue;
    out.push({ id: `${tag}${out.length + 1}`, subject: item.subject, chapters: item.chapters || '', date: item.date, status: c.status, type: c.type, text: c.text, photo: best.b64 });
    if (out.length >= 5) break;
  }
  return { candidates: out };
}

// ---------- 3. write ----------
const S = (props, req = Object.keys(props)) => ({ type: 'object', properties: props, required: req, additionalProperties: false });
const str = { type: 'string' };
const strs = (n) => ({ type: 'array', items: str, minItems: n, maxItems: n });
const SCHEMA = S({
  hero: str,
  big: strs(2),
  talk: strs(4),
  stats: { type: 'array', minItems: 4, maxItems: 4, items: S({ value: str, label: str, level: { type: 'string', enum: ['ok', 'mid', 'warn'] }, tag: str }) },
  snapshot: { type: 'array', minItems: 3, maxItems: 5, items: S({ name: str, sub: str, score: { type: 'integer' }, level: { type: 'string', enum: ['ok', 'mid', 'warn'] }, tag: str, meaning: str }) },
  strengths: strs(3),
  workOn: strs(3),
  mistakesIntro: str,
  subjects: S({ maths: str, science: str }),
  mistakes: { type: 'array', minItems: 0, maxItems: 6, items: S({ photo: str, title: str, what: str, right: str, tag: str }) },
  alsoNoticed: { type: 'array', items: str, minItems: 1, maxItems: 3 },
  writing: str,
  basics: strs(3),
  exam: str,
  goals: S(Object.fromEntries(['maths', 'science', 'basics', 'habits'].map((k) => [k, S({ points: { type: 'array', items: str, minItems: 2, maxItems: 3 }, target: str })]))),
  annual: str,
});

const SYSTEM = `You write a one-to-one PTM (parent-teacher meeting) plan for a UPRIO student, from the student's Lighthouse reports. A Tutor Manager reads it with the parents. It must be clear, warm, respectful to parents, and specific.

Rules:
- Use only facts and numbers present in the material. Never invent scores, dates or chapters. If something is missing, leave it out.
- Refer to the student by first name. Do not use he/she/him/her/his/hers; repeat the first name or rephrase.
- Start positive (real achievements), then the 2–3 things to improve. No week-by-week schedule.
- "Mistakes" are small, fixable slips (calculation, decimal point, units, a skipped step, a missed part of the question, a wrong fact in a written answer), shown with the student's own work. Look at each photo yourself: pick only photos where the mistake is clearly visible and you agree it is a mistake. If the working in a photo is actually correct, do not use it. Prefer 3 (max 4); fewer is fine if the photos are unclear. "right" gives the correct value or method, and you must check any arithmetic yourself.
- Show up to 4 Maths mistakes (candidate ids start with M) and up to 2 Science mistakes (ids start with S). If a subject has fewer good photos, show what is available; never pad with unclear ones.
- subjects: "maths" and "science" are each ONE or TWO short sentences on how that subject is going (real numbers only), for example the average chapter mastery and the strongest and weakest chapter; for Science the oral/answer-writing results.
- For each mistake, "photo" is the candidate id (for example M1). "tag" is 1–2 words such as "Decimal slip", "Unit slip", "Step skipped", "Part missed".
- Short sentences. Simple HTML only: <b> for emphasis, <em> inside goal aims, <br> in stat labels. No other tags.
- hero: 2–3 sentences. big: [a short headline number, a 2-line label using <br>]. talk: 4 discussion points for the meeting.
- stats: attendance, focus, participation, practice sheets (value like "74%" or "0 of 5"; label 2 lines with <br>; tag 1–2 words).
- snapshot: 3–5 rows of chapter or subject results, score 0–100.
- goals: for maths, science, basics and habits: points = 2–3 very short actions for this month (a few words each, e.g. “Finish “Light: Mirrors and Lenses””, “Daily 15-minute practice slot”), following the school chapter plan given; target = what success looks like by month-end, short, with the key part in <em>…</em> (e.g. “Light <em>70% → 85%+</em>”). exam: one line about a school exam this month, or "" if none. annual: e.g. "Annual Exams (about 8 March Maths, 12 March Science, to be confirmed)".
- If "Upcoming exam syllabus" is given, talk ONLY about those chapters (snapshot rows, strengths, work-on, mistakes, goals). Chapters outside it are not part of this report.
- If the material includes a past PTM agenda with a parent concern, address that concern directly in hero or talk points.`;

async function write(ctx, monthlyText, candidates, month, chapters) {
  const out = await writeCore({ ...ctx, chapterData: (chapters || []).map((c) => ({ subject: c.subject, name: c.name, pct: c.pct, last: c.last })) }, monthlyText, candidates, month);
  const cur = {};
  for (const sub of ['Maths', 'Science']) for (const r of (out.plan.detail && out.plan.detail.rows && out.plan.detail.rows[sub]) || []) if (r.pct != null) cur[r.name] = r.pct;
  const v = CH.view((chapters || []).map((c) => ({ ...c, parsed: c.parsed })), ctx.syllabus, cur, ctx.window === 'all');
  v.exams = ctx.examReports || [];
  out.plan.chapters = v.list.length || v.exams.length ? v : null;
  return out;
}
async function writeCore(ctx, monthlyText, candidates, month) {
  // Free mode: without a Claude API key the plan is written from the reports directly, with no AI.
  if (!process.env.ANTHROPIC_API_KEY) return PA.write(ctx, monthlyText, candidates, month);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 240000, maxRetries: 1 });
  const s = ctx.student;
  const intro = `Student: ${s.name} · Grade ${s.grade} · ${s.school} · Tutor Manager: ${s.tm}
Plan month: ${month}
School chapter plan for the student's batch (next chapters):
${ctx.plan.join('\n') || '(not available)'}
Upcoming exam syllabus (only these chapters matter):
${Object.entries(ctx.syllabus || {}).map(([sub, v]) => `${sub} · ${v.exam} on ${v.date}${v.status ? ' (' + v.status + ')' : ''}: ${v.chapters.map((c) => c.name + ' [' + c.status + ']').join('; ')}`).join('\n') || '(not available)'}

Upcoming school exams (Maths/Science):
${ctx.exams.join('\n') || '(none listed)'}
Recent PTMs with this family:
${ctx.meetings.join('\n') || '(none)'}

MONTHLY LEARNING REPORT (text):
${monthlyText || '(not available)'}

CANDIDATE MISTAKES (evaluator notes; the photo of the student's work follows each):`;
  const content = [{ type: 'text', text: intro }];
  for (const c of candidates) {
    content.push({ type: 'text', text: `\n[${c.id}] ${c.subject} evaluation ${c.date} · status: ${c.status}\n${c.text}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: c.photo } });
  }
  content.push({ type: 'text', text: 'Write the plan now as JSON matching the schema.' });
  const resp = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content }],
  });
  if (resp.stop_reason === 'refusal') throw new Error('The AI declined to write this report. Please try again.');
  if (resp.stop_reason === 'max_tokens') throw new Error('The AI ran out of space writing the report. Please try again.');
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let plan;
  try {
    plan = JSON.parse(text);
  } catch {
    throw new Error('The AI returned an unreadable report. Please try again.');
  }
  const ids = new Set(candidates.map((c) => c.id));
  const subj = new Map(candidates.map((c) => [c.id, c.subject]));
  const left = { Maths: 4, Science: 2 };
  plan.mistakes = (plan.mistakes || [])
    .filter((m) => ids.has(m.photo))
    .filter((m) => (left[subj.get(m.photo)]-- > 0))
    .sort((a, b) => (subj.get(a.photo) === 'Maths' ? 0 : 1) - (subj.get(b.photo) === 'Maths' ? 0 : 1));
  plan.detail = PA.detail(ctx, monthlyText);
  return { plan, usage: resp.usage };
}

// ---------- 4. publish ----------
const clean = (s) =>
  String(s ?? '')
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/&lt;(\/?)(b|em|small)&gt;/g, '<$1$2>')
    .replace(/&lt;br\s*\/?&gt;/g, '<br>');
function toStudent(ctx, plan, photos, month) {
  const s = ctx.student;
  const [mn, yr] = month.split(' ');
  const next = new Date(`${mn} 1, ${yr}`);
  next.setMonth(next.getMonth() + 1);
  return {
    id: s.id,
    name: clean(s.name),
    first: clean(String(s.name).split(' ')[0]),
    grade: clean(s.grade),
    school: clean(s.school),
    tm: clean(s.tm),
    month: clean(month),
    monthName: clean(mn),
    nextMonthName: next.toLocaleDateString('en-GB', { month: 'long' }),
    hero: clean(plan.hero),
    big: plan.big.map(clean),
    talk: plan.talk.map(clean),
    stats: plan.stats.map((x) => [clean(x.value), clean(x.label), x.level, clean(x.tag)]),
    snapshot: plan.snapshot.map((x) => [clean(x.name), clean(x.sub), x.score == null ? null : Math.max(0, Math.min(100, Number(x.score) || 0)), x.level, clean(x.tag), clean(x.meaning)]),
    strengths: plan.strengths.map(clean),
    workOn: plan.workOn.map(clean),
    mistakesIntro: clean(plan.mistakesIntro),
    subjects: plan.subjects ? { maths: clean(plan.subjects.maths), science: clean(plan.subjects.science) } : null,
    mistakes: plan.mistakes.filter((m) => photos[m.photo]).map((m) => ({ img: `data:image/jpeg;base64,${photos[m.photo]}`, title: clean(m.title), what: clean(m.what), right: clean(m.right), tag: clean(m.tag) })),
    alsoNoticed: plan.alsoNoticed.map(clean),
    writing: clean(plan.writing),
    basics: plan.basics.map(clean),
    exam: plan.exam ? clean(plan.exam) : null,
    goals: Object.fromEntries(Object.entries(plan.goals).map(([k, v]) => [k, [v.points.map(clean), clean(v.target)]])),
    annual: clean(plan.annual),
    period: clean(plan.period || ''),
    examLine: clean(plan.examLine || ''),
    detail: plan.detail || null,
    chapters: plan.chapters || null,
    support: plan.support || null,
  };
}

async function pdf(html) {
  const puppeteer = await import('puppeteer-core').then((m) => m.default || m);
  let browser;
  if (process.env.VERCEL) {
    const chromium = await import('@sparticuz/chromium').then((m) => m.default || m);
    browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  } else {
    // On this PC: Chrome first (Edge tends to hand over to an already-open Edge window and exit).
    const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
    if (!exe) throw new Error('No Chrome or Edge found to make the PDF.');
    const profile = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tmhub-pdf-'));
    browser = await puppeteer.launch({ executablePath: exe, headless: true, userDataDir: profile, args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions'] });
  }
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
  } finally {
    await browser.close().catch(() => {});
  }
}

async function upload(buf, name, folderId) {
  const at = await G.accessToken();
  const boundary = 'tmhub' + Date.now();
  const meta = { name, mimeType: 'application/pdf', parents: [folderId] };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
    buf,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${at}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j.error && j.error.message) || `HTTP ${r.status}`;
    if (r.status === 403 && /scope|insufficient/i.test(msg)) throw new Error('Google Drive access is not allowed yet. In Settings, connect Google again and allow Drive.');
    if (r.status === 404) throw new Error('The Drive folder was not found, or the connected Google account cannot open it.');
    throw new Error(`Google Drive refused the upload: ${msg}`);
  }
  return j;
}

async function publish(ctx, plan, photos, month, folderId) {
  const st = toStudent(ctx, plan, photos, month);
  const file = await pdf(T.html(st));
  const name = `${ctx.student.name} - ${month} PTM Plan.pdf`;
  const out = { name, bytes: file.length, pdf: file.toString('base64') };
  // Saving to Drive is a bonus when the owner's Google account is connected; the download always works.
  if (folderId && G.account()) {
    try {
      const up = await upload(file, name, folderId);
      out.link = up.webViewLink;
    } catch (e) {
      out.driveNote = e.message;
    }
  }
  return out;
}

module.exports = { gather, read, write, publish, toStudent, pdf, MODEL };
