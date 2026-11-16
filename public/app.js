/* TM Hub front end: hash-routed single page, no build step. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');

const S = { slot: null, data: null, status: null, tasks: [] };
const SLOT_LABEL = { morning: '11 AM tasks', progress: '5 PM progress', closure: '8 PM closure' };
const STATUS_LABEL = { clear: 'All clear', ok: 'On track', watch: 'Watch', critical: 'Needs attention' };

document.body.insertAdjacentHTML(
  'beforeend',
  `<svg width="0" height="0" style="position:absolute"><defs>
    <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fb5ac"/><stop offset="1" stop-color="#0d5c63"/></linearGradient>
    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12808a" stop-opacity=".28"/><stop offset="1" stop-color="#12808a" stop-opacity="0"/></linearGradient>
  </defs></svg>`
);

// ---------- helpers ----------
async function api(path, opts) {
  const res = await fetch(path, opts && opts.body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts.body) } : opts);
  const j = await res.json().catch(() => ({}));
  if (res.status === 401 && j.login) showLogin(j);
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
  return j;
}
// Shown instead of the hub when it is on the internet and nobody is signed in.
function showLogin(j) {
  if ($('#loginScreen')) return;
  const d = document.createElement('div');
  d.id = 'loginScreen';
  d.innerHTML = `<div class="login-card"><span class="brand-mark"><svg viewBox="0 0 64 64"><path d="M14 42l12-14 10 8 14-18" /></svg></span><h2>TM Hub</h2><p>Sign in with your <b>@${esc(j.domain || 'uprio.com')}</b> Google account to continue.</p>${j.clientReady ? '<a class="btn btn-primary" href="/auth/login">Sign in with Google</a>' : '<p class="note">Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the Vercel project settings.</p>'}</div>`;
  document.body.append(d);
}
function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => {
    t.classList.add('hide');
    setTimeout(() => t.remove(), 400);
  }, type === 'err' ? 7000 : 3800);
}
function confirmBox(title, text, okLabel = 'Confirm') {
  return new Promise((resolve) => {
    const m = $('#modal');
    $('#modalCard').innerHTML = `<h3>${esc(title)}</h3><div class="note" style="font-size:14px">${text}</div><div class="actions"><button class="btn btn-ghost" data-x="0">Cancel</button><button class="btn btn-primary" data-x="1">${esc(okLabel)}</button></div>`;
    m.hidden = false;
    const done = (v) => {
      m.hidden = true;
      m.onclick = null;
      resolve(v);
    };
    m.onclick = (e) => {
      if (e.target === m) done(false);
      const b = e.target.closest('[data-x]');
      if (b) done(b.dataset.x === '1');
    };
  });
}
const photo = (r) => `photos/${encodeURIComponent(r.photo || '')}`;
const pill = (st, label) => `<span class="pill ${st}">${esc(label || STATUS_LABEL[st])}</span>`;
function ring(score, cls = '') {
  const r = 42;
  const c = 2 * Math.PI * r;
  return `<div class="ring ${cls}" data-ring="${score}"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="${r}"/><circle class="bar" cx="50" cy="50" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c}"/></svg><b><span data-count="${score}">0</span>${cls.includes('lg') ? '<small>score</small>' : ''}</b></div>`;
}
// Runs the entrance animations for whatever was just rendered.
const bit = (name, props, inner = '', style = '') => `<span data-bit="${name}" data-props="${esc(JSON.stringify(props))}" style="${style}">${inner}</span>`;
const magic = (name, props) => `<span class="magic-layer" data-bit="${name}" data-props="${esc(JSON.stringify(props))}"></span>`;
// GSAP: page progress bar, reveal-on-scroll for anything below the fold, hero parallax.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let barOn = false;
function scrollFx(root) {
  const g = window.gsap;
  const ST = window.ScrollTrigger;
  if (!g || !ST || calm) return;
  ST.getAll().forEach((t) => t.trigger && !t.trigger.isConnected && t.kill());
  if (!barOn) {
    barOn = true;
    g.to('#scrollBar', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  }
  const below = $$('.rise, .section-title', root).filter((el) => !el.classList.contains('sr') && el.getBoundingClientRect().top > window.innerHeight * 0.95);
  below.forEach((el) => el.classList.add('sr'));
  if (below.length) {
    g.set(below, { opacity: 0, y: 44, scale: 0.97 });
    ST.batch(below, { start: 'top 92%', once: true, onEnter: (els) => g.to(els, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out', stagger: 0.08, overwrite: true }) });
  }
  // The banner eases back as the page scrolls past it.
  $$('.hero, .profile-hero', root).forEach((hero) => {
    hero.addEventListener('animationend', (e) => e.target === hero && hero.classList.add('rose'));
    g.fromTo(hero, { opacity: 1, scale: 1, y: 0 }, { opacity: 0.35, scale: 0.96, y: -18, ease: 'none', immediateRender: false, scrollTrigger: { trigger: hero, start: 'top top+=70', end: 'bottom top', scrub: 0.4 } });
    const bg = $('[data-bit="Aurora"], .blur', hero);
    if (bg) g.fromTo(bg, { yPercent: 0 }, { yPercent: 22, immediateRender: false, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top+=70', end: 'bottom top', scrub: true } });
  });
  ST.refresh();
}
function animate(root = view) {
  if (window.Bits) window.Bits.mountAll(root);
  requestAnimationFrame(() => scrollFx(root));
  $$('[data-count]', root).forEach((el) => {
    const end = Number(el.dataset.count) || 0;
    const t0 = performance.now();
    const dur = 1100;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  requestAnimationFrame(() =>
    setTimeout(() => {
      $$('[data-ring]', root).forEach((el) => {
        const bar = $('.bar', el);
        const c = Number(bar.getAttribute('stroke-dasharray'));
        bar.style.strokeDashoffset = c * (1 - Math.min(100, Number(el.dataset.ring)) / 100);
      });
      $$('[data-w]', root).forEach((el) => (el.style.width = `${Math.max(0, Math.min(100, Number(el.dataset.w)))}%`));
      $$('.tabs', root).forEach(moveTab);
    }, 80)
  );
}
function moveTab(tabs) {
  const on = $('button.on', tabs);
  let ind = $('.tab-ind', tabs);
  if (!ind) {
    ind = document.createElement('span');
    ind.className = 'tab-ind';
    tabs.prepend(ind);
  }
  if (on) {
    ind.style.left = `${on.offsetLeft}px`;
    ind.style.width = `${on.offsetWidth}px`;
  }
}
const gradeClass = (score) => (score >= 85 ? 'star' : score >= 70 ? '' : score >= 50 ? 'push' : 'risk');
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'never');
const daysAgo = (iso) => (iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : null);

// How one task cell reads for the chosen report time.
function cellText(t, s, slot) {
  if (slot === 'morning') {
    if (t.kind === 'talk') return { main: `${s.yesterday}m`, sub: 'yesterday' };
    if (t.kind === 'booking') return { main: s.morning, sub: s.flagged ? `${s.flagged} waiting 5+ days` : 'to book' };
    return { main: s.pending, sub: s.flagged ? `${s.flagged} flagged` : 'pending' };
  }
  if (t.kind === 'talk') return { main: `${s.minutes}m`, sub: 'today' };
  return { main: `${s.done}/${s.morning}`, sub: t.kind === 'booking' ? 'booked' : `${s.pending} open` };
}

// ---------- data ----------
async function load(force) {
  if (S.data && !force) return S.data;
  const j = await api(`/api/board${S.slot ? `?slot=${S.slot}` : ''}`);
  S.status = j.status;
  S.tasks = j.tasks;
  S.data = j.board;
  if (!S.slot && j.board) S.slot = j.board.slot;
  paintChrome();
  return S.data;
}
function paintChrome() {
  const st = S.status;
  if (!st) return;
  $('#sideStatus').innerHTML = `
    <div class="row"><span class="dot ${st.lighthouse && !st.refreshError ? 'on' : 'off'}"></span>Lighthouse ${st.lighthouse ? (st.refreshError ? 'error' : 'connected') : 'not connected'}</div>
    <div class="row"><span class="dot ${st.email ? 'on' : 'off'}"></span>Email ${st.email ? 'set up' : 'not set up'}</div>
    <div class="row"><span class="dot ${st.config.enabled ? 'on' : 'off'}"></span>Auto-send ${st.config.enabled ? 'on (Mon–Sat)' : 'off'}</div>
    <small>Data: ${esc(fmtTime(st.dataAt))}</small>`;
  const seg = $('#slotSeg');
  $$('button', seg).forEach((b) => b.classList.toggle('on', b.dataset.slot === S.slot));
  const on = $('button.on', seg);
  const ind = $('.seg-ind', seg);
  if (on) {
    ind.style.width = `${on.offsetWidth}px`;
    ind.style.transform = `translateX(${on.offsetLeft - 4}px)`;
  }
}
$('#slotSeg').onclick = async (e) => {
  const b = e.target.closest('button[data-slot]');
  if (!b || b.dataset.slot === S.slot) return;
  S.slot = b.dataset.slot;
  S.data = null;
  paintChrome();
  route(true);
};
$('#refreshBtn').onclick = async () => {
  const btn = $('#refreshBtn');
  btn.classList.add('loading');
  btn.disabled = true;
  try {
    const j = await api('/api/refresh', { body: {} });
    toast(j.errors && j.errors.length ? `Refreshed, but ${j.errors.length} list(s) failed: ${j.errors[0]}` : 'Fresh data loaded from Lighthouse', j.errors && j.errors.length ? 'err' : 'ok');
    S.data = null;
    route(true);
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
};

// ---------- router ----------
const routes = { dashboard, team, tm, tasks, reports, schedule, settings };
let navToken = 0;
async function route(keepScroll) {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const name = routes[parts[0]] ? parts[0] : 'dashboard';
  const token = ++navToken;
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === (name === 'tm' ? 'team' : name)));
  view.classList.add('out');
  await new Promise((r) => setTimeout(r, 160));
  if (token !== navToken) return;
  try {
    await routes[name](parts.slice(1));
  } catch (err) {
    view.innerHTML = `<div class="card"><h3>Something went wrong</h3><p class="note">${esc(err.message)}</p></div>`;
  }
  if (token !== navToken) return;
  view.classList.remove('out');
  view.style.animation = 'none';
  void view.offsetWidth;
  view.style.animation = '';
  if (!keepScroll) window.scrollTo({ top: 0 });
  animate();
}
window.addEventListener('hashchange', () => route());
window.addEventListener('resize', () => {
  paintChrome();
  $$('.tabs').forEach(moveTab);
});

function title(t, sub) {
  $('#pageTitle').textContent = t;
  $('#pageSub').textContent = sub || '';
  document.title = `${t} · TM Hub`;
}
function noData() {
  const st = S.status || {};
  view.innerHTML = `<div class="card rise"><h3>No Lighthouse data yet</h3><p class="note">${
    st.lighthouse ? 'Click <b>Refresh</b> at the top right to load today’s tasks.' : 'Connect Lighthouse in <a href="#/settings"><b>Settings</b></a>, then click Refresh.'
  }${st.refreshError ? `<br><span style="color:var(--red)">${esc(st.refreshError)}</span>` : ''}</p></div>`;
}

// ---------- Dashboard ----------
function nextSend() {
  const st = S.status;
  if (!st.config.enabled) return { label: 'Auto-send is off', value: '—' };
  const [h, m] = st.now.time.split(':').map(Number);
  const now = h * 60 + m;
  const names = { morning: '11 AM tasks', progress: '5 PM progress', closure: '8 PM closure' };
  for (const k of ['morning', 'progress', 'closure']) {
    const [sh, sm] = st.config.slots[k].split(':').map(Number);
    const at = sh * 60 + sm;
    if (st.now.day !== 'Sun' && st.config.last[k] !== st.now.date && at > now) {
      const d = at - now;
      return { label: `Next: ${names[k]}`, value: `in ${Math.floor(d / 60)}h ${String(d % 60).padStart(2, '0')}m` };
    }
  }
  return { label: 'Next: 11 AM tasks', value: st.now.day === 'Sat' ? 'Monday' : 'tomorrow' };
}
function tmCard(r, i, top = false) {
  const t = r.tasks;
  const open = S.tasks.filter((x) => x.kind === 'list').reduce((a, x) => a + t[x.key].pending, 0);
  return `<a class="card tm-card rise ${gradeClass(r.perf.score)}" style="--i:${i}" href="#/tm/${encodeURIComponent(r.name)}">
    <div class="cover"></div>${top ? magic('ShineBorder', { borderWidth: 2, duration: 10, shineColor: ['#0d5c63', '#7ee0d4', '#f2b84b'] }) : ''}
    <img class="face" src="${photo(r)}" alt="${esc(r.name)}">
    <div class="ring-wrap">${ring(r.perf.score)}</div>
    <div class="body">
      <div class="name">${esc(r.name)}</div>
      <div class="grade">${esc(r.perf.grade)} · ${r.perf.students} students</div>
      <div class="mini-stats">
        <div><b data-count="${open}">0</b><span>open items</span></div>
        <div><b>${t.ic2.done}/${t.ic2.morning}</b><span>IC2 booked</span></div>
        <div><b>${S.slot === 'morning' ? t.talk.yesterday : t.talk.minutes}m</b><span>talk ${S.slot === 'morning' ? 'yest.' : 'today'}</span></div>
      </div>
      <div class="flags">${r.concerns.length ? r.concerns.slice(0, 3).map((c) => pill('critical', c)).join('') + (r.concerns.length > 3 ? `<span class="tag">+${r.concerns.length - 3}</span>` : '') : pill('clear', 'Nothing critical')}</div>
    </div></a>`;
}
function heatmap(b) {
  return `<div class="table-wrap"><table class="tbl heat"><thead><tr><th>Task</th>${b.rows
    .map((r) => `<th class="num"><div class="tm-head"><img src="${photo(r)}" alt="">${esc(r.first)}</div></th>`)
    .join('')}</tr></thead><tbody>${S.tasks
    .map(
      (t) =>
        `<tr><td><b>${t.icon} ${esc(t.label)}</b></td>${b.rows
          .map((r) => {
            const s = r.tasks[t.key];
            const c = cellText(t, s, b.slot);
            return `<td class="cell ${s.status}" data-go="#/tm/${encodeURIComponent(r.name)}/${t.key}" title="${esc(STATUS_LABEL[s.status])}"><b>${esc(c.main)}</b><small>${esc(c.sub)}</small></td>`;
          })
          .join('')}</tr>`
    )
    .join('')}</tbody></table></div>`;
}
async function dashboard() {
  const b = await load();
  const st = S.status;
  title('Dashboard', b ? `${SLOT_LABEL[b.slot]} · data from ${fmtTime(b.fetchedAt)}` : '');
  if (!b) return noData();
  const hr = Number(st.now.time.slice(0, 2));
  const hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const nx = nextSend();
  const critTMs = b.rows.filter((r) => r.concerns.length);
  const kpis = S.tasks
    .map((t, i) => {
      const all = b.rows.map((r) => r.tasks[t.key]);
      const sum = (k) => all.reduce((a, s) => a + (s[k] || 0), 0);
      const crit = all.filter((s) => s.status === 'critical').length;
      let val, meta, p;
      if (t.kind === 'talk') {
        const v = b.slot === 'morning' ? sum('yesterday') : sum('minutes');
        val = `<span data-count="${v}">0</span><small> min</small>`;
        meta = b.slot === 'morning' ? 'team talk time yesterday' : 'team talk time today';
        p = (100 * v) / (sum('target') || 1);
      } else if (t.kind === 'booking') {
        val = `<span data-count="${sum('done')}">0</span><small> of ${sum('morning')} booked</small>`;
        meta = `${Math.max(sum('morning') - sum('done'), 0)} still to book`;
        p = (100 * sum('done')) / (sum('morning') || 1);
      } else {
        val = `<span data-count="${sum('pending')}">0</span><small> pending</small>`;
        meta = b.slot === 'morning' ? `${sum('flagged')} overdue / ageing` : `${sum('done')} closed since 11 AM`;
        p = sum('morning') ? (100 * sum('done')) / sum('morning') : 100;
      }
      return `<span class="rise kpi-wrap" style="--i:${i}" data-go="#/tasks/${t.key}" data-bit="SpotlightCard" data-props="${esc(JSON.stringify({ theme: 'light', spotlightColor: crit ? '#e0563f' : '#12a39a', intensity: 0.22, spotlightSize: 260, className: `kpi${crit ? ' crit' : ''}` }))}">
        <div class="top"><div class="ico">${t.icon}</div>${crit ? pill('critical', `${crit} TM${crit > 1 ? 's' : ''}`) : pill('ok', 'OK')}</div>
        <div class="val">${val}</div><div class="lbl">${esc(t.label)}</div><div class="meta">${esc(meta)}</div>
        <div class="prog ${crit ? 'red' : ''}"><i data-w="${p}"></i></div></span>`;
    })
    .join('');
  view.innerHTML = `
    <div class="hero rise">
      ${bit('Aurora', { colorStops: ['#3fb5ac', '#7ee0d4', '#12808a'], amplitude: 1.1, blend: 0.6, speed: 0.6, opacity: 0.55, mouseInteraction: true }, '', 'position:absolute;inset:0;display:block;pointer-events:none')}
      ${magic('BorderBeam', { size: 160, duration: 9, colorFrom: '#7ee0d4', colorTo: '#ffffff', borderWidth: 2 })}
      <div style="position:relative"><h2>${bit('BlurText', { text: `${hello}, ${(st.fromName || 'Roshan').split(' ')[0]} 👋`, delay: 90, animateBy: 'words', direction: 'top' }, '', 'display:inline-block')}</h2>
        <p>${critTMs.length ? `${critTMs.length} of ${b.rows.length} TMs have something that needs attention.` : 'Everything is on track across the team.'}</p>
        <div class="hero-faces" style="margin:16px 0 0 12px">${b.rows.map((r) => `<a href="#/tm/${encodeURIComponent(r.name)}" title="${esc(r.name)}"><img src="${photo(r)}" alt=""></a>`).join('')}</div></div>
      <div class="next-send" style="position:relative"><small>${esc(nx.label)}</small><b>${bit('GradientText', { colors: ['#ffffff', '#7ee0d4', '#ffffff'], animationSpeed: 5 }, esc(nx.value))}</b><small style="margin-top:4px">${st.email ? `from ${esc(st.sender)}` : 'Email not set up yet'}</small></div>
    </div>
    ${critTMs.length ? `<span class="ticker rise" style="--i:1" data-bit="Marquee" data-props="${esc(JSON.stringify({ pauseOnHover: true, repeat: 4, style: { '--duration': `${Math.max(30, critTMs.reduce((a, r) => a + r.concerns.length, 0) * 5)}s`, '--gap': '12px' } }))}">${critTMs.map((r) => r.concerns.map((c) => `<a href="#/tm/${encodeURIComponent(r.name)}"><img src="${photo(r)}" alt=""><b>${esc(r.first)}</b><i></i>${esc(c)}</a>`).join('')).join('')}</span>` : ''}
    <div class="section-title"><h2>Team tasks</h2><span>${esc(SLOT_LABEL[b.slot])}. Click a tile for the full list.</span></div>
    <div class="grid g-kpi">${kpis}</div>
    <div class="grid g-2" style="margin-top:18px">
      <div class="card rise" style="--i:9"><h3>Task board</h3><div class="sub" style="margin-bottom:12px">${b.slot === 'morning' ? 'Pending per TM. Red needs attention today.' : 'Done since 11 AM, of the morning total.'} Click a cell to open that TM.</div>${heatmap(b)}</div>
      <div class="card rise" style="--i:10"><h3>Needs attention</h3><div class="sub" style="margin-bottom:12px">Critical items by TM</div>
        <div class="attn">${
          critTMs.length
            ? critTMs.map((r) => `<a href="#/tm/${encodeURIComponent(r.name)}"><img src="${photo(r)}" alt=""><div><div class="who">${esc(r.name)}</div><div class="what">${esc(r.concerns.join(' · '))}</div></div></a>`).join('')
            : '<div class="empty">🎉 Nothing critical right now</div>'
        }</div></div>
    </div>
    <div class="section-title"><h2>Team</h2><span>Performance score out of 100</span></div>
    <div class="grid g-team">${[...b.rows].sort((a, c) => c.perf.score - a.perf.score).map((r, i) => tmCard(r, i + 11, i === 0)).join('')}</div>`;
}
view.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) location.hash = go.dataset.go;
});

// ---------- Team ----------
async function team() {
  const b = await load();
  title('Team', b ? `${b.rows.length} tutor managers` : '');
  if (!b) return noData();
  view.innerHTML = `<div class="toolbar"><span class="note">Click a TM for their profile, performance card and students.</span><span style="flex:1"></span><a class="btn btn-ghost" href="/api/students.csv" download>⬇ Download all students (CSV)</a></div><div class="grid g-team">${b.rows.map((r, i) => tmCard(r, i)).join('')}</div>`;
}

// ---------- TM profile ----------
const CRM = 'https://lighthouse.uprio.com/tutoring-crm';
const lhLink = (href, html) => (href ? `<a class="lh" href="${esc(href)}" target="_blank" rel="noopener" title="Open in Lighthouse">${html}<span class="ext">↗</span></a>` : html);
const TASK_PAGE = { onboarding: CRM + '/task', negfb: CRM + '/task', ic2: CRM + '/revision-lift' };
function itemsTable(t, items, withTm) {
  if (!items.length) return '<div class="empty">Nothing pending here 🎉</div>';
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th class="num">#</th>${withTm ? '<th>TM</th>' : ''}${t.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${items
    .map(
      (it, i) =>
        `<tr class="${it.flag ? 'flag' : ''}"><td class="num">${i + 1}</td>${withTm ? `<td><b>${esc(it.tm)}</b></td>` : ''}${it.cells
          .map((c, j) => `<td>${j === it.cells.length - 1 && it.flag ? `<span class="tag red">${esc(c)}</span>` : j === 0 ? lhLink(it.link, esc(c)) : j === 1 ? lhLink(it.taskLink, esc(c)) : esc(c)}</td>`)
          .join('')}</tr>`
    )
    .join('')}</tbody></table></div>`;
}
function sparkline(history) {
  if (history.length < 2) return '<div class="note" style="margin-top:12px">The score trend appears here after a couple of days of data.</div>';
  const pts = history.slice(-14);
  const W = 400, H = 70, pad = 6;
  const xs = pts.map((_, i) => pad + (i * (W - 2 * pad)) / (pts.length - 1));
  const ys = pts.map((p) => H - pad - (p.score / 100) * (H - 2 * pad));
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path class="area" d="${d} L${xs[xs.length - 1]} ${H} L${xs[0]} ${H} Z"/><path class="line" d="${d}"/></svg>
    <div class="note" style="display:flex;justify-content:space-between"><span>${esc(pts[0].date.slice(5))}</span><span>Score trend, last ${pts.length} days</span><span>${esc(pts[pts.length - 1].date.slice(5))}</span></div>`;
}
let stuState = { q: '', filter: 'all', sort: 'name', dir: 1 };
function studentRows(students) {
  const f = stuState;
  let list = students.filter((s) => {
    const hay = `${s.name} ${s.school} ${s.batch} ${s.grade}`.toLowerCase();
    if (f.q && !hay.includes(f.q.toLowerCase())) return false;
    const d = daysAgo(s.lastContact);
    if (f.filter === 'low') return typeof s.greenPct === 'number' && s.greenPct < 60;
    if (f.filter === 'nc15') return d === null || d > 15;
    if (f.filter === 'lapsed') return s.lapsed;
    if (f.filter === 'one') return s.oneOnOne;
    if (f.filter === 'absent') return s.att && s.att.streak >= 3;
    if (f.filter === 'lowatt') return s.att && s.att.regHeld > 0 && s.att.regAttended / s.att.regHeld < 0.7;
    return true;
  });
  const key = { name: (s) => s.name.toLowerCase(), grade: (s) => Number(s.grade) || 0, green: (s) => s.greenPct ?? -1, imp: (s) => s.improvementPct ?? -1, contact: (s) => daysAgo(s.lastContact) ?? 999, lift: (s) => s.liftLoad ?? 0, att: (s) => (s.att && s.att.regHeld ? s.att.regAttended / s.att.regHeld : s.att && s.att.allHeld ? s.att.allAttended / s.att.allHeld - 2 : -3), streak: (s) => (s.att ? s.att.streak : -1) }[f.sort];
  list = list.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * f.dir);
  const bar = (v) => (typeof v !== 'number' ? '<span style="color:var(--ink-3)">—</span>' : `<span class="bar-mini"><i style="width:${v}%;background:${v >= 70 ? 'var(--green)' : v >= 50 ? '#c98a00' : 'var(--red)'}"></i></span>${v}%`);
  return {
    count: list.length,
    html: list
      .map((s, i) => {
        const d = daysAgo(s.lastContact);
        const nc = d === null || d > 15;
        const a = s.att;
        const shortDay = (x) => new Date(x).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
        const attCell = !a
          ? '<span style="color:var(--ink-3)">—</span>'
          : `${a.regHeld ? `${bar(Math.round((100 * a.regAttended) / a.regHeld))} <b>${a.regAttended}/${a.regHeld}</b>` : '<span style="color:var(--ink-3)">No regular class</span>'}<br><small style="color:var(--ink-3)">all classes ${a.allAttended ?? 0}/${a.allHeld ?? 0}</small>`;
        const absCell = !a
          ? '—'
          : a.onHoliday
            ? '<span class="tag">On holiday</span>'
            : a.streak >= 1
              ? `<span class="tag ${a.streak >= 3 ? 'red' : ''}">${a.streak} class day${a.streak > 1 ? 's' : ''}</span><br><small style="color:var(--ink-3)">${a.lastAttended ? `last attended ${shortDay(a.lastAttended)}` : 'never attended'}</small>`
              : '<span style="color:var(--green);font-weight:600">Attending</span>';
        return `<tr class="${nc || (a && a.streak >= 3) || (typeof s.greenPct === 'number' && s.greenPct < 40) ? 'flag' : ''}"><td class="num">${i + 1}</td>
          <td><b>${lhLink(`${CRM}/students/view/${s.id}`, esc(s.name))}</b>${s.lapsed ? ' <span class="tag red">Lapsed</span>' : ''}${s.oneOnOne ? ' <span class="tag">1:1</span>' : ''}</td>
          <td class="num">${esc(s.grade ?? '—')}</td>
          <td>${esc(s.school || '—')}<br><small style="color:var(--ink-3)">${esc((s.batch || '').split('|')[0])}</small></td>
          <td style="white-space:nowrap">${attCell}</td><td style="white-space:nowrap">${absCell}</td>
          <td style="white-space:nowrap">${bar(s.greenPct)}</td><td style="white-space:nowrap">${bar(s.improvementPct)}</td>
          <td class="num">${s.liftLoad ?? '—'}</td>
          <td>${d === null ? '<span class="tag red">Never</span>' : nc ? `<span class="tag red">${d}d ago</span>` : `${d}d ago`}</td>
          <td>${s.nextExam && s.nextExam.date ? `${esc(s.nextExam.name || 'Exam')}<br><small style="color:var(--ink-3)">${esc(new Date(s.nextExam.date).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }))}</small>` : '—'}</td></tr>`;
      })
      .join(''),
  };
}
async function tm([name, focus]) {
  await load();
  if (!S.data) {
    title('Profile');
    return noData();
  }
  const j = await api(`/api/tm/${encodeURIComponent(name)}?slot=${S.slot}`);
  const r = j.row;
  const P = r.perf;
  title(r.name, `${P.grade} · ${SLOT_LABEL[j.slot]}`);
  const rank = [...j.team].sort((a, b) => b.score - a.score).findIndex((x) => x.name === r.name) + 1;
  stuState = { q: '', filter: 'all', sort: 'name', dir: 1 };
  const monthLabel = j.monthStart ? `${new Date(j.monthStart + 'T12:00:00+05:30').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(j.dataDate + 'T12:00:00+05:30').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'this month';
  const absent3 = j.students.filter((x) => x.att && x.att.streak >= 3).length;
  const openCount = S.tasks.filter((t) => t.kind !== 'talk').reduce((a, t) => a + r.tasks[t.key].items.length, 0);

  const metricRows = S.tasks
    .map((t) => {
      const m = P.metrics[t.key];
      const cls = m.value >= 70 ? '' : m.value >= 40 ? 'amber' : 'red';
      return `<div class="metric-row"><div class="nm">${t.icon} ${esc(t.short)}<small>${esc(m.label)}</small></div><div class="prog ${cls}"><i data-w="${m.value}"></i></div><div class="v">${m.value}</div></div>`;
    })
    .join('');

  const accs = S.tasks
    .map((t) => {
      const s = r.tasks[t.key];
      const c = cellText(t, s, j.slot);
      const body =
        t.kind === 'talk'
          ? `<div class="quality" style="margin-bottom:6px"><div><b>${s.minutes}m</b><span>talk time today</span></div><div><b>${s.yesterday}m</b><span>last working day</span></div><div><b>${s.connected}</b><span>parents connected</span></div><div><b>${s.calls}/${s.dialled}</b><span>connected / dialled</span></div></div>`
          : itemsTable(t, s.items);
      return `<div class="acc ${s.status === 'critical' ? 'crit' : ''} ${focus === t.key || (!focus && s.status === 'critical') ? 'open' : ''}" id="acc-${t.key}">
        <div class="acc-head"><span class="ic">${t.icon}</span><span class="t">${esc(t.label)}<small>${esc(c.sub)}</small></span><span class="fig">${esc(c.main)}</span>${pill(s.status)}<span class="chev">›</span></div>
        <div class="acc-body"><div><div class="acc-inner">
          ${s.hints.length ? `<div class="hints"><b>💡 Ideas & hints</b><ul>${s.hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}${body}
        </div></div></div></div>`;
    })
    .join('');

  view.innerHTML = `
    <a class="back" href="#/team">← All TMs</a>
    <div class="profile-hero rise">${magic('BorderBeam', { size: 180, duration: 10, colorFrom: '#7ee0d4', colorTo: '#f2b84b', borderWidth: 2 })}
      <div class="blur" style="background-image:url('${photo(r)}')"></div>
      ${bit('TiltedCard', { imageSrc: photo(r), altText: r.name, containerHeight: '156px', containerWidth: '156px', imageHeight: '148px', imageWidth: '148px', rotateAmplitude: 14, scaleOnHover: 1.08, showTooltip: false, flipOnClick: false, gyroscope: false, radius: 30, glare: 0.5 }, '', 'display:block;width:156px;height:156px')}
      <div><h2>${bit('BlurText', { text: r.name, delay: 120, animateBy: 'words', direction: 'top' }, '', 'display:inline-block')}</h2><div class="meta">Tutor Manager · ${esc(r.email)}</div>
        <div class="chips"><span class="chip">🏅 Rank ${rank} of ${j.team.length}</span><span class="chip">👩‍🎓 ${P.students} students</span><span class="chip">🏫 ${P.batches} batches</span><span class="chip">${bit('ShinyText', { text: P.grade, color: '#d6efec', shineColor: '#ffffff', speed: 2.5 })}</span>${r.concerns.length ? `<span class="chip" style="background:rgba(255,120,100,.3)">⚠ ${r.concerns.length} critical</span>` : ''}</div></div>
      ${ring(P.score, 'lg')}
    </div>
    <div class="grid g-2" style="margin-top:18px">
      <div class="card rise" style="--i:1"><h3>Performance card</h3><div class="sub">Each metric scored out of 100, weighted into the overall score</div><div class="metric-rows">${metricRows}</div></div>
      <div class="card rise" style="--i:2"><h3>Student outcomes</h3><div class="sub">From the All Students tab</div>
        <div class="quality" style="margin-top:14px;grid-template-columns:repeat(2,1fr)">
          <div><b><span data-count="${P.students}">0</span></b><span>active students</span></div>
          <div><b>${P.avgGreen ?? '—'}${P.avgGreen !== null ? '%' : ''}</b><span>avg green (mastery)</span></div>
          <div><b>${P.avgImprovement ?? '—'}${P.avgImprovement !== null ? '%' : ''}</b><span>avg improvement</span></div>
          <div style="${P.noContact15 ? 'background:var(--red-bg)' : ''}"><b><span data-count="${P.noContact15}">0</span></b><span>not contacted in 15+ days</span></div>
          <div style="grid-column:1/-1;${absent3 ? 'background:var(--red-bg)' : ''}"><b><span data-count="${absent3}">0</span></b><span>students absent for 3+ class days in a row</span></div>
        </div>${sparkline(j.history)}</div>
    </div>
    <div class="section-title"><div class="tabs" id="ptabs"><button class="on" data-tab="tasks">Today's tasks<span class="count">${openCount}</span></button><button data-tab="students">Students<span class="count">${j.students.length}</span></button></div>
      <a class="btn btn-ghost" href="#/reports/${encodeURIComponent(r.name)}">✉ Preview ${esc(r.first)}'s email</a></div>
    <div id="ptab-tasks" class="rise" style="--i:3">${accs}</div>
    <div id="ptab-students" hidden>
      <div class="card">
        <div class="toolbar"><div class="search"><input id="stuQ" placeholder="Search ${j.students.length} students by name, school or batch"></div>
          <select class="sel" id="stuF"><option value="all">All students</option><option value="low">Green below 60%</option><option value="nc15">Not contacted 15+ days</option><option value="absent">Absent 3+ class days</option><option value="lowatt">Regular attendance below 70%</option><option value="one">1:1 students</option><option value="lapsed">Subscription lapsed</option></select>
          <span class="note" id="stuN"></span>
          <a class="btn btn-ghost" href="/api/students.csv?tm=${encodeURIComponent(r.name)}" download>⬇ Download CSV</a></div>
        <div class="table-wrap" style="max-height:70vh;overflow:auto"><table class="tbl"><thead><tr><th class="num">#</th><th class="sort asc" data-s="name">Student</th><th class="sort num" data-s="grade">Class</th><th>School / batch</th><th class="sort" data-s="att">Regular attendance<br><small style="font-weight:500">${esc(monthLabel)}</small></th><th class="sort" data-s="streak">Absent for</th><th class="sort" data-s="green">Green %</th><th class="sort" data-s="imp">Improvement</th><th class="sort num" data-s="lift">IC2 load</th><th class="sort" data-s="contact">Last contact</th><th>Next exam</th></tr></thead><tbody id="stuBody"></tbody></table></div>
      </div>
    </div>`;

  const paintStudents = () => {
    const o = studentRows(j.students);
    $('#stuBody').innerHTML = o.html || '<tr><td colspan="11" class="empty">No students match</td></tr>';
    $('#stuN').textContent = `${o.count} shown`;
  };
  paintStudents();
  $('#stuQ').oninput = (e) => ((stuState.q = e.target.value), paintStudents());
  $('#stuF').onchange = (e) => ((stuState.filter = e.target.value), paintStudents());
  $$('#ptab-students th.sort').forEach(
    (th) =>
      (th.onclick = () => {
        stuState.dir = stuState.sort === th.dataset.s ? -stuState.dir : 1;
        stuState.sort = th.dataset.s;
        $$('#ptab-students th.sort').forEach((x) => x.classList.remove('asc', 'desc'));
        th.classList.add(stuState.dir === 1 ? 'asc' : 'desc');
        paintStudents();
      })
  );
  $('#ptabs').onclick = (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    $$('#ptabs button').forEach((x) => x.classList.toggle('on', x === b));
    moveTab($('#ptabs'));
    $('#ptab-tasks').hidden = b.dataset.tab !== 'tasks';
    $('#ptab-students').hidden = b.dataset.tab !== 'students';
  };
  $$('.acc-head', view).forEach((h) => (h.onclick = () => h.parentElement.classList.toggle('open')));
  if (focus) setTimeout(() => $(`#acc-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
}

// ---------- Task board ----------
async function tasks([key]) {
  const b = await load();
  title('Task board', b ? `Task-wise, all TMs · ${SLOT_LABEL[b.slot]}` : '');
  if (!b) return noData();
  const t = S.tasks.find((x) => x.key === key) || S.tasks[0];
  const count = (x) => (x.kind === 'talk' ? '' : `<span class="count">${b.rows.reduce((a, r) => a + r.tasks[x.key].items.length, 0)}</span>`);
  const summary = `<div class="table-wrap"><table class="tbl"><thead><tr><th>TM</th>${
    t.kind === 'talk'
      ? '<th class="num">Today</th><th class="num">Last working day</th><th class="num">Parents connected</th><th class="num">Connected / dialled</th>'
      : '<th class="num">At 11 AM</th><th class="num">Closed / booked</th><th class="num">Still open</th><th class="num">Flagged</th>'
  }<th>Progress</th><th>Status</th><th>Idea / hint</th></tr></thead><tbody>${b.rows
    .map((r) => {
      const s = r.tasks[t.key];
      const p = t.kind === 'talk' ? (s.target ? Math.round((100 * s.done) / s.target) : 100) : s.morning ? Math.round((100 * s.done) / s.morning) : 100;
      const nums =
        t.kind === 'talk'
          ? `<td class="num"><b>${s.minutes}m</b></td><td class="num">${s.yesterday}m</td><td class="num">${s.connected}</td><td class="num">${s.calls}/${s.dialled}</td>`
          : `<td class="num">${s.morning}</td><td class="num"><b>${s.done}</b></td><td class="num">${s.pending}${s.fresh ? ` <small>(+${s.fresh} new)</small>` : ''}</td><td class="num">${s.flagged ? `<span class="tag red">${s.flagged}</span>` : '0'}</td>`;
      return `<tr class="${s.status === 'critical' ? 'flag' : ''}" data-go="#/tm/${encodeURIComponent(r.name)}/${t.key}" style="cursor:pointer"><td><div style="display:flex;align-items:center;gap:10px"><img src="${photo(r)}" style="width:34px;height:34px;border-radius:10px;object-fit:cover" alt=""><b>${esc(r.name)}</b></div></td>${nums}
        <td style="min-width:120px"><div class="prog ${s.status === 'critical' ? 'red' : s.status === 'watch' ? 'amber' : ''}" style="margin:0"><i data-w="${p}"></i></div></td><td>${pill(s.status)}</td><td style="min-width:260px;max-width:340px;font-size:12.5px;color:var(--ink-2)">${esc(s.hints[0] || '')}</td></tr>`;
    })
    .join('')}</tbody></table></div>`;
  const all = b.rows.flatMap((r) => r.tasks[t.key].items.map((it) => ({ ...it, tm: r.first }))).sort((a, c) => c.flag - a.flag || a.sort - c.sort);
  view.innerHTML = `
    <div class="tabs rise" id="ttabs">${S.tasks.map((x) => `<button class="${x.key === t.key ? 'on' : ''}" data-key="${x.key}">${x.icon} ${esc(x.short)}${count(x)}</button>`).join('')}</div>
    <div class="card rise" style="--i:1;margin-top:18px"><h3>${t.icon} ${esc(t.label)} · by TM <a class="lh" style="font-size:12.5px;font-weight:500;margin-left:8px" href="${TASK_PAGE[t.key] || CRM + '/tm-performance'}" target="_blank" rel="noopener">Open in Lighthouse<span class="ext">↗</span></a></h3><div class="sub" style="margin-bottom:12px">Rows in red need attention. Click a row to open the TM.</div>${summary}</div>
    ${
      t.kind === 'talk'
        ? ''
        : `<div class="card rise" style="--i:2;margin-top:18px"><div class="toolbar"><div><h3>All pending · ${all.length}</h3><div class="sub">${all.filter((x) => x.flag).length} flagged as overdue / ageing</div></div><span style="flex:1"></span>
        <label class="toggle"><input type="checkbox" id="flagOnly"><span class="sw"></span>Flagged only</label></div><div id="allItems">${itemsTable(t, all, true)}</div></div>`
    }`;
  $('#ttabs').onclick = (e) => {
    const bt = e.target.closest('button[data-key]');
    if (bt) location.hash = `#/tasks/${bt.dataset.key}`;
  };
  const fo = $('#flagOnly');
  if (fo) fo.onchange = () => ($('#allItems').innerHTML = itemsTable(t, fo.checked ? all.filter((x) => x.flag) : all, true));
}

// ---------- Reports ----------
async function reports([who]) {
  const b = await load();
  title('Reports', 'Preview and send the daily emails');
  if (!b) return noData();
  const st = S.status;
  const subj = (await api(`/api/subjects?slot=${S.slot}`)).items;
  let sel = who && b.rows.some((r) => r.name === who) ? who : 'team';
  const src = () => `/api/preview?slot=${S.slot}&who=${encodeURIComponent(sel)}`;
  view.innerHTML = `
    ${st.email ? '' : '<div class="callout red rise" style="margin-bottom:16px">Email is not set up, so nothing can be sent yet. Sign in with Google in <a href="#/settings"><b>Settings</b></a>.</div>'}
    <div class="rep">
      <div class="card rise"><h3>${esc(SLOT_LABEL[S.slot])}</h3><div class="sub" style="margin-bottom:12px">Switch 11 AM / 5 PM / 8 PM at the top. Pick a mail to preview it.</div>
        <div class="recip" id="recip">
          <button data-who="team"><span class="team-ic">👥</span><span><b>Team board (one mail)</b><small>To you · CC all ${b.rows.length} TMs</small></span></button>
          ${b.rows.map((r) => `<button data-who="${esc(r.name)}"><img src="${photo(r)}" alt=""><span><b>${esc(r.name)}</b><small>${esc(r.email)}</small></span></button>`).join('')}
        </div>
        <div class="note" id="subj" style="margin-top:12px"></div>
        <div class="hints" style="margin:14px 0 0"><b>🧪 Test on my mail only</b><div class="note" style="margin:4px 0 10px">Goes only to <b>${esc(st.sender || 'your address')}</b>. No TM receives anything, nobody is in CC, and the subject starts with [TEST].</div>
          <div class="send-bar" style="margin-top:0"><button class="btn btn-primary" id="testOne">Test this mail</button><button class="btn btn-ghost" id="sendTest">Test all ${b.rows.length + 1}</button></div></div>
        <div class="section-title" style="margin:18px 0 8px"><h2 style="font-size:14px">Send to the team</h2></div>
        <div class="send-bar" style="margin-top:0"><button class="btn btn-ghost" id="sendOne">Send this one</button><button class="btn btn-ghost" id="sendAll">Send all now</button></div>
        <p class="note">Automatic sending runs Mon–Sat at ${esc(st.config.slots.morning)}, ${esc(st.config.slots.progress)} and ${esc(st.config.slots.closure)}.</p>
      </div>
      <iframe class="preview rise" style="--i:1" id="pv" title="Email preview"></iframe>
    </div>`;
  const paint = () => {
    $$('#recip button').forEach((x) => x.classList.toggle('on', x.dataset.who === sel));
    $('#pv').src = src();
    const s = subj.find((x) => x.who === sel);
    $('#subj').innerHTML = s ? `<b>Subject:</b> ${esc(s.subject)}<br><b>To:</b> ${esc(s.to)}` : '';
  };
  paint();
  $('#recip').onclick = (e) => {
    const bt = e.target.closest('button[data-who]');
    if (bt) {
      sel = bt.dataset.who;
      paint();
    }
  };
  const send = async (btn, body, okMsg) => {
    btn.disabled = true;
    try {
      const j = await api('/api/send', { body: { slot: S.slot, ...body } });
      const bad = j.results.filter((x) => !x.ok);
      if (bad.length) toast(`${bad.length} failed: ${bad[0].error}`, 'err');
      else toast(`${okMsg} (${j.results.length} mail${j.results.length > 1 ? 's' : ''})`, 'ok');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  };
  $('#sendTest').onclick = (e) => send(e.currentTarget, { test: true }, 'Tests sent to you only');
  $('#testOne').onclick = (e) => send(e.currentTarget, sel === 'team' ? { test: true, individual: false, team: true } : { test: true, names: [sel], team: false }, 'Test sent to you only');
  $('#sendOne').onclick = async (e) => {
    const btn = e.currentTarget;
    const label = sel === 'team' ? `the team board (you + CC ${b.rows.length} TMs)` : sel;
    if (!(await confirmBox('Send this email?', `This sends the <b>${esc(SLOT_LABEL[S.slot])}</b> mail to <b>${esc(label)}</b> right now.`, 'Send'))) return;
    send(btn, sel === 'team' ? { individual: false, team: true } : { names: [sel], team: false }, 'Sent');
  };
  $('#sendAll').onclick = async (e) => {
    const btn = e.currentTarget;
    if (!(await confirmBox('Send to the whole team?', `This sends the <b>${esc(SLOT_LABEL[S.slot])}</b> mail to all ${b.rows.length} TMs individually, plus the team board with everyone in CC.`, 'Send all'))) return;
    send(btn, {}, 'All sent');
  };
}

// ---------- Schedule ----------
async function schedule() {
  await load(true);
  const st = S.status;
  const c = st.config;
  title('Schedule', 'Automatic emails, Monday to Saturday (India time)');
  const [h, m] = st.now.time.split(':').map(Number);
  const now = h * 60 + m;
  const meta = { morning: ['🌅', "Today's tasks", 'Total tasks, overdue items and student-wise lists'], progress: ['⏱️', 'Progress update', 'Closed vs still open since 11 AM'], closure: ['🌙', 'Task closure', 'Achieved vs missed, carry-forward list'] };
  let nextMarked = false;
  const cards = ['morning', 'progress', 'closure']
    .map((k, i) => {
      const done = c.last[k] === st.now.date;
      const [sh, sm] = c.slots[k].split(':').map(Number);
      const isNext = !done && !nextMarked && sh * 60 + sm > now && c.enabled && st.now.day !== 'Sun';
      if (isNext) nextMarked = true;
      return `<div class="card slot-card rise ${done ? 'done' : ''} ${isNext ? 'next' : ''}" style="--i:${i}"><div class="bubble">${meta[k][0]}</div><h3>${meta[k][1]}</h3><div class="sub">${meta[k][2]}</div>
        <input type="time" id="t-${k}" value="${esc(c.slots[k])}"><div class="note" style="margin-top:6px">${done ? 'Done today' : isNext ? 'Up next' : '&nbsp;'}</div></div>`;
    })
    .join('');
  view.innerHTML = `
    ${st.email ? '' : '<div class="callout red rise" style="margin-bottom:16px">Email is not set up, so scheduled mails will fail. Fix it in <a href="#/settings"><b>Settings</b></a>.</div>'}
    <div class="card rise"><div class="toolbar"><div><h3>Daily automatic emails</h3><div class="sub">The hub must stay running on this computer for mails to go out. Sundays are skipped.</div></div><span style="flex:1"></span>
      <label class="toggle"><input type="checkbox" id="en" ${c.enabled ? 'checked' : ''}><span class="sw"></span>Auto-send</label></div></div>
    <div class="timeline">${cards}</div>
    <div class="card rise" style="--i:4;margin-top:18px"><h3>What goes out each time</h3>
      <div class="form" style="margin-top:12px">
        <label class="toggle"><input type="checkbox" id="ind" ${c.sendIndividual ? 'checked' : ''}><span class="sw"></span>Personal mail to each TM (tasks, hints, student-wise tables)</label>
        <label class="toggle"><input type="checkbox" id="tm" ${c.sendTeam ? 'checked' : ''}><span class="sw"></span>One team board mail, task-wise table, all TMs in CC</label>
        <label>Talk-time benchmark per TM (minutes, used only for colours and score)<input type="number" id="talk" min="10" max="600" value="${c.talkTargetMin}" style="max-width:160px"></label>
        <div><button class="btn btn-primary" id="saveSch">Save schedule</button></div>
      </div></div>
    <div class="section-title"><h2>Recent runs</h2><span>Newest first</span></div>
    <div class="log">${
      st.log.length
        ? st.log
            .map(
              (l) =>
                `<div><span>${esc(fmtTime(l.at))}</span><b>${esc({ morning: '11 AM', progress: '5 PM', closure: '8 PM' }[l.slot] || l.slot)}${l.test ? ' test' : l.manual ? ' manual' : ''}</b><span class="${l.ok ? 'good' : 'bad'}">${
                  l.ok ? `✓ ${l.sent} mail${l.sent === 1 ? '' : 's'} sent` : `✕ ${esc(l.error || (l.failed || [])[0] || 'failed')}`
                }${l.warning ? `<br><small>${esc(l.warning)}</small>` : ''}</span></div>`
            )
            .join('')
        : '<div class="empty" style="display:block">No runs yet</div>'
    }</div>`;
  $('#saveSch').onclick = async () => {
    try {
      S.status = await api('/api/config', {
        body: { enabled: $('#en').checked, sendIndividual: $('#ind').checked, sendTeam: $('#tm').checked, talkTargetMin: Number($('#talk').value), slots: { morning: $('#t-morning').value, progress: $('#t-progress').value, closure: $('#t-closure').value } },
      });
      S.data = null;
      paintChrome();
      toast('Schedule saved', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  };
}

// ---------- Settings ----------
async function settings() {
  await load(true);
  const st = S.status;
  const g = st.google || {};
  title('Settings', 'Lighthouse login and email account');
  view.innerHTML = `
    <div class="grid g-2" style="grid-template-columns:1fr 1fr">
      <div class="card rise"><h3>Lighthouse</h3><div class="sub" style="margin-bottom:12px">${st.lighthouse ? (st.refreshError ? `<span style="color:var(--red)">${esc(st.refreshError)}</span>` : `Connected · last data ${esc(fmtTime(st.dataAt))}`) : 'Not connected'}</div>
        <div class="form"><label>Authorization value<textarea id="lhAuth" rows="3" placeholder="Bearer eyJ…"></textarea></label>
          <p class="note">In Chrome open Lighthouse → F12 → Network → click any request → Request Headers → copy the <b>authorization</b> value and paste it here. The login expires now and then; paste a fresh one when Refresh says the login was refused.</p>
          <div><button class="btn btn-primary" id="saveLh">Save login</button></div></div></div>
      <div class="card rise" style="--i:1"><h3>Email (Gmail)</h3><div class="sub" style="margin-bottom:12px">${g.email ? `Signed in with Google · sending as <b>${esc(g.email)}</b>` : st.email ? `Sending as ${esc(st.sender)} with an App Password` : 'Not set up'}</div>
        <div class="form">
          ${st.gated ? `<p class="note">You are signed in as <b>${esc(st.user || '')}</b> · <a href="/auth/logout">Sign out</a>${st.owner ? '' : '. Only the owner can change settings or send mail.'}</p>` : ''}
          ${st.storage ? '' : '<div class="callout red">No database is connected, so settings and history will not be kept. Add Upstash Redis from the Vercel Storage tab.</div>'}
          ${g.email
            ? `<div class="callout green">✓ Mails go out from ${esc(g.email)} through Google sign-in.</div>
               <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost" id="chkEm">Check connection</button><a class="btn btn-ghost" href="/auth/google">Switch account</a><button class="btn btn-ghost" id="gOut">Sign out</button></div>`
            : g.clientReady
            ? `<div><a class="btn btn-primary" href="/auth/google">Connect mailbox with Google</a></div>
               <p class="note">Only <b>@${esc(g.domain)}</b> accounts are accepted. Google will ask for permission to send email on your behalf; nothing else is requested.</p>`
            : `<p class="note">One-time setup: create a Google sign-in client, then paste its two values here. Steps are in the README under “Sign in with Google”.</p>`}
          <details ${g.clientReady ? '' : 'open'}><summary style="cursor:pointer;font-weight:600;margin:6px 0">Google sign-in client</summary>
            <div class="form" style="margin-top:10px">
              <label>Client ID<input type="text" id="gId" placeholder="…apps.googleusercontent.com"></label>
              <label>Client secret<input type="password" id="gSecret" placeholder="${g.clientReady ? 'Leave blank to keep the saved one' : ''}" autocomplete="new-password"></label>
              <p class="note">Redirect URI to enter in Google Cloud: <b>http://localhost:3100/auth/google/callback</b></p>
              <div><button class="btn btn-ghost" id="gSave">Save client</button></div>
            </div></details>
          <details><summary style="cursor:pointer;font-weight:600;margin:6px 0">Other mail server (SMTP) ${!g.email && st.smtp && st.smtp.ready ? '· in use' : ''}</summary>
            <div class="form" style="margin-top:10px">
              <p class="note">For your own mail server (for example Postal) or a relay. Used only when you are not signed in with Google.</p>
              <label>Server<input type="text" id="smHost" value="${esc((st.smtp && st.smtp.host) || '')}" placeholder="postal.example.com"></label>
              <label>Port<input type="number" id="smPort" value="${esc(String((st.smtp && st.smtp.port) || 465))}"></label>
              <label>Username<input type="text" id="smUser" value="${esc((st.smtp && st.smtp.user) || '')}"></label>
              <label>Password<input type="password" id="smPass" placeholder="Leave blank to keep the saved one" autocomplete="new-password"></label>
              <label>Send as (your @${esc(g.domain || 'uprio.com')} address)<input type="email" id="smFrom" value="${esc((st.smtp && st.smtp.fromEmail) || '')}"></label>
              <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost" id="smSave">Save server</button>${g.email ? '' : '<button class="btn btn-ghost" id="chkEm">Check connection</button>'}</div>
            </div></details>
          <label>Name shown as sender<input type="text" id="emName" value="${esc(st.fromName || '')}"></label>
          <div><button class="btn btn-ghost" id="saveEm">Save name</button></div>
          <div id="emRes"></div></div></div>
    </div>`;
  $('#saveLh').onclick = async () => {
    try {
      await api('/api/login', { body: { auth: $('#lhAuth').value } });
      toast('Lighthouse login saved. Refreshing…', 'ok');
      $('#refreshBtn').click();
    } catch (err) {
      toast(err.message, 'err');
    }
  };
  $('#saveEm').onclick = async () => {
    try {
      await api('/api/email-settings', { body: { fromName: $('#emName').value } });
      toast('Sender name saved', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  };
  $('#smSave').onclick = async () => {
    try {
      await api('/api/email-settings', { body: { host: $('#smHost').value, port: $('#smPort').value, user: $('#smUser').value, pass: $('#smPass').value, fromEmail: $('#smFrom').value } });
      toast('Mail server saved', 'ok');
      settings();
    } catch (err) {
      toast(err.message, 'err');
    }
  };
  $('#gSave').onclick = async () => {
    try {
      await api('/api/google-client', { body: { id: $('#gId').value, secret: $('#gSecret').value } });
      toast('Google client saved', 'ok');
      settings();
    } catch (err) {
      toast(err.message, 'err');
    }
  };
  if ($('#gOut'))
    $('#gOut').onclick = async () => {
      await api('/api/google-signout', { body: {} });
      toast('Signed out of Google', 'ok');
      settings();
    };
  if ($('#chkEm')) $('#chkEm').onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await api('/api/email-check', { body: {} });
      $('#emRes').innerHTML = '<div class="callout green">✓ The mail login was accepted. Emails can be sent.</div>';
    } catch (err) {
      $('#emRes').innerHTML = `<div class="callout red">✕ ${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  };
}

// ---------- start ----------
view.innerHTML = '<div class="grid g-kpi">' + '<div class="skeleton" style="height:150px"></div>'.repeat(9) + '</div>';
route();
setInterval(async () => {
  // Quietly keep the sidebar status current.
  try {
    S.status = await api('/api/status');
    paintChrome();
  } catch {}
}, 60000);
