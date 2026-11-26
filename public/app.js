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
    <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c81e8"/><stop offset="1" stop-color="#33379e"/></linearGradient>
    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4fc4" stop-opacity=".28"/><stop offset="1" stop-color="#4a4fc4" stop-opacity="0"/></linearGradient>
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
// Short-lived memory of GET answers: pages open instantly, and hovering a TM loads their page early.
const apiCache = new Map();
function cachedApi(path, ttl = 120000) {
  const hit = apiCache.get(path);
  if (hit && Date.now() - hit.at < ttl) return hit.p;
  const p = api(path);
  apiCache.set(path, { at: Date.now(), p });
  p.catch(() => apiCache.delete(path));
  return p;
}
// Pages that open at once: the last answer (kept on this device for this person) is drawn straight away, the fresh
// one is fetched behind it and the page is drawn again only if something changed (never while someone is typing).
const swrMem = new Map();
// the person's address is remembered, so a page opened directly finds its saved copy before the sign-in answer is in
const swrUser = () => {
  if (S.status && S.status.user) {
    try {
      localStorage.setItem('swr-user', S.status.user);
    } catch {}
    return S.status.user;
  }
  try {
    return localStorage.getItem('swr-user') || '';
  } catch {
    return '';
  }
};
const swrKey = (path) => 'swr:' + swrUser() + ':' + path;
function swrPeek(path) {
  try {
    return JSON.parse(swrMem.get(swrKey(path)) || localStorage.getItem(swrKey(path)));
  } catch {
    return null;
  }
}
async function swrFetch(path, rerender, routeHash) {
  const key = swrKey(path);
  let raw = swrMem.get(key);
  if (!raw) {
    try {
      raw = localStorage.getItem(key);
    } catch {}
  }
  const fresh = api(path).then((j) => {
    const s = JSON.stringify(j);
    const changed = Boolean(raw) && s !== raw;
    swrMem.set(key, s);
    try {
      localStorage.setItem(key, s);
    } catch {}
    const typing = document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
    const open = document.querySelector('.ms-pop:not([hidden])');
    if (changed && rerender && !typing && !open && location.hash.startsWith(routeHash)) rerender();
    return j;
  });
  if (raw) {
    fresh.catch(() => {});
    try {
      return JSON.parse(raw);
    } catch {}
  }
  return fresh;
}
// After sign-in the main lists are fetched quietly, so the first visit to a page is already instant.
async function swrWarm() {
  const st = S.status;
  if (!st || document.hidden) return;
  const paths = st.role === 'viewer' ? ['/api/tutors', '/api/tutor-leaves'] : ['/api/students-all', '/api/renewals', '/api/tutors', '/api/tutor-leaves'];
  await Promise.all(
    paths.map(async (p) => {
      try {
        const s = JSON.stringify(await api(p));
        swrMem.set(swrKey(p), s);
        localStorage.setItem(swrKey(p), s);
      } catch {}
    })
  );
}
// Shown instead of the hub when it is on the internet and nobody is signed in.
function showLogin(j) {
  // signed out: forget the saved page data of this device
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('swr:') || k === 'swr-user') localStorage.removeItem(k);
  } catch {}
  swrMem.clear();
  if ($('#loginScreen')) return;
  const d = document.createElement('div');
  d.id = 'loginScreen';
  d.innerHTML = `<div class="login-card"><span class="brand-mark">${(document.querySelector('.brand-mark') || {}).innerHTML || ''}</span><h2>Lighthouse V2</h2><p>Sign in with your <b>@${esc(j.domain || 'uprio.com')}</b> Google account to continue.</p>${j.clientReady ? '<a class="btn btn-primary" href="/auth/login">Sign in with Google</a>' : '<p class="note">Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the Vercel project settings.</p>'}</div>`;
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
const TALK_LABEL = { clear: 'Target met', ok: 'On track', watch: 'Concerning', critical: 'Needs attention' };
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
    const dur = 380;
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
    }, 0)
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
const daysAgo = (iso) => (iso ? istDaysAgo(iso) : null);

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
  S.score = j.score;
  S.data = j.board;
  if (!S.slot && j.board) S.slot = j.board.slot;
  paintChrome();
  return S.data;
}
const ROLE_ROUTES = { tm: ['dashboard', 'tm', 'tasks', 'tracker', 'ptm', 'students', 'renewals', 'tutors'], viewer: ['dashboard', 'tutors'] };
function roleOK(name) {
  const role = S.status && S.status.role;
  return !role || role === 'owner' || (ROLE_ROUTES[role] || []).includes(name);
}
// "Connect my mailbox" link in the sidebar (TMs; the owner already has the hub mailbox)
async function paintMailbox() {
  const el = document.getElementById('mbLink');
  if (!el || !S.status || S.status.role !== 'tm') {
    if (el) el.innerHTML = '';
    return;
  }
  try {
    const j = await api('/api/my-mailbox');
    el.innerHTML = j.connected
      ? '<span class="mb-ok">✉ Your mailbox is connected</span><a href="#" id="mbOff">Disconnect</a>'
      : '<a class="mb-on" href="/auth/mailbox">✉ Connect my mailbox</a><small>So mails can go from your own address</small>';
    const off = document.getElementById('mbOff');
    if (off) off.onclick = async (e) => {
      e.preventDefault();
      if (!confirm('Disconnect your mailbox? Mails will no longer be sent from your address.')) return;
      await api('/api/my-mailbox/disconnect', { body: {} });
      toast('Mailbox disconnected', 'ok');
      paintMailbox();
    };
  } catch {
    el.innerHTML = '';
  }
}
function paintChrome() {
  setTimeout(paintMailbox, 0);
  const st = S.status;
  if (!st) return;
  const role = st.role || 'owner';
  $$('.nav a[data-route]').forEach((a) => (a.hidden = !roleOK(a.dataset.route)));
  const nav = $('.nav');
  let mine = $('#navMine');
  if (role === 'tm' && nav) {
    if (!mine) {
      mine = document.createElement('a');
      mine.id = 'navMine';
      mine.dataset.route = 'tm';
      mine.innerHTML = '<i></i><span>My profile</span>';
      const first = nav.querySelector('a[data-route="tasks"]');
      nav.insertBefore(mine, first || null);
    }
    mine.href = '#/tm/' + encodeURIComponent(st.myTm);
  } else if (mine) mine.remove();
  const sb = $('.nav a[data-route="settings"]');
  if (sb) sb.dataset.badge = st.pendingAccess ? String(st.pendingAccess) : '';
  $('#sideStatus').innerHTML = `<small>Last refresh at</small><b>${esc(fmtTime(st.dataAt))}</b>${st.refreshError ? '<small class="err">Last refresh had an error</small>' : ''}`;
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
  loaderShow('Getting fresh data from Lighthouse');
  try {
    const j = await api('/api/refresh', { body: {} });
    toast(j.errors && j.errors.length ? `Refreshed, but ${j.errors.length} list(s) failed: ${j.errors[0]}` : 'Fresh data loaded from Lighthouse', j.errors && j.errors.length ? 'err' : 'ok');
    S.data = null;
    apiCache.clear();
    ptmToday = null;
    route(true);
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    loaderHide();
    btn.classList.remove('loading');
    btn.disabled = false;
  }
};

// ---------- router ----------
// calendar days between an instant and now, counted by the date in India (a call at 3 PM yesterday is "yesterday" at 9 AM)
const istDaysAgo = (iso) => {
  const day = (d) => Date.parse(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) + 'T00:00:00Z');
  return Math.round((day(new Date()) - day(new Date(iso))) / 86400000);
};
// Click-to-sort column headers: an arrow shows on hover, a click sorts one way and the next click the other way
const thSort = (label, col, st, cls) => `<th class="sortable${cls ? ' ' + cls : ''}${st.col === col ? ' on' : ''}" data-col="${col}" title="Sort by ${esc(label)}">${label}<span class="sa">${st.col === col ? (st.dir > 0 ? '▲' : '▼') : '⇅'}</span></th>`;
function bindSort(table, st, repaint) {
  table.querySelectorAll('th.sortable').forEach((th) => {
    th.onclick = () => {
      st.dir = st.col === th.dataset.col ? -st.dir : 1;
      st.col = th.dataset.col;
      table.querySelectorAll('th.sortable').forEach((h) => {
        const on = h.dataset.col === st.col;
        h.classList.toggle('on', on);
        h.querySelector('.sa').textContent = on ? (st.dir > 0 ? '▲' : '▼') : '⇅';
      });
      repaint();
    };
  });
}
const cmpVal = (x, y) => (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' }));
// "24 Nov, 12:42 pm / 5 min 24 sec / yesterday" for the last connected parent call
function lastCallHtml(c) {
  if (!c) return '<small style="color:var(--ink-3)">No connected call found</small>';
  const when = new Date(c.at).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  const days = istDaysAgo(c.at);
  const ago = days <= 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';
  const sec = c.seconds;
  const dur = sec == null ? 'length not available' : sec < 60 ? sec + ' sec' : Math.floor(sec / 60) + ' min ' + (sec % 60 ? (sec % 60) + ' sec' : '');
  return '<b>' + esc(when) + '</b><br><small>' + esc(dur) + (c.incoming ? ' · parent called' : '') + '</small><br><small style="color:' + (days > 7 ? 'var(--red)' : 'var(--ink-3)') + '">' + ago + '</small>';
}
// ---------- Renewals: the Vantage renewal list with filters ----------
const rnBlank = () => ({ q: '', tm: [], office: [], status: [], at: [], school: [], grade: [], band: [], rtype: [], ptm: [], quick: '', rem: false, sort: 'att', col: '', dir: 1, limit: 150 });
let rnState = rnBlank();
// tick-box dropdown: pick several values at once
function rnMs(key, label, options, cur) {
  const many = options.length > 10;
  const names = options.filter((o) => cur.includes(o.v)).map((o) => o.l);
  const text = !names.length ? label : names.length <= 2 ? names.join(', ') : names.length + ' selected';
  return `<div class="ms" data-key="${key}" data-label="${esc(label)}"><button type="button" class="ms-btn ${names.length ? 'has' : ''}" title="${esc(label)}"><span>${esc(text)}</span><i>▾</i></button>
    <div class="ms-pop" hidden>${many ? '<input class="ms-q" placeholder="Search…" autocomplete="off">' : ''}
      <div class="ms-list">${options.map((o) => `<label class="ms-opt"><input type="checkbox" value="${esc(o.v)}" ${cur.includes(o.v) ? 'checked' : ''}><span>${esc(o.l)}</span></label>`).join('')}</div>
      <div class="ms-foot"><button type="button" class="ms-clear">Clear</button><button type="button" class="ms-done">Done</button></div></div></div>`;
}
const rnIsOwner = () => !S.status || !S.status.role || S.status.role === 'owner';
// One hidden file input lives in the page; the Upload button opens it.
function rnEnsureInput() {
  let inp = document.getElementById('rnFile');
  if (inp) return inp;
  inp = document.createElement('input');
  inp.type = 'file';
  inp.id = 'rnFile';
  inp.accept = 'application/json,.json';
  inp.hidden = true;
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const out = await api('/api/renewals/import', { body: { rows: j.rows || j, source: j.source || 'Uploaded from ' + f.name } });
      toast('Loaded ' + out.count + ' students', 'ok');
      inp.value = '';
      renewals();
    } catch (e) {
      toast(e.message || 'Could not read that file', 'err');
    }
  };
  document.body.appendChild(inp);
  return inp;
}
function rnUpload() {
  rnEnsureInput().click();
}
// PTM status of the last 20 days for one student
const RN_PTM = {
  completed: ['PTM done', 'ok'],
  no_show: ['Parent no-show', 'red'],
  unmarked: ['Not marked', 'amber'],
  live: ['In progress', 'blue'],
  upcoming: ['Scheduled', 'blue'],
  cancelled: ['Cancelled', ''],
};
const rnPtmKey = (r) => (!r.ptm ? 'none' : r.ptm.state === 'cancelled' ? 'none' : r.ptm.state);
async function renewals() {
  title('Renewals', 'Students due to renew, with their status and remarks');
  view.innerHTML = loader();
  let j;
  try {
    j = await swrFetch('/api/renewals', renewals, '#/renewals');
  } catch (err) {
    view.innerHTML = `<div class="card"><h3>No renewal data loaded</h3><p class="note">${esc(err.message)}</p>${rnIsOwner() ? '<button class="btn btn-primary" id="rnUp" type="button">⬆ Upload renewal data (.json)</button>' : ''}</div>`;
    const up = $('#rnUp');
    if (up) {
      rnEnsureInput();
      up.onclick = rnUpload;
    }
    return;
  }
  const rows = j.rows;
  // the list is drawn at once; live call details join in a moment later
  api('/api/last-calls').then((c) => {
    for (const r of rows) if (c.map[r.id]) r.lastCall = { ...c.map[r.id], src: 'call' };
    const b = document.getElementById('rnBody');
    if (location.hash.startsWith('#/renewals') && b) b.dispatchEvent(new Event('repaint'));
  }).catch(() => {});
  // the PTM objects double as "meetings" for the shared remark editor
  for (const r of rows) if (r.ptm) Object.assign(r.ptm, { tm: r.tm, student: r.name });
  window.__ptmMeetings = rows.filter((r) => r.ptm).map((r) => r.ptm);
  const uniq = (k) => [...new Set(rows.map((r) => r[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const O = (list) => list.map((v) => (Array.isArray(v) ? { v: v[0], l: v[1] } : { v, l: v }));
  const opt = (key, label, list) => rnMs(key, label, O(list), rnState[key]);
  title('Renewals', `${j.source || ''} · loaded ${new Date(j.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`);
  view.innerHTML = `
    <div class="toolbar team-tools" style="flex-wrap:wrap">
      <div class="search"><input id="rnQ" placeholder="Search ${rows.length} students by name, ID, school or remarks…" autocomplete="off" value="${esc(rnState.q)}"></div>
      ${j.team.length > 1 ? opt('tm', 'All TMs', j.team) : ''}
      ${opt('office', 'All offices', uniq('office'))}
      ${opt('status', 'Any sales status', uniq('status'))}
      ${opt('at', 'Any academic status', uniq('atStatus'))}
      ${opt('rtype', 'Any renewal', [['1st', '1st renewal'], ['2nd', '2nd renewal'], ['3rd', '3rd renewal'], ['3rd +', '3rd+ renewal']].filter((v) => rows.some((r) => r.rtype === v[0])))}
      ${opt('ptm', 'Any PTM status', [['completed', 'PTM done'], ['no_show', 'Parent no-show'], ['unmarked', 'Not marked'], ['upcoming', 'Scheduled'], ['none', 'No PTM in 20 days']])}
      ${opt('school', 'All schools', uniq('school'))}
      ${opt('grade', 'All classes', uniq('grade').map((g) => [g, 'Class ' + g]))}
      ${opt('band', 'Any attendance', ['Below 60%', '60% to 79%', '80% and above'])}
      <label class="fchip" style="cursor:pointer"><input type="checkbox" id="rnRem" ${rnState.rem ? 'checked' : ''}> With remarks only</label>
      <select class="sel" id="rnSort" title="Sort"><option value="att" ${rnState.sort === 'att' ? 'selected' : ''}>Lowest attendance first</option><option value="call" ${rnState.sort === 'call' ? 'selected' : ''}>Longest since last call first</option><option value="name" ${rnState.sort === 'name' ? 'selected' : ''}>Name A to Z</option><option value="tm" ${rnState.sort === 'tm' ? 'selected' : ''}>TM</option></select>
      <span style="flex:1"></span>
      ${rnIsOwner() ? '<button class="btn btn-ghost" id="rnUp" type="button" title="Load a newer export of the renewal list">⬆ Upload data</button>' : ''}
      <button class="btn btn-ghost" id="rnClear" type="button">Clear filters</button>
      <button class="btn btn-ghost" id="rnCsv" type="button">⬇ CSV</button>
    </div>
    <div class="rn-chips" id="rnSum"></div>
    <div class="note" style="margin:0 0 10px">PTM status covers ${esc(j.ptmFrom || '')} to ${esc(j.ptmTo || '')} (last 20 days). ${j.ptmError ? `<span style="color:var(--red)">PTM data could not load: ${esc(j.ptmError)}</span>` : ''}</div>
    <div class="card" style="padding:0"><div class="table-wrap" style="max-height:74vh;overflow:auto"><table class="tbl rn-tbl"><thead><tr><th class="num">#</th>${thSort('Student', 'name', rnState)}${thSort('School', 'school', rnState)}${thSort('TM', 'tm', rnState)}${thSort('Office', 'office', rnState)}${thSort('Status', 'status', rnState)}${thSort('Renewal', 'rtype', rnState)}${thSort('Last parent call', 'call', rnState)}${thSort('PTM (last 20 days)', 'ptm', rnState)}${thSort('Remarks', 'remarks', rnState)}</tr></thead><tbody id="rnBody"></tbody></table></div></div>
    <div id="rnMore" style="margin:12px 0"></div>`;
  const tagOf = (v, kind) => {
    if (!v) return '';
    const sales = { 'Will Pay': 'ok', 'Potential Discontinuation': 'amber', Discontinued: 'red' };
    const acad = { 'Will Pay': 'ok', 'Need Intervention': 'amber', 'Confirmed Discontinuation': 'red', 'Batch Blocking': 'red' };
    return `<span class="ptag ${(kind === 'sales' ? sales : acad)[v] || ''}">${esc(v)}</span>`;
  };
  const atRisk = (r) => r.status === 'Potential Discontinuation' || r.status === 'Discontinued' || r.atStatus === 'Confirmed Discontinuation';
  const QUICK = {
    all: () => true,
    willpay: (r) => r.atStatus === 'Will Pay',
    intervene: (r) => r.atStatus === 'Need Intervention',
    risk: atRisk,
    notset: (r) => r.status === 'Not set',
    remarks: (r) => !!r.remarks,
  };
  const has = (k, v) => !rnState[k].length || rnState[k].includes(v);
  const filtered = (skipQuick) => {
    const q = rnState.q.trim().toLowerCase();
    const l = rows.filter(
      (r) =>
        has('tm', r.tm) && has('office', r.office) && has('status', r.status) && has('at', r.atStatus) &&
        has('rtype', r.rtype) && has('ptm', rnPtmKey(r)) && has('school', r.school) && has('grade', r.grade) &&
        has('band', r.band) && (!rnState.rem || r.remarks) && (!q || `${r.name} ${r.id} ${r.school} ${r.remarks} ${r.office} ${r.tm}`.toLowerCase().includes(q)) &&
        (skipQuick || !rnState.quick || QUICK[rnState.quick](r))
    );
    const num = (r) => (r.att === '' ? 999 : Number(r.att));
    const callT = (r) => (r.lastCall ? new Date(r.lastCall.at).getTime() : 0);
    if (rnState.col) {
      const RT = { '1st': 1, '2nd': 2, '3rd': 3, '3rd +': 4 };
      const PR = ['completed', 'no_show', 'unmarked', 'live', 'upcoming', 'none'];
      const key = {
        name: (r) => r.name, school: (r) => r.school, tm: (r) => r.tm, office: (r) => r.office,
        status: (r) => (r.status || '') + ' ' + (r.atStatus || ''), rtype: (r) => RT[r.rtype] || 0,
        call: (r) => callT(r), ptm: (r) => PR.indexOf(rnPtmKey(r)), remarks: (r) => r.remarks || '',
      }[rnState.col];
      return l.slice().sort((a, b) => rnState.dir * cmpVal(key(a), key(b)) || a.name.localeCompare(b.name));
    }
    return l.slice().sort((a, b) => (rnState.sort === 'call' ? callT(a) - callT(b) || a.name.localeCompare(b.name) : rnState.sort === 'name' ? a.name.localeCompare(b.name) : rnState.sort === 'tm' ? a.tm.localeCompare(b.tm) || a.name.localeCompare(b.name) : num(a) - num(b) || a.name.localeCompare(b.name)));
  };
  const callCell = (r) => {
    const c = r.lastCall;
    if (!c) return '<small style="color:var(--ink-3)">No connected call found</small>';
    const d = new Date(c.at);
    const when = d.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
    const days = istDaysAgo(c.at);
    const ago = days <= 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';
    const sec = c.seconds;
    const dur = sec == null ? 'length not available' : sec < 60 ? sec + ' sec' : Math.floor(sec / 60) + ' min ' + (sec % 60 ? (sec % 60) + ' sec' : '');
    return '<b>' + esc(when) + '</b><br><small>' + esc(dur) + (c.incoming ? ' · parent called' : '') + '</small><br><small style="color:' + (days > 7 ? 'var(--red)' : 'var(--ink-3)') + '">' + ago + '</small>';
  };
  const ptmCell = (r) => {
    const p = r.ptm;
    if (j.ptmError) return '<small style="color:var(--ink-3)">PTM data unavailable</small>';
    if (!p || p.state === 'cancelled') return '<span class="ptag">No PTM in 20 days</span>';
    const [label, cls] = RN_PTM[p.state] || ['PTM', ''];
    const d = p.date ? new Date(p.date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
    const meta = [d, p.state === 'completed' && p.minutes ? p.minutes + ' min' : '', p.count > 1 ? p.count + ' meetings' : ''].filter(Boolean).join(' · ');
    return `<span class="ptag ${cls}">${esc(label)}</span><br><small style="color:var(--ink-3)">${esc(meta)}</small><div class="rm-cell rn-ptmrm" data-rm="${esc(p.id)}">${remarkHtml(p)}</div>`;
  };
  const paint = () => {
    const l = filtered();
    const shown = l.slice(0, rnState.limit);
    const base = filtered(true);
    const chip = (k, cls, label, n) => `<button type="button" class="ptag ${cls} rn-chip ${rnState.quick === k ? 'on' : ''}" data-q="${k}" title="Show only these students">${n} ${label}</button>`;
    $('#rnSum').innerHTML =
      chip('all', 'blue', 'students', base.length) +
      chip('willpay', 'ok', 'will pay (academic)', base.filter(QUICK.willpay).length) +
      chip('intervene', 'amber', 'need intervention', base.filter(QUICK.intervene).length) +
      chip('risk', 'red', 'at risk of leaving', base.filter(QUICK.risk).length) +
      chip('notset', '', 'sales status not set', base.filter(QUICK.notset).length) +
      chip('remarks', '', 'with remarks', base.filter(QUICK.remarks).length);
    $$('#rnSum .rn-chip').forEach((b) => (b.onclick = () => {
      rnState.quick = b.dataset.q === 'all' || rnState.quick === b.dataset.q ? '' : b.dataset.q;
      rnState.limit = 150;
      paint();
    }));
    $('#rnBody').innerHTML = shown.map((r, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td><b>${lhLink(`${CRM}/students/view/${r.id}`, esc(r.name))}</b><br><small style="color:var(--ink-3)">ID ${esc(r.id)} · Class ${esc(r.grade)}${r.batch ? ' · ' + esc(r.batch) : ''}</small></td>
        <td style="min-width:170px">${esc(r.school)}</td>
        <td style="white-space:nowrap">${esc(r.tm)}</td>
        <td style="min-width:130px">${esc(r.office)}</td>
        <td style="min-width:150px">${tagOf(r.status, 'sales')}<br>${tagOf(r.atStatus, 'at')}<br><small style="color:var(--ink-3)">Attendance ${esc(r.att || '—')}${r.att !== '' ? '%' : ''}</small></td>
        <td style="white-space:nowrap">${r.rtype ? `<span class="ptag rn-r${({ '1st': 1, '2nd': 2, '3rd': 3, '3rd +': 4 })[r.rtype] || 0}">${esc(r.rtype)}</span>` : '<small style="color:var(--ink-3)">—</small>'}</td>
        <td style="min-width:150px;white-space:nowrap">${callCell(r)}</td>
        <td style="min-width:200px">${ptmCell(r)}</td>
        <td class="rn-rem">${esc(r.remarks) || '<small style="color:var(--ink-3)">—</small>'}</td></tr>`).join('') || '<tr><td colspan="10" class="empty">No student matches</td></tr>';
    $('#rnMore').innerHTML = l.length > shown.length ? `<button class="btn btn-ghost" id="rnAll">Show all ${l.length}</button>` : `<span class="note">${l.length} student${l.length === 1 ? '' : 's'}</span>`;
    const all = $('#rnAll');
    if (all) all.onclick = () => ((rnState.limit = 9999), paint());
  };
  paint();
  $('#rnBody').addEventListener('repaint', () => paint());
  const bind = (id, key, ev) => {
    const el = $('#' + id);
    if (el) el[ev || 'onchange'] = (e) => {
      if (key === 'sort') rnState.col = '';
      rnState[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      rnState.limit = 150;
      paint();
    };
  };
  bind('rnQ', 'q', 'oninput');
  bind('rnRem', 'rem');
  // tick-box dropdowns
  const msLabel = (box) => {
    const checked = [...box.querySelectorAll('input:checked')].map((i) => i.nextElementSibling.textContent);
    box.querySelector('.ms-btn span').textContent = !checked.length ? box.dataset.label : checked.length <= 2 ? checked.join(', ') : checked.length + ' selected';
    box.querySelector('.ms-btn').classList.toggle('has', checked.length > 0);
  };
  const closeAll = (except) => $$('.ms-pop').forEach((p) => { if (p !== except) p.hidden = true; });
  $$('.ms').forEach((box) => {
    const key = box.dataset.key;
    const pop = box.querySelector('.ms-pop');
    box.querySelector('.ms-btn').onclick = (e) => {
      e.stopPropagation();
      closeAll(pop);
      pop.hidden = !pop.hidden;
      const q = box.querySelector('.ms-q');
      if (q && !pop.hidden) q.focus();
    };
    pop.onclick = (e) => e.stopPropagation();
    box.querySelectorAll('.ms-opt input').forEach((i) => (i.onchange = () => {
      rnState[key] = [...box.querySelectorAll('.ms-opt input:checked')].map((x) => x.value);
      rnState.limit = 150;
      msLabel(box);
      paint();
    }));
    box.querySelector('.ms-clear').onclick = () => {
      box.querySelectorAll('.ms-opt input').forEach((i) => (i.checked = false));
      rnState[key] = [];
      msLabel(box);
      paint();
    };
    box.querySelector('.ms-done').onclick = () => (pop.hidden = true);
    const q = box.querySelector('.ms-q');
    if (q) q.oninput = () => {
      const t = q.value.trim().toLowerCase();
      box.querySelectorAll('.ms-opt').forEach((o) => (o.hidden = !!t && !o.textContent.toLowerCase().includes(t)));
    };
  });
  if (!window.__rnMsBound) {
    window.__rnMsBound = true;
    document.addEventListener('click', () => $$('.ms-pop').forEach((p) => (p.hidden = true)));
  }
  bind('rnSort', 'sort');
  bindSort($('.rn-tbl'), rnState, () => paint());
  rnEnsureInput();
  if ($('#rnUp')) $('#rnUp').onclick = rnUpload;
  $('#rnClear').onclick = () => {
    rnState = rnBlank();
    renewals();
  };
  $('#rnCsv').onclick = () => {
    const l = filtered();
    const cols = [['Student ID', (r) => r.id], ['Student', (r) => r.name], ['School', (r) => r.school], ['Class', (r) => r.grade], ['TM', (r) => r.tm], ['Office', (r) => r.office], ['Sales status', (r) => r.status], ['Academic status', (r) => r.atStatus], ['Renewal', (r) => r.rtype], ['Attendance %', (r) => r.att], ['Last parent call', (r) => (r.lastCall ? new Date(r.lastCall.at).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' }) : '')], ['Last call length (sec)', (r) => (r.lastCall && r.lastCall.seconds != null ? r.lastCall.seconds : '')], ['PTM (20 days)', (r) => (r.ptm && r.ptm.state !== 'cancelled' ? (RN_PTM[r.ptm.state] || [''])[0] + ' ' + (r.ptm.date || '') : 'None')], ['PTM remark', (r) => (r.ptm && r.ptm.remark ? r.ptm.remark.text : '')], ['Remarks', (r) => r.remarks]];
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [cols.map((c) => q(c[0])).join(','), ...l.map((r) => cols.map((c) => q(c[1](r))).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = 'renewals.csv';
    a.click();
  };
}
// ---------- Tutor Management: the Vantage Tutor Master Dashboard list (owner only) ----------
const TT_TYPE = { regular: 'Regular', in_training: 'In training', i2_coach: 'I2 coach', one_on_one: 'One on one', co_tutor: 'Co-tutor', demo: 'Demo', olympiad: 'Olympiad', bootcamp_tutor: 'Bootcamp', internal: 'Internal', non_primary_tutor: 'Non-primary' };
const ttBlank = () => ({ q: '', stm: [], tm: [], type: [], subject: [], grade: [], city: [], lang: [], leave: [], quick: '', sort: 'name', col: '', dir: 1, limit: 150 });
let ttState = ttBlank();
// a Vantage/portal CSV (quoted fields, commas inside) read into rows
function ttCsv(text) {
  const t = text.replace(/^\uFEFF/, '');
  const out = [];
  let r = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { r.push(c); c = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; r.push(c); c = ''; if (r.length > 1 || r[0]) out.push(r); r = []; }
    else c += ch;
  }
  if (c || r.length) { r.push(c); out.push(r); }
  const H = out[0] || [];
  const col = (r, n) => String(r[H.indexOf(n)] == null ? '' : r[H.indexOf(n)]).replace(/\s+/g, ' ').trim();
  return out.slice(1).map((r) => ({
    id: col(r, 'Tutor ID'), name: col(r, 'Tutor Name'), mobile: col(r, 'Mobile Number'), email: col(r, 'Tutor Mail ID'), status: col(r, 'Status'), type: col(r, 'tutor_type'),
    subject: col(r, 'Subject'), grade: col(r, 'Primary Grade'), grades2: col(r, 'Secondary Grades'), lang: col(r, 'Language'), city: col(r, 'City'),
    joined: col(r, 'Date of Joining'), handover: col(r, 'Date of Handover'), lwd: col(r, 'Last Working Day'), resigned: col(r, 'Resignation Recorded'), lwdRec: col(r, 'Last Working Day (recorded)'),
    notice: col(r, 'Notice Served'), rtype: col(r, 'Resignation Type'), rnote: col(r, 'Resignation Note'), filledBy: col(r, 'Form Filled By'), filledOn: col(r, 'Filled On'),
    daysLeft: col(r, 'Days To Last Day'), leaving: col(r, 'Leaving Status'), tm: col(r, 'Tutor Manager'), tmId: col(r, 'Tutor Manager ID'), tmEmail: col(r, 'Tutor Manager Email'), stm: col(r, 'Sr Tutor Manager'),
  })).filter((x) => x.id && x.name);
}
function ttInput() {
  let inp = document.getElementById('ttFile');
  if (inp) return inp;
  inp = document.createElement('input');
  inp.type = 'file';
  inp.id = 'ttFile';
  inp.accept = '.csv,.json,text/csv,application/json';
  inp.hidden = true;
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const rows = /\.json$/i.test(f.name) ? (JSON.parse(txt).rows || JSON.parse(txt)) : ttCsv(txt);
      const out = await api('/api/tutors/import', { body: { rows, source: 'Uploaded from ' + f.name } });
      toast('Loaded ' + out.count + ' tutors', 'ok');
      inp.value = '';
      tutors();
    } catch (e) {
      toast(e.message || 'Could not read that file', 'err');
    }
  };
  document.body.appendChild(inp);
  return inp;
}
const ttDate = (s) => {
  const m = String(s || '').match(/(\d{1,2}) ([A-Za-z]{3}) (\d{4})/);
  return m ? Date.parse(m[1] + ' ' + m[2] + ' ' + m[3] + ' 12:00 UTC') : NaN;
};
async function tutors() {
  title('Tutor Management', 'Every tutor with their manager, subject, classes and resignation status');
  view.innerHTML = loader();
  let j;
  try {
    j = await swrFetch('/api/tutors', tutors, '#/tutors');
  } catch (err) {
    view.innerHTML = `<div class="card"><h3>No tutor data loaded</h3><p class="note">${esc(err.message)}</p>${rnIsOwner() ? '<button class="btn btn-primary" id="ttUp" type="button">⬆ Upload tutor data (.csv)</button>' : ''}</div>`;
    if ($('#ttUp')) { ttInput(); $('#ttUp').onclick = () => ttInput().click(); }
    return;
  }
  // leaves come live from Lighthouse; the page still works without them
  const lv = swrPeek('/api/tutor-leaves');
  const lvLive = swrFetch('/api/tutor-leaves', tutors, '#/tutors');
  // first visit: draw the tutors now and add the leaves when they arrive
  Promise.resolve(lvLive)
    .then(() => !lv && location.hash.startsWith('#/tutors') && swrPeek('/api/tutor-leaves') && tutors())
    .catch(() => {});
  const rows = j.rows;
  const now = Date.now();
  const lvDay = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const lvRange = (l) => (l.from === l.to ? lvDay(l.from) : lvDay(l.from) + ' to ' + lvDay(l.to));
  const lvBy = {};
  if (lv) for (const l of lv.leaves) (lvBy[l.tutorId] = lvBy[l.tutorId] || []).push(l);
  const weekEnd = lv ? new Date(Date.parse(lv.today + 'T00:00:00Z') + 7 * 86400000).toISOString().slice(0, 10) : '';
  for (const r of rows) {
    const mine = lvBy[String(r.id)] || [];
    r._lvNow = lv ? mine.find((l) => l.from <= lv.today && l.to >= lv.today) || null : null;
    r._lvSoon = lv ? mine.find((l) => l.from > lv.today && l.from <= weekEnd) || null : null;
    r._join = ttDate(r.joined);
    r._days = isNaN(r._join) ? null : Math.floor((now - r._join) / 86400000);
    r._leaving = r.resigned === 'Yes' || !!r.leaving;
    r._grades = [r.grade, ...String(r.grades2 || '').split(',').map((x) => x.trim())].filter(Boolean);
    r._type = TT_TYPE[r.type] || r.type;
  }
  const uniq = (f) => [...new Set(rows.flatMap((r) => [].concat(f(r))).filter(Boolean))].sort((x, y) => String(x).localeCompare(String(y), undefined, { numeric: true }));
  const O = (l) => l.map((v) => (Array.isArray(v) ? { v: v[0], l: v[1] } : { v, l: v }));
  const opt = (key, label, list) => rnMs(key, label, O(list), ttState[key]);
  title('Tutor Management', `${j.source || ''} · loaded ${new Date(j.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`);
  view.innerHTML = `
    <div class="toolbar team-tools" style="flex-wrap:wrap">
      <div class="search"><input id="ttQ" placeholder="Search ${rows.length} tutors by name, ID, mobile, mail or manager…" autocomplete="off" value="${esc(ttState.q)}"></div>
      ${opt('stm', 'All Sr tutor managers', uniq((r) => r.stm))}
      ${opt('tm', 'All tutor managers', uniq((r) => r.tm))}
      ${opt('type', 'Any tutor type', uniq((r) => r.type).map((v) => [v, TT_TYPE[v] || v]))}
      ${opt('subject', 'Any subject', uniq((r) => r.subject))}
      ${opt('grade', 'Any class', uniq((r) => r._grades).map((g) => [g, 'Class ' + g]))}
      ${opt('city', 'All cities', uniq((r) => r.city))}
      ${opt('lang', 'Any language', uniq((r) => String(r.lang).split(',').map((x) => x.trim())))}
      ${opt('leave', 'Any leaving status', uniq((r) => r.leaving))}
      <select class="sel" id="ttSort" title="Sort"><option value="name">Name A to Z</option><option value="new">Newest joined first</option><option value="old">Longest with us first</option><option value="tm">Tutor manager</option></select>
      <span style="flex:1"></span>
      ${rnIsOwner() ? '<button class="btn btn-ghost" id="ttUp" type="button" title="Load a newer export (.csv)">⬆ Upload data</button>' : ''}
      <button class="btn btn-ghost" id="ttClear" type="button">Clear filters</button>
      <button class="btn btn-ghost" id="ttCsv" type="button">⬇ CSV</button>
    </div>
    <div class="rn-chips" id="ttSum"></div>
    <div class="card" style="padding:0"><div class="table-wrap" style="max-height:74vh;overflow:auto"><table class="tbl rn-tbl"><thead><tr><th class="num">#</th>${thSort('Tutor', 'name', ttState)}<th>Contact</th>${thSort('Subject and classes', 'subject', ttState)}${thSort('City · Language', 'city', ttState)}${thSort('Joined', 'joined', ttState)}${thSort('Tutor manager', 'tm', ttState)}${thSort('Resignation', 'leave', ttState)}${thSort('Leave today', 'lv', ttState)}</tr></thead><tbody id="ttBody"></tbody></table></div></div>
    <div id="ttMore" style="margin:12px 0"></div>`;
  const QUICK = {
    all: () => true,
    leaving: (r) => r._leaving,
    onleave: (r) => !!r._lvNow,
    soon: (r) => !!r._lvSoon,
    fresh: (r) => r._days != null && r._days <= 30,
    training: (r) => r.type === 'in_training',
    both: (r) => /,/.test(r.subject),
    nomgr: (r) => !r.tm,
  };
  const has = (k, v) => !ttState[k].length || ttState[k].includes(v);
  const filtered = (skipQuick) => {
    const q = ttState.q.trim().toLowerCase();
    const l = rows.filter(
      (r) =>
        has('stm', r.stm) && has('tm', r.tm) && has('type', r.type) && has('subject', r.subject) && has('city', r.city) && has('leave', r.leaving) &&
        (!ttState.grade.length || r._grades.some((g) => ttState.grade.includes(g))) &&
        (!ttState.lang.length || String(r.lang).split(',').some((x) => ttState.lang.includes(x.trim()))) &&
        (!q || `${r.name} ${r.id} ${r.mobile} ${r.email} ${r.tm} ${r.stm}`.toLowerCase().includes(q)) &&
        (skipQuick || !ttState.quick || QUICK[ttState.quick](r))
    );
    const by = { name: (a, b) => a.name.localeCompare(b.name), new: (a, b) => (b._join || 0) - (a._join || 0), old: (a, b) => (a._join || 9e15) - (b._join || 9e15), tm: (a, b) => a.tm.localeCompare(b.tm) || a.name.localeCompare(b.name) };
    if (ttState.col) {
      const key = {
        name: (r) => r.name, subject: (r) => r.subject + ' ' + r.grade, city: (r) => r.city, joined: (r) => r._join || 0,
        tm: (r) => r.tm || '~', leave: (r) => (r._leaving ? (r.leaving === 'Overdue' ? 3 : 2) : 0), lv: (r) => (r._lvNow ? 2 : r._lvSoon ? 1 : 0),
      }[ttState.col];
      return l.slice().sort((a, b) => ttState.dir * cmpVal(key(a), key(b)) || a.name.localeCompare(b.name));
    }
    return l.slice().sort(by[ttState.sort] || by.name);
  };
  const tenure = (d) => (d == null ? '' : d < 31 ? d + ' days' : d < 365 ? Math.round(d / 30) + ' months' : (d / 365).toFixed(1) + ' years');
  const resCell = (r) => {
    if (!r._leaving) return '<small style="color:var(--ink-3)">—</small>';
    const cls = r.leaving === 'Overdue' ? 'red' : 'amber';
    const left = r.daysLeft === '' ? '' : Number(r.daysLeft) < 0 ? Math.abs(Number(r.daysLeft)) + ' days past last day' : r.daysLeft + ' days to last day';
    return `<span class="ptag ${cls}">${esc(r.leaving || 'Resigned')}</span><br><small>Last day ${esc(r.lwdRec || r.lwd || '—')}${left ? ' · ' + esc(left) : ''}</small><br><small style="color:var(--ink-3)">${esc(r.rtype)}${r.notice ? ' · notice ' + (r.notice === 'Yes' ? 'served' : 'not served') : ''}</small>${r.rnote ? '<br><small>' + esc(r.rnote) + '</small>' : ''}`;
  };
  const lvCell = (r) => {
    if (!lv) return '<small style="color:var(--ink-3)">Leaves unavailable</small>';
    const n = r._lvNow;
    const x = n || r._lvSoon;
    if (!x) return '<small style="color:var(--ink-3)">—</small>';
    return (n ? '<span class="ptag amber">On leave today</span>' : '<span class="ptag">Leave coming up</span>') + '<br><small>' + esc(lvRange(x)) + ' · ' + esc(x.type) + '</small>' + (x.remarks ? '<br><small style="color:var(--ink-3)">' + esc(x.remarks.length > 90 ? x.remarks.slice(0, 89) + '…' : x.remarks) + '</small>' : '');
  };
  const paint = () => {
    const l = filtered();
    const shown = l.slice(0, ttState.limit);
    const base = filtered(true);
    const chip = (k, cls, label, n) => `<button type="button" class="ptag ${cls} rn-chip ${ttState.quick === k ? 'on' : ''}" data-q="${k}" title="Show only these tutors">${n} ${label}</button>`;
    $('#ttSum').innerHTML =
      chip('all', 'blue', 'tutors', base.length) +
      chip('leaving', 'red', 'leaving or resigned', base.filter(QUICK.leaving).length) +
      (lv ? chip('onleave', 'amber', 'on leave today', base.filter(QUICK.onleave).length) + chip('soon', '', 'on leave in the next 7 days', base.filter(QUICK.soon).length) : '') +
      chip('fresh', 'ok', 'joined in last 30 days', base.filter(QUICK.fresh).length) +
      chip('training', 'amber', 'in training', base.filter(QUICK.training).length) +
      chip('both', '', 'teach Maths and Science', base.filter(QUICK.both).length) +
      chip('nomgr', '', 'no tutor manager', base.filter(QUICK.nomgr).length);
    $$('#ttSum .rn-chip').forEach((b) => (b.onclick = () => {
      ttState.quick = b.dataset.q === 'all' || ttState.quick === b.dataset.q ? '' : b.dataset.q;
      ttState.limit = 150;
      paint();
    }));
    $('#ttBody').innerHTML = shown.map((r, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td style="min-width:170px"><b>${esc(r.name)}</b><br><small style="color:var(--ink-3)">ID ${esc(r.id)}</small> <span class="ptag ${r.type === 'regular' ? 'blue' : ''}">${esc(r._type)}</span></td>
        <td style="min-width:190px;white-space:nowrap">${esc(r.mobile)}<br><small style="color:var(--ink-3)">${esc(r.email)}</small></td>
        <td style="min-width:150px"><b>${esc(r.subject)}</b><br><small>Class ${esc(r.grade)}${r.grades2 ? ' · also ' + esc(r.grades2) : ''}</small></td>
        <td style="min-width:140px">${esc(r.city) || '<small style="color:var(--ink-3)">—</small>'}<br><small style="color:var(--ink-3)">${esc(r.lang)}</small></td>
        <td style="white-space:nowrap">${esc(r.joined)}<br><small style="color:var(--ink-3)">${esc(tenure(r._days))}${r.handover ? ' · handover ' + esc(r.handover) : ''}</small></td>
        <td style="min-width:150px">${r.tm ? '<b>' + esc(r.tm) + '</b>' : '<small style="color:var(--ink-3)">Not assigned</small>'}<br><small style="color:var(--ink-3)">${esc(r.stm)}</small></td>
        <td style="min-width:200px">${resCell(r)}</td>
        <td style="min-width:190px">${lvCell(r)}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">No tutor matches</td></tr>';
    $('#ttMore').innerHTML = l.length > shown.length ? `<button class="btn btn-ghost" id="ttAll">Show all ${l.length}</button>` : `<span class="note">${l.length} tutor${l.length === 1 ? '' : 's'}</span>`;
    if ($('#ttAll')) $('#ttAll').onclick = () => ((ttState.limit = 9999), paint());
  };
  paint();
  $('#ttQ').oninput = (e) => { ttState.q = e.target.value; ttState.limit = 150; paint(); };
  $('#ttSort').value = ttState.sort;
  $('#ttSort').onchange = (e) => { ttState.sort = e.target.value; ttState.col = ''; paint(); };
  bindSort($('#ttBody').closest('table'), ttState, () => paint());
  const msLabel = (box) => {
    const checked = [...box.querySelectorAll('input:checked')].map((i) => i.nextElementSibling.textContent);
    box.querySelector('.ms-btn span').textContent = !checked.length ? box.dataset.label : checked.length <= 2 ? checked.join(', ') : checked.length + ' selected';
    box.querySelector('.ms-btn').classList.toggle('has', checked.length > 0);
  };
  const closeAll = (except) => $$('.ms-pop').forEach((p) => { if (p !== except) p.hidden = true; });
  $$('.ms').forEach((box) => {
    const key = box.dataset.key;
    const pop = box.querySelector('.ms-pop');
    box.querySelector('.ms-btn').onclick = (e) => { e.stopPropagation(); closeAll(pop); pop.hidden = !pop.hidden; const q = box.querySelector('.ms-q'); if (q && !pop.hidden) q.focus(); };
    pop.onclick = (e) => e.stopPropagation();
    box.querySelectorAll('.ms-opt input').forEach((i) => (i.onchange = () => {
      ttState[key] = [...box.querySelectorAll('.ms-opt input:checked')].map((x) => x.value);
      ttState.limit = 150; msLabel(box); paint();
    }));
    box.querySelector('.ms-clear').onclick = () => { box.querySelectorAll('.ms-opt input').forEach((i) => (i.checked = false)); ttState[key] = []; msLabel(box); paint(); };
    box.querySelector('.ms-done').onclick = () => (pop.hidden = true);
    const q = box.querySelector('.ms-q');
    if (q) q.oninput = () => { const t = q.value.trim().toLowerCase(); box.querySelectorAll('.ms-opt').forEach((o) => (o.hidden = !!t && !o.textContent.toLowerCase().includes(t))); };
  });
  if (!window.__rnMsBound) { window.__rnMsBound = true; document.addEventListener('click', () => $$('.ms-pop').forEach((p) => (p.hidden = true))); }
  ttInput();
  if ($('#ttUp')) $('#ttUp').onclick = () => ttInput().click();
  $('#ttClear').onclick = () => { ttState = ttBlank(); tutors(); };
  $('#ttCsv').onclick = () => {
    const l = filtered();
    const cols = [['Tutor ID', (r) => r.id], ['Tutor', (r) => r.name], ['Mobile', (r) => r.mobile], ['Mail', (r) => r.email], ['Type', (r) => r._type], ['Subject', (r) => r.subject], ['Primary class', (r) => r.grade], ['Other classes', (r) => r.grades2], ['Language', (r) => r.lang], ['City', (r) => r.city], ['Joined', (r) => r.joined], ['Handover', (r) => r.handover], ['Tutor manager', (r) => r.tm], ['Sr tutor manager', (r) => r.stm], ['Leaving status', (r) => r.leaving], ['Last working day', (r) => r.lwdRec || r.lwd], ['Resignation type', (r) => r.rtype], ['Resignation note', (r) => r.rnote], ['Leave today', (r) => (r._lvNow ? lvRange(r._lvNow) + ' ' + r._lvNow.type : '')], ['Leave in next 7 days', (r) => (r._lvSoon ? lvRange(r._lvSoon) + ' ' + r._lvSoon.type : '')]];
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [cols.map((c) => q(c[0])).join(','), ...l.map((r) => cols.map((c) => q(c[1](r))).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv' }));
    a.download = 'tutors.csv';
    a.click();
  };
}
// ---------- Task tracker ----------
// A board of four lanes (upcoming, due today, past due, completed) with the assignee's photo on every card,
// remarks on each task, drag to complete, and a little celebration when something is finished.
const tkState = { who: '', draft: '', open: new Set(), seen: new Set() };
// the popup is shared with other screens: drop the wide style when it closes
if ($('#modal')) new MutationObserver(() => $('#modal').hidden && $('#modalCard').classList.remove('tk-wide')).observe($('#modal'), { attributes: true, attributeFilter: ['hidden'] });
const tkDay = (d) => new Date(d.length === 10 ? d + 'T12:00:00Z' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: d.length === 10 ? 'UTC' : 'Asia/Kolkata' });
const tkDays = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
const TK_LANES = [
  ['next', 'Upcoming', 'blue'],
  ['today', 'Due today', 'amber'],
  ['late', 'Past due date', 'red'],
  ['done', 'Completed', 'green'],
];
// a task with a time is late once that time has passed on its day
const tkLane = (t, today, now) => (t.status === 'done' ? 'done' : t.due < today || (t.due === today && t.dueTime && now > t.dueTime) ? 'late' : t.due === today ? 'today' : 'next');
const tkClock = (v) => {
  const [h, m] = String(v).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
// the description and subject line follow the students picked in the preview
const tkStudentLine = (s) => `Student: ${s.name} (ID ${s.id}${s.grade ? ', Class ' + s.grade : ''}${s.school ? ', ' + s.school : ''})`;
const tkCompose = (p, picked) => [p.action, '', ...picked.map(tkStudentLine), p.schoolSubject ? 'Subject: ' + p.schoolSubject : ''].filter((x, i) => x || i === 1).join('\n').trim();
const tkSubject = (p, picked) => {
  const head = p.category ? p.category + (p.schoolSubject ? ' · ' + p.schoolSubject : '') : String(p.subject || '').split(' – ')[0];
  const names = picked.map((s) => s.name);
  const who = names.length > 2 ? names.slice(0, 2).join(', ') + ' +' + (names.length - 2) : names.join(', ');
  return [head, who].filter(Boolean).join(' – ');
};
const tkAvatar = (p, name, cls) =>
  p && p.photo
    ? `<img class="tk-av ${cls || ''}" src="/photos/${esc(p.photo)}" alt="" loading="lazy">`
    : `<span class="tk-av tk-ini ${cls || ''}">${esc(String(name).split(' ').map((w) => w[0]).slice(0, 2).join(''))}</span>`;
const tkCalm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function tkConfetti(x, y) {
  if (tkCalm()) return;
  const colours = ['#2b2f8f', '#16a34a', '#f59e0b', '#e8092f', '#0ea5e9'];
  for (let i = 0; i < 46; i++) {
    const s = document.createElement('i');
    s.className = 'tk-bit';
    const angle = Math.random() * Math.PI * 2;
    const reach = 60 + Math.random() * 130;
    s.style.cssText = `left:${x}px;top:${y}px;background:${colours[i % colours.length]};--dx:${Math.cos(angle) * reach}px;--dy:${Math.sin(angle) * reach - 40}px;--r:${Math.random() * 540}deg;animation-delay:${Math.random() * 80}ms`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1300);
  }
}
function tkCount(el) {
  const end = Number(el.dataset.n);
  if (tkCalm() || !end) return (el.textContent = end);
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 600);
    el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
async function tracker() {
  title('Task tracker', 'Assign work, follow it lane by lane, and note what was done');
  if (!$('.tk-board')) view.innerHTML = loader({ text: 'Loading tasks' });
  let j;
  try {
    j = await api('/api/tracker');
  } catch (err) {
    view.innerHTML = '<div class="card"><h3>Could not load tasks</h3><p class="note">' + esc(err.message) + '</p></div>';
    return;
  }
  const person = (n) => j.people.find((p) => p.name === n);
  const all = j.tasks.map((t) => ({ ...t, lane: tkLane(t, j.today, j.now), remarks: t.remarks || [], students: t.students || [], priority: t.priority || 'Medium' }));
  const byId = (id) => all.find((t) => t.id === id);
  const mine = (t) => j.role === 'owner' || t.createdByEmail === j.myEmail;
  const canFinish = (t) => mine(t) || t.assignee === j.me;

  const dueLine = (t) => {
    if (t.lane === 'done') {
      const late = tkDays(t.due, new Date(t.doneAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
      return `<span class="tk-due">Done ${tkDay(t.doneAt)}${late > 0 ? ` · <b class="tk-red">${late} day${late === 1 ? '' : 's'} past</b>` : ''}</span>`;
    }
    const past = tkDays(t.due, j.today);
    const timePassed = past === 0 && t.lane === 'late';
    return `<span class="tk-due">Due ${tkDay(t.due)}${t.dueTime ? ', ' + tkClock(t.dueTime) : ''}${past > 0 ? ` · <b class="tk-red">${past} day${past === 1 ? '' : 's'} past</b>` : timePassed ? ' · <b class="tk-red">time passed</b>' : ''}</span>`;
  };
  // predefined task: how many of its items are cleared, with the list behind a click
  const autoBlock = (t) => {
    const left = new Set(t.status === 'done' && t.doneBy === 'Automatic' ? [] : t.auto.left || t.auto.items.map((x) => x.id));
    const total = t.auto.items.length;
    const cleared = total - t.auto.items.filter((x) => left.has(x.id)).length;
    const key = 'list:' + t.id;
    return `<div class="tk-auto"><div class="tk-bar"><i style="width:${Math.round((100 * cleared) / total)}%"></i></div>
      <button class="tk-link" data-tk="items">${cleared} of ${total} cleared · ${tkState.open.has(key) ? 'hide' : 'show'} list</button>
      <ul class="tk-items" ${tkState.open.has(key) ? '' : 'hidden'}>${t.auto.items.map((x) => `<li class="${left.has(x.id) ? '' : 'ok'}"><span>${left.has(x.id) ? '○' : '✓'}</span><div>${x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name)}${x.note ? `<small>${esc(x.note)}</small>` : ''}</div></li>`).join('')}</ul></div>`;
  };
  const card = (t, i) => {
    const open = tkState.open.has(t.id);
    const fresh = !tkState.seen.has(t.id);
    return `<article class="tk-card ${t.lane} ${fresh ? 'tk-in' : ''}" style="--i:${i}" data-id="${t.id}" draggable="${canFinish(t) ? 'true' : 'false'}">
      <div class="tk-top"><span class="tk-pill p-${t.priority.toLowerCase()}">${esc(t.priority)}</span><span class="tk-date">Assigned ${tkDay(t.assignedAt)}</span>
        ${mine(t) && t.assignee !== j.me && t.lane !== 'done' ? `<button class="tk-ico" data-tk="remind" title="${t.mail === 'sent' ? 'Mailed. Send the mail again' : 'Send the task mail'}">@</button>` : ''}</div>
      <h4>${esc(t.title)}</h4>
      ${t.details ? `<p class="tk-details">${esc(t.details)}</p>` : ''}
      ${t.students.length ? `<div class="tk-stus">${t.students.map((s) => `<button class="tk-stu" data-tk="student" data-sid="${s.id}" title="See ${esc(s.name)}'s details">🎓 ${esc(s.name)}${s.grade ? `<small>Class ${esc(s.grade)}</small>` : ''}</button>`).join('')}</div>` : ''}
      <div class="tk-who">${tkAvatar(person(t.assignee), t.assignee)}<div><b>${esc(t.assignee)}</b><small>by ${esc(t.createdBy)}</small></div></div>
      <div class="tk-meta">${dueLine(t)}${mine(t) ? `<button class="tk-ico" data-tk="edit" title="Edit the task">✎</button>` : ''}</div>
      ${t.mail && t.mail !== 'sent' ? `<p class="tk-red tk-small" title="${esc(t.mail)}">Mail was not sent</p>` : ''}
      ${t.auto ? autoBlock(t) : ''}
      ${t.comment && t.lane === 'done' ? `<div class="tk-result"><b>What was done</b>${esc(t.comment)}<small>${esc(t.doneBy)}</small></div>` : ''}
      <div class="tk-actions">
        <button class="tk-btn ${open ? 'on' : ''}" data-tk="notes">💬 Remarks${t.remarks.length ? ` <em>${t.remarks.length}</em>` : ''}</button>
        ${t.lane !== 'done' && canFinish(t) ? '<button class="tk-btn go" data-tk="done">✓ Complete</button>' : ''}
        ${t.lane === 'done' && mine(t) ? '<button class="tk-btn" data-tk="reopen">↺ Reopen</button>' : ''}
        ${mine(t) ? '<button class="tk-btn bin" data-tk="delete" title="Delete">🗑</button>' : ''}
      </div>
      <div class="tk-thread ${open ? 'on' : ''}"><div>
        ${t.remarks.map((r) => `<div class="tk-note">${tkAvatar(person(r.by), r.by, 'sm')}<p><b>${esc(r.by.split(' ')[0])}</b> ${esc(r.text)}<small>${new Date(r.at).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small></p></div>`).join('') || '<p class="tk-small">No remarks yet.</p>'}
        <form class="tk-add"><input maxlength="1000" placeholder="Write a remark…" aria-label="Remark"><button type="submit" class="tk-btn go">Add</button></form>
      </div></div>
    </article>`;
  };

  const paint = () => {
    const list = all.filter((t) => !tkState.who || t.assignee === tkState.who);
    const done = list.filter((t) => t.lane === 'done').length;
    const pct = list.length ? Math.round((100 * done) / list.length) : 0;
    // a TM's photo row holds only themselves and people they have given a task to; nobody else's workload is shown
    const shown = j.role === 'owner' ? j.people : j.people.filter((p) => p.name === j.me || all.some((t) => t.assignee === p.name));
    const people = shown.map((p) => ({ ...p, open: all.filter((t) => t.assignee === p.name && t.lane !== 'done').length, late: all.filter((t) => t.assignee === p.name && t.lane === 'late').length }));
    view.innerHTML = `
      <form class="tk-quick" id="tkQuickForm">
        <label for="tkQuick">Write the task in one line: who, which student, what, when</label>
        <div><textarea id="tkQuick" rows="2" maxlength="2000" placeholder="e.g. Ask Preety to schedule PTM with Paridhi tomorrow 5pm, urgent. Parent is worried about science marks.">${esc(tkState.draft || '')}</textarea><button type="submit" class="btn btn-primary" id="tkPreview">Preview</button></div>
        <small>Nothing is created until you press Go on the preview.</small>
      </form>
      <div class="tk-head">
        <div class="tk-gauge" title="${done} of ${list.length} completed"><svg viewBox="0 0 100 100"><circle class="g-t" cx="50" cy="50" r="42"/><circle class="g-b" cx="50" cy="50" r="42" stroke-dasharray="263.9" stroke-dashoffset="${263.9 * (1 - pct / 100)}"/></svg><b>${pct}<i>%</i></b></div>
        <div class="tk-people">
          <button class="tk-person ${tkState.who ? '' : 'on'}" data-who=""><span class="tk-av tk-ini">All</span><small>Everyone</small></button>
          ${people.map((p) => `<button class="tk-person ${tkState.who === p.name ? 'on' : ''}" data-who="${esc(p.name)}" title="${esc(p.name)}: ${p.open} open${p.late ? ', ' + p.late + ' past due' : ''}">${tkAvatar(p, p.name)}${p.open ? `<em class="${p.late ? 'late' : ''}">${p.open}</em>` : ''}<small>${esc(p.name.split(' ')[0])}</small></button>`).join('')}
        </div>
        ${j.role === 'owner' ? `<label class="fchip" style="cursor:pointer" title="Mails everyone with a pending task every hour, 10 AM to 8 PM, Monday to Saturday"><input type="checkbox" id="tkHourly" ${j.reminders && j.reminders.enabled ? 'checked' : ''}> Hourly reminder mails</label>` : ''}
        <button type="button" class="btn btn-primary tk-new" id="tkNew">＋ Assign task</button>
      </div>
      <div class="tk-board">${TK_LANES.map(([key, name, tone]) => {
        const items = list.filter((t) => t.lane === key).sort((x, y) => (key === 'done' ? String(y.doneAt).localeCompare(String(x.doneAt)) : x.due.localeCompare(y.due)));
        return `<section class="tk-lane ${tone}" data-lane="${key}"><header><h3>${name}</h3><span data-n="${items.length}">0</span></header><div class="tk-cards">${items.map(card).join('') || '<p class="tk-empty">No tasks</p>'}</div></section>`;
      }).join('')}</div>
      <p class="tk-small" style="margin-top:8px">Tip: drag a card onto Completed to finish it.</p>`;
    $$('.tk-lane header span').forEach(tkCount);
    all.forEach((t) => tkState.seen.add(t.id));
    wire();
  };

  const send = async (body, done, after) => {
    try {
      const r = await api('/api/tracker', { body });
      $('#modal').hidden = true;
      if (r.skipped && r.skipped.length) toast('Assigned. Nothing pending for ' + r.skipped.join(', ') + ', so they got no task.', 'ok');
      if (r.mail && r.mail !== 'sent') toast('Saved. ' + r.mail, 'err');
      else if (done) toast(r.mail === 'sent' ? done + ' Mail sent.' : done, 'ok');
      if (after) after();
      await tracker();
    } catch (err) {
      toast(err.message, 'err');
    }
  };
  const modal = (head, fields, label, onOk) => {
    $('#modalCard').classList.remove('tk-wide');
    $('#modalCard').innerHTML = '<h3>' + head + '</h3><div class="form">' + fields + '</div><div class="actions"><button type="button" class="btn btn-ghost" id="tkNo">Cancel</button><button type="button" class="btn btn-primary" id="tkOk">' + label + '</button></div>';
    $('#modal').hidden = false;
    $('#tkNo').onclick = () => ($('#modal').hidden = true);
    $('#tkOk').onclick = (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      Promise.resolve(onOk()).finally(() => (btn.disabled = false));
    };
  };
  const priorityField = (now) => `<label>Priority<select id="tkPri">${['High', 'Medium', 'Low'].map((p) => `<option ${p === now ? 'selected' : ''}>${p}</option>`).join('')}</select></label>`;
  const finish = (t) => {
    const el = $(`.tk-card[data-id="${t.id}"]`);
    const box = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    modal('✓ Complete: ' + esc(t.title), '<label>Remarks (what was done)<textarea id="tkComment" rows="4" maxlength="2000"></textarea></label>', 'Mark complete', () =>
      send({ action: 'done', id: t.id, comment: $('#tkComment').value }, 'Marked complete.', () => tkConfetti(box.left + box.width / 2, box.top + box.height / 2))
    );
  };
  // one button ticks every TM (not the person assigning); a second press clears
  const wireAll = () => {
    const boxes = $$('input[name=tkTo]').filter((x) => x.value !== j.me);
    const label = () => ($('#tkAll').textContent = boxes.every((x) => x.checked) ? 'Clear all' : 'Select all TMs');
    $('#tkAll').onclick = () => {
      const on = !boxes.every((x) => x.checked);
      $$('input[name=tkTo]').forEach((x) => (x.checked = on && x.value !== j.me));
      label();
    };
    boxes.forEach((x) => (x.onchange = label));
    label();
  };
  const newTask = (parsed) => {
    const p = parsed && parsed.action !== undefined ? parsed : null;
    const byId_ = new Map(j.students.map((s) => [s.id, s]));
    // one group per name found in the text; picked = student id, 0 = "none of these", null = not decided
    const groups = p ? p.students.map((g) => ({ mention: g.mention, matches: g.matches, picked: g.selected })) : [];
    const extra = [];
    const picked = () => {
      const ids = [...groups.map((g) => g.picked), ...extra].filter(Boolean);
      return [...new Set(ids)].map((id) => byId_.get(id) || groups.flatMap((g) => g.matches).find((m) => m.id === id)).filter(Boolean);
    };
    const wanted = p ? p.assignees : tkState.who ? [tkState.who] : [];
    const edited = { title: false, details: false };
    const tag = (on) => (on ? ' <em class="tk-assumed">assumed, please check</em>' : '');
    const opt = (s) => `${esc(s.name)}<small>${[s.grade ? 'Class ' + s.grade : '', s.school, s.tm ? 'TM ' + s.tm.split(' ')[0] : '', 'ID ' + s.id].filter(Boolean).map(esc).join(' · ')}</small>`;
    modal(
      p ? '✨ Check before creating' : '＋ Assign a task',
      `<div class="tk-warn" id="tkWarn" hidden></div>
       <label>Task type<select id="tkType"><option value="">My own task</option>${(j.categories || []).map((c) => `<option value="${c.key}">${esc(c.label)} (from Lighthouse)</option>`).join('')}</select></label><p class="tk-small" id="tkPending" hidden></p>
       <label id="tkTitleRow">Subject<input id="tkTitle" maxlength="200" placeholder="What needs to be done" value="${p ? esc(p.subject) : ''}"></label>
       <label>Description<textarea id="tkDetails" rows="${p ? 6 : 3}" maxlength="2000" placeholder="Optional">${p ? esc(tkCompose(p, picked())) : ''}</textarea></label>
       <div id="tkStuRow"><div class="tk-lbl">Students</div><div id="tkStuBox"></div>
         <input id="tkStuAdd" list="tkStuList" autocomplete="off" placeholder="Add a student: type a name or ID"><datalist id="tkStuList">${j.students.map((s) => `<option value="${esc(s.name + ' · ' + s.id)}">${esc([s.grade ? 'Class ' + s.grade : '', s.school].filter(Boolean).join(' · '))}</option>`).join('')}</datalist></div>
       <div class="tk-lbl">Assign to${tag(p && p.assumed.assignee)} <small>(pick one or more)</small> <button type="button" class="tk-btn" id="tkAll">Select all TMs</button></div><div class="tk-pick">${j.people.map((x) => `<label title="${esc(x.name)}"><input type="checkbox" name="tkTo" value="${esc(x.name)}" ${wanted.includes(x.name) ? 'checked' : ''}>${tkAvatar(x, x.name, 'lg')}<small>${esc(x.name.split(' ')[0])}</small></label>`).join('')}</div>
       <div class="tk-row"><label>Due date${tag(p && p.assumed.date)}<input id="tkDue" type="date" min="${j.today}" value="${p && p.due >= j.today ? p.due : j.today}"></label><label>Time${tag(p && p.assumed.time)}<input id="tkTime" type="time" value="${p ? p.time : ''}"></label>${priorityField(p ? p.priority : 'Medium')}</div>
       <p class="note">A mail goes to the person the task is assigned to.</p>`,
      p ? 'Go – create task' : 'Assign and send mail',
      () => {
        const open = groups.filter((g) => g.picked === null);
        if (!$('#tkType').value && open.length) {
          toast('Choose the student for “' + open[0].mention + '” first.', 'err');
          return;
        }
        const type = $('#tkType').value;
        return send(
          { action: 'create', category: type, title: $('#tkTitle').value, details: $('#tkDetails').value, assignees: $$('input[name=tkTo]:checked').map((x) => x.value), students: type ? [] : picked().map((s) => s.id), due: $('#tkDue').value, dueTime: $('#tkTime').value, priority: $('#tkPri').value },
          'Task assigned.',
          () => {
            if (p) tkState.draft = '';
          }
        );
      }
    );
    $('#modalCard').classList.add('tk-wide');
    const refreshText = () => {
      if (!p) return;
      if (!edited.title) $('#tkTitle').value = tkSubject(p, picked());
      if (!edited.details) $('#tkDetails').value = tkCompose(p, picked());
    };
    // warnings follow what is picked now: students still to choose, and a student whose TM is not an assignee
    const paintWarnings = () => {
      const fixed = p ? p.warnings.filter((w) => !/matches \d+ students|'s student\.$/.test(w) && !/Choose who the task/.test(w)) : [];
      const names = $$('input[name=tkTo]:checked').map((x) => x.value);
      const live = [
        ...groups.filter((g) => g.picked === null).map((g) => `“${g.mention}” matches ${g.matches.length} students: pick the right one.`),
        ...(p && !names.length ? ['Choose who the task is for.'] : []),
        ...(names.length ? picked().filter((s) => s.tm && !names.includes(s.tm)).map((s) => `${s.name} is ${s.tm.split(' ')[0]}'s student.`) : []),
      ];
      const all = [...fixed, ...live];
      $('#tkWarn').hidden = !all.length;
      $('#tkWarn').innerHTML = all.map((w) => '<p>⚠ ' + esc(w) + '</p>').join('');
    };
    const paintStudents = () => {
      const choose = groups
        .map((g, i) =>
          g.matches.length > 1 || g.picked === 0
            ? `<fieldset class="tk-match ${g.picked === null ? 'need' : ''}"><legend>“${esc(g.mention)}” · ${g.matches.length} student${g.matches.length > 1 ? 's' : ''} match, pick one</legend>${g.matches.map((m) => `<label><input type="radio" name="tkM${i}" value="${m.id}" ${g.picked === m.id ? 'checked' : ''}><span>${opt(m)}${m.own ? '<b>their student</b>' : ''}</span></label>`).join('')}<label><input type="radio" name="tkM${i}" value="0" ${g.picked === 0 ? 'checked' : ''}><span>None of these</span></label></fieldset>`
            : ''
        )
        .join('');
      const sel = picked();
      $('#tkStuBox').innerHTML = choose + (sel.length ? `<div class="tk-stus">${sel.map((s) => `<span class="tk-stu sel">🎓 ${esc(s.name)}<small>${esc([s.grade ? 'Class ' + s.grade : '', s.tm ? 'TM ' + s.tm.split(' ')[0] : ''].filter(Boolean).join(' · '))}</small><button type="button" data-drop="${s.id}" aria-label="Remove ${esc(s.name)}">×</button></span>`).join('')}</div>` : choose ? '' : '<p class="tk-small">No student attached.</p>');
      paintWarnings();
    };
    paintStudents();
    $('#tkStuBox').onchange = (e) => {
      const m = /^tkM(\d+)$/.exec(e.target.name || '');
      if (!m) return;
      groups[Number(m[1])].picked = Number(e.target.value);
      paintStudents();
      refreshText();
    };
    $('#tkStuBox').onclick = (e) => {
      const b = e.target.closest('[data-drop]');
      if (!b) return;
      const id = Number(b.dataset.drop);
      groups.forEach((g) => g.picked === id && (g.picked = 0));
      const at = extra.indexOf(id);
      if (at >= 0) extra.splice(at, 1);
      paintStudents();
      refreshText();
    };
    $('#tkStuAdd').onchange = (e) => {
      const m = e.target.value.match(/(\d+)\s*$/);
      const s = m && byId_.get(Number(m[1]));
      if (!s) return toast('Pick the student from the list.', 'err');
      if (!picked().some((x) => x.id === s.id)) extra.push(s.id);
      e.target.value = '';
      paintStudents();
      refreshText();
    };
    $('#tkTitle').oninput = () => (edited.title = true);
    $('#tkDetails').oninput = () => (edited.details = true);
    wireAll();
    $$('input[name=tkTo]').forEach((x) => x.addEventListener('change', paintWarnings));
    $('#tkAll').addEventListener('click', paintWarnings);
    paintWarnings();
    // a predefined type needs no title or students; show how much is pending for each person picked
    const pending = () => {
      const key = $('#tkType').value;
      $('#tkTitleRow').hidden = Boolean(key);
      $('#tkStuRow').hidden = Boolean(key);
      const box = $('#tkPending');
      box.hidden = !key;
      if (!key) return;
      const names = $$('input[name=tkTo]:checked').map((x) => x.value);
      box.textContent = !names.length
        ? 'Pick who it is for to see what is pending.'
        : 'Pending now: ' + names.map((n) => n.split(' ')[0] + ' ' + (j.counts[n] ? j.counts[n][key] : 'none')).join(', ') + '. The task completes itself when Lighthouse shows them cleared.' + (j.role === 'owner' ? '' : ' You can create these only for yourself.');
    };
    $('#tkType').onchange = pending;
    $$('input[name=tkTo]').forEach((x) => x.addEventListener('change', pending));
    $('#tkAll').addEventListener('click', pending);
  };

  // the student card behind a chip: who they are, parents (for those allowed), recent PTMs, and the Lighthouse profile
  const studentCard = async (sid, name) => {
    const crm = CRM + '/students/view/' + encodeURIComponent(sid);
    const link = `<a class="btn btn-primary" href="${crm}" target="_blank" rel="noopener">Open in Lighthouse ↗</a>`;
    const frame = (body) => {
      $('#modalCard').innerHTML = `<h3>🎓 ${esc(name)}</h3>${body}<div class="actions"><button type="button" class="btn btn-ghost" id="tkNo">Close</button>${link}</div>`;
      $('#modalCard').classList.add('tk-wide');
      $('#modal').hidden = false;
      $('#tkNo').onclick = () => ($('#modal').hidden = true);
    };
    frame(loader({ small: true, text: 'Loading student details' }));
    const token = (studentCard.token = (studentCard.token || 0) + 1);
    let d;
    try {
      d = await api('/api/ptm/student/' + encodeURIComponent(sid));
    } catch (err) {
      if (token === studentCard.token && !$('#modal').hidden) frame(`<p class="note">${esc(err.message)}</p>`);
      return;
    }
    if (token !== studentCard.token || $('#modal').hidden) return;
    const s = d.student || {};
    const att = s.att && s.att.regHeld ? Math.round((100 * s.att.regAttended) / s.att.regHeld) + '% (' + s.att.regAttended + ' of ' + s.att.regHeld + ' classes)' : '—';
    const row = (k, v) => `<div><small>${k}</small><b>${v === 0 || v ? esc(v) : '—'}</b></div>`;
    frame(`<div class="tk-facts">${row('Student ID', d.id)}${row('Class', s.grade)}${row('School', s.school)}${row('Batch', s.batch)}${row('Tutor manager', d.tm)}${row('Attendance this month', att)}${row('Green %', s.greenPct == null ? '' : s.greenPct + '%')}${row('Last parent contact', s.lastContact ? new Date(s.lastContact).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '')}</div>
      <h4 class="tk-h">Parents</h4>${(d.parents || []).map((x) => `<p class="tk-line"><b>${esc(x.name)}</b> ${esc(x.relation || '')} ${x.phone ? `<a href="tel:${esc(x.phone)}">${esc(x.phone)}</a>` : ''}${x.email ? ' · ' + mailLink(x.email) : ''}</p>`).join('') || '<p class="tk-small">No parent on record.</p>'}
      <h4 class="tk-h">Recent PTMs</h4>${(d.ptms || []).slice(0, 4).map((m) => `<p class="tk-line">${esc(m.date)} · ${esc(m.status)} · ${esc(m.host)}</p>`).join('') || '<p class="tk-small">No PTM on record.</p>'}
      ${(d.tasks || []).length ? `<h4 class="tk-h">Open items today</h4>${d.tasks.slice(0, 6).map((x) => `<p class="tk-line">${esc(x.task)}</p>`).join('')}` : ''}
      ${d.error ? `<p class="tk-red tk-small">${esc(d.error)}</p>` : ''}`);
  };

  function wire() {
    $('#tkNew').onclick = () => newTask();
    const quick = $('#tkQuick');
    quick.oninput = () => (tkState.draft = quick.value);
    quick.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        $('#tkQuickForm').requestSubmit();
      }
    };
    $('#tkQuickForm').onsubmit = async (e) => {
      e.preventDefault();
      const text = quick.value.trim();
      if (text.length < 3) return toast('Type the task first.', 'err');
      const btn = $('#tkPreview');
      btn.disabled = true;
      try {
        newTask(await api('/api/tracker/parse', { body: { text } }));
      } catch (err) {
        toast(err.message, 'err');
      } finally {
        btn.disabled = false;
      }
    };
    if ($('#tkHourly'))
      $('#tkHourly').onchange = async (e) => {
        try {
          const r = await api('/api/tracker/reminders', { body: { enabled: e.target.checked } });
          j.reminders.enabled = r.enabled;
          toast(r.enabled ? 'Hourly reminder mails are on' : 'Hourly reminder mails are off', 'ok');
        } catch (err) {
          toast(err.message, 'err');
        }
      };
    $$('.tk-person').forEach((b) => (b.onclick = () => {
      tkState.who = b.dataset.who;
      tkState.seen.clear(); // cards fly in again for the person picked
      paint();
    }));
    const board = $('.tk-board');
    board.onclick = (e) => {
      const btn = e.target.closest('[data-tk]');
      if (!btn) return;
      const el = btn.closest('.tk-card');
      const t = byId(el.dataset.id);
      const what = btn.dataset.tk;
      if (what === 'student') {
        const s = t.students.find((x) => String(x.id) === btn.dataset.sid);
        if (s) studentCard(s.id, s.name);
      } else if (what === 'items') {
        const key = 'list:' + t.id;
        tkState.open[tkState.open.has(key) ? 'delete' : 'add'](key);
        const list = el.querySelector('.tk-items');
        list.hidden = !tkState.open.has(key);
        btn.textContent = btn.textContent.replace(list.hidden ? 'hide' : 'show', list.hidden ? 'show' : 'hide');
      } else if (what === 'notes') {
        const on = !tkState.open.has(t.id);
        tkState.open[on ? 'add' : 'delete'](t.id);
        btn.classList.toggle('on', on);
        el.querySelector('.tk-thread').classList.toggle('on', on);
        if (on) setTimeout(() => el.querySelector('.tk-add input').focus(), 220);
      } else if (what === 'done') finish(t);
      else if (what === 'reopen') send({ action: 'reopen', id: t.id }, 'Reopened.');
      else if (what === 'remind') window.confirm('Send the task mail to ' + t.assignee + '?') && send({ action: 'remind', id: t.id }, 'Done.');
      else if (what === 'delete') window.confirm('Delete this task?') && send({ action: 'delete', id: t.id }, 'Deleted.');
      else if (what === 'edit')
        modal(
          '✎ Edit task',
          `<label>Task<input id="tkTitle" maxlength="200" value="${esc(t.title)}"></label><label>Details<textarea id="tkDetails" rows="3" maxlength="2000">${esc(t.details)}</textarea></label><label>Due date<input id="tkDue" type="date" value="${t.due}"></label><label>Time<input id="tkTime" type="time" value="${t.dueTime || ''}"></label>${priorityField(t.priority)}`,
          'Save',
          () => send({ action: 'edit', id: t.id, title: $('#tkTitle').value, details: $('#tkDetails').value, due: $('#tkDue').value, dueTime: $('#tkTime').value, priority: $('#tkPri').value }, 'Saved.')
        );
    };
    board.onsubmit = (e) => {
      e.preventDefault();
      const el = e.target.closest('.tk-card');
      const input = e.target.querySelector('input');
      if (input.value.trim().length < 2) return toast('Write the remark first.', 'err');
      input.blur();
      send({ action: 'remark', id: el.dataset.id, text: input.value }, 'Remark added.');
    };
    board.ondragstart = (e) => {
      const el = e.target.closest('.tk-card');
      if (!el) return;
      e.dataTransfer.setData('text/plain', el.dataset.id);
      el.classList.add('tk-drag');
      board.classList.add('dragging');
    };
    board.ondragend = () => {
      board.classList.remove('dragging');
      $$('.tk-drag, .tk-over').forEach((x) => x.classList.remove('tk-drag', 'tk-over'));
    };
    board.ondragover = (e) => {
      const lane = e.target.closest('.tk-lane');
      if (!lane) return;
      e.preventDefault();
      $$('.tk-lane').forEach((x) => x.classList.toggle('tk-over', x === lane));
    };
    board.ondrop = (e) => {
      e.preventDefault();
      const lane = e.target.closest('.tk-lane');
      const t = byId(e.dataTransfer.getData('text/plain'));
      board.ondragend();
      if (!lane || !t) return;
      if (lane.dataset.lane === 'done' && t.lane !== 'done') finish(t);
      else if (lane.dataset.lane !== 'done' && t.lane === 'done') {
        if (mine(t)) send({ action: 'reopen', id: t.id }, 'Reopened.');
        else toast('Only the person who assigned it can reopen it.', 'err');
      } else if (lane.dataset.lane !== t.lane) toast('The lane follows the due date. Use ✎ to change it.', 'err');
    };
  }
  paint();
}
const routes = { dashboard, team, tm, tasks, tracker, ptm, students, renewals, tutors, reports, schedule, settings };
let navToken = 0;
async function route(keepScroll) {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const name = routes[parts[0]] ? parts[0] : 'dashboard';
  const token = ++navToken;
  if (S.status && !roleOK(name)) {
    location.hash = '#/dashboard';
    return;
  }
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === (name === 'tm' ? 'team' : name)));
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
  document.title = `${t} · Lighthouse V2`;
}
function noData() {
  const st = S.status || {};
  view.innerHTML = `<div class="card rise"><h3>No Lighthouse data yet</h3><p class="note">${
    st.lighthouse ? 'Click <b>Refresh</b> at the top right to load today’s tasks.' : 'Connect Lighthouse in <a href="#/settings"><b>Settings</b></a>, then click Refresh.'
  }${st.refreshError ? `<br><span style="color:var(--red)">${esc(st.refreshError)}</span>` : ''}</p></div>`;
}

// ---------- All students: details, PTMs of the last 30 days, reports ----------
const stState = { q: '', tm: 'all', f: 'all', col: '', dir: 1, limit: 120 };
let stRows = [];
async function students() {
  title('All students', 'Details, PTMs done in the last 30 days and saved reports');
  view.innerHTML = loader();
  let j;
  try {
    j = await swrFetch('/api/students-all', students, '#/students');
  } catch (err) {
    view.innerHTML = `<div class="card"><h3>Could not load students</h3><p class="note">${esc(err.message)}</p></div>`;
    return;
  }
  stRows = j.rows;
  // the page is already drawn; live call details join in a moment later
  api('/api/last-calls').then((c) => {
    for (const r of stRows) if (c.map[r.id]) r.lastCall = c.map[r.id];
    if (location.hash.startsWith('#/students') && document.getElementById('stBody')) document.getElementById('stBody').dispatchEvent(new Event('repaint'));
  }).catch(() => {});
  const owner = j.role === 'owner';
  const tmNames = [...new Set(stRows.map((r) => r.tm))];
  const m = reportMonths();
  view.innerHTML = `
    <div class="toolbar team-tools">
      <div class="search"><input id="stQ" placeholder="Search ${stRows.length} students by name, student ID, school or class…" autocomplete="off" value="${esc(stState.q)}"></div>
      ${owner ? `<select class="sel" id="stTm"><option value="all">All TMs</option>${tmNames.map((n) => `<option ${stState.tm === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}
      <div class="chipset" id="stChips">${[['all', 'All'], ['ptm', 'PTM done'], ['noptm', 'No PTM in 30 days'], ['rep', 'Has report']].map(([k, l]) => `<button class="fchip ${stState.f === k ? 'on' : ''}" data-f="${k}">${l}<span data-n="${k}"></span></button>`).join('')}</div>
      <span style="flex:1"></span>
      <select class="sel" id="stMonth" title="Month the plan is for">${m.list.map((x) => `<option ${x === m.pick ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
      <select class="sel" id="stWin" title="How far back to read"><option value="30">Last 30 days</option><option value="60">Last 60 days</option><option value="all">Since joining</option></select>
      <a class="btn btn-ghost" href="/api/students.csv${owner ? '' : ''}" download>⬇ CSV</a>
    </div>
    <div class="note" style="margin:-6px 0 12px">PTMs done between ${esc(j.from)} and ${esc(j.to)}, with the parent’s time in the meeting. ${j.error ? `<span style="color:var(--red)">PTM data could not load: ${esc(j.error)}</span>` : ''}</div>
    <div class="card" style="padding:0"><div class="table-wrap" style="max-height:74vh;overflow:auto"><table class="tbl"><thead><tr><th class="num">#</th>${thSort('Student', 'name', stState)}${owner ? thSort('TM', 'tm', stState) : ''}<th>Parent${owner ? ' / phone' : ''}</th>${thSort('Learning', 'learn', stState)}${thSort('Last parent call', 'call', stState)}${thSort('PTMs done (30 days)', 'ptm', stState)}${thSort('PTM report', 'rep', stState)}</tr></thead><tbody id="stBody"></tbody></table></div><div class="actions" id="stMore" style="justify-content:center;padding:10px"></div></div>`;
  const shortDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const paint = () => {
    const q = stState.q.trim().toLowerCase();
    const base = stRows.filter((r) => (stState.tm === 'all' || r.tm === stState.tm) && (!q || `${r.name} ${r.id} ${r.school} ${r.batch} ${r.grade}`.toLowerCase().includes(q)));
    const test = { all: () => true, ptm: (r) => r.ptms.length > 0, noptm: (r) => r.ptms.length === 0, rep: (r) => r.reports.length > 0 };
    $$('#stChips [data-n]').forEach((s) => (s.textContent = base.filter(test[s.dataset.n]).length));
    let list = base.filter(test[stState.f]);
    if (stState.col) {
      const key = {
        name: (r) => r.name, tm: (r) => r.tm, learn: (r) => (r.attPct == null ? -1 : r.attPct), call: (r) => (r.lastCall ? new Date(r.lastCall.at).getTime() : 0),
        ptm: (r) => r.ptms.length, rep: (r) => r.reports.length,
      }[stState.col];
      list = list.slice().sort((x, y) => stState.dir * cmpVal(key(x), key(y)) || x.name.localeCompare(y.name));
    }
    const shown = list.slice(0, stState.limit);
    $('#stBody').innerHTML = shown
      .map((r, i) => {
        const ptm = r.ptms.length
          ? r.ptms.slice(0, 3).map((p) => `<span class="chip ok" title="${esc(p.tm)}">${esc(shortDate(p.date))}${p.minutes ? ' · ' + p.minutes + 'm' : ''}</span>`).join(' ') + (r.ptms.length > 3 ? ` <small>+${r.ptms.length - 3} more</small>` : '')
          : '<span style="color:var(--ink-3)">None</span>';
        const reps = r.reports.slice(0, 3).map((x) => `<a class="chip" href="/api/reports/file/${esc(x.id)}" target="_blank" rel="noopener" title="${esc(r.name)} · PTM report ${esc(x.month || '')} (saved ${esc(new Date(x.at).toLocaleString('en-GB'))})">📄 ${esc(new Date(x.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }))} · ${esc(new Date(x.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).toUpperCase())}</a>`).join(' ') + (r.reports.length > 3 ? ` <small>+${r.reports.length - 3}</small>` : '');
        return `<tr><td class="num">${i + 1}</td>
          <td><b>${lhLink(`${CRM}/students/view/${r.id}`, esc(r.name))}</b>${r.lapsed ? ' <span class="tag red">Lapsed</span>' : ''}${r.oneOnOne ? ' <span class="tag">1:1</span>' : ''}<br><small style="color:var(--ink-3)">Class ${esc(r.grade ?? '—')} · ${esc(r.school || '—')}</small></td>
          ${owner ? `<td>${esc(r.tm.split(' ')[0])}</td>` : ''}
          <td class="par-cell">${parentCell(r.id)}</td>
          <td style="white-space:nowrap"><small style="color:var(--ink-3)">Green</small> <b>${r.greenPct ?? '—'}${typeof r.greenPct === 'number' ? '%' : ''}</b><br><small style="color:var(--ink-3)">Attendance</small> <b>${r.attPct ?? '—'}${r.attPct != null ? '%' : ''}</b></td>
          <td style="min-width:150px;white-space:nowrap">${lastCallHtml(r.lastCall)}</td>
          <td>${ptm}</td>
          <td><button class="btn btn-ghost st-rep" data-id="${r.id}" style="padding:6px 10px;font-size:12.5px">📄 Create report</button><div style="margin-top:5px">${reps}</div></td></tr>`;
      })
      .join('') || '<tr><td colspan="8" class="empty">No student matches</td></tr>';
    $('#stMore').innerHTML = list.length > shown.length ? `<button class="btn btn-ghost" id="stAll">Show all ${list.length}</button>` : `<span class="note">${list.length} student${list.length === 1 ? '' : 's'}</span>`;
    const all = $('#stAll');
    if (all) all.onclick = () => ((stState.limit = 9999), paint());
  };
  paint();
  $('#stBody').addEventListener('repaint', () => paint());
  bindSort($('#stBody').closest('table'), stState, () => paint());
  $('#stQ').oninput = (e) => ((stState.q = e.target.value), (stState.limit = 120), paint());
  const sel = $('#stTm');
  if (sel) sel.onchange = (e) => ((stState.tm = e.target.value), (stState.limit = 120), paint());
  $$('#stChips .fchip').forEach((b) => (b.onclick = () => {
    stState.f = b.dataset.f;
    $$('#stChips .fchip').forEach((x) => x.classList.toggle('on', x === b));
    paint();
  }));
  // parent names (and numbers for the owner) arrive per TM, then fill in
  Promise.all(tmNames.map((n) => api('/api/parents?tm=' + encodeURIComponent(n)).catch(() => ({ parents: {} })))).then((all) => {
    for (const p of all) Object.assign(parentMap, p.parents || {});
    if (location.hash.startsWith('#/students')) paint();
  });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('.st-rep');
  if (!b) return;
  const month = ($('#stMonth') && $('#stMonth').value) || reportMonths().pick;
  createPtmReport(b.dataset.id, month, ($('#stWin') && $('#stWin').value) || '30');
});
document.addEventListener('ptm-report-saved', () => {
  if (location.hash.startsWith('#/students')) setTimeout(() => route(true), 400);
});

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
// Lighthouse Student Learning Progress: TM process done (Maths and Science), team average and per TM.
function processTile(b) {
  if (b.scoped && !b.rows.length) return '';
  const rows = b.rows.map((r) => ({ r, m: (r.perf.metrics.tmprocess || {}).maths, s: (r.perf.metrics.tmprocess || {}).science }));
  const avg = (k) => { const v = rows.map((x) => x[k]).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, c) => a + c, 0) / v.length) : null; };
  const m = avg('m'), s = avg('s');
  const low = rows.filter((x) => x.m != null).sort((a, c) => a.m - c.m)[0];
  const crit = m != null && m < 50;
  return `<span class="rise kpi-wrap" style="--i:9" data-go="#/team" data-bit="SpotlightCard" data-props="${esc(JSON.stringify({ theme: 'light', spotlightColor: crit ? '#e0563f' : '#5b60d6', intensity: 0.22, spotlightSize: 260, className: `kpi${crit ? ' crit' : ''}` }))}">
    <div class="top"><div class="ico">🔁</div>${crit ? pill('critical', 'Low') : pill('ok', 'Maths')}</div>
    <div class="val">${m == null ? '—' : `<span data-count="${m}">0</span><small>% Maths</small>`}</div><div class="lbl">TM process done</div>
    <div class="meta">${s != null ? `Science ${s}% · ` : ''}${low ? `lowest ${esc(low.r.first)} ${low.m}%` : 'Refresh to load'}</div>
    <div class="prog ${crit ? 'red' : ''}"><i data-w="${m || 0}"></i></div></span>`;
}
// Weakest scorecard metrics, shown when the pointer rests on the score ring.
function scorePop(r) {
  const m = r.perf.metrics || {};
  const weak = (S.score || [])
    .filter((x) => m[x.key] && m[x.key].value != null && m[x.key].value < 100)
    .sort((x, y) => m[x.key].value - m[y.key].value)
    .slice(0, 3);
  return `<div class="score-pop"><b>Score ${r.perf.score}</b><small>Weakest areas</small>${weak.length ? weak.map((x) => `<div><span>${esc(x.icon)} ${esc(x.short)}</span><i>${m[x.key].value}%</i></div>`).join('') : '<div><span>All metrics at 100%</span></div>'}</div>`;
}
function tmCard(r, i, top = false) {
  const t = r.tasks;
  const open = S.tasks.filter((x) => x.kind === 'list').reduce((a, x) => a + t[x.key].pending, 0);
  return `<a class="card tm-card rise ${gradeClass(r.perf.score)}" style="--i:${i}" href="#/tm/${encodeURIComponent(r.name)}">
    <div class="cover"></div>${top ? magic('ShineBorder', { borderWidth: 2, duration: 10, shineColor: ['#33379e', '#b3b6fa', '#f2b84b'] }) : ''}
    <img class="face" src="${photo(r)}" alt="${esc(r.name)}">
    <div class="ring-wrap">${ring(r.perf.score)}${scorePop(r)}</div>
    <div class="body">
      <div class="name">${esc(r.name)}</div>
      <div class="grade">${esc(r.perf.grade)} · ${r.perf.students} students</div>
      <div class="mini-stats">
        <div class="go" data-go="#/tasks/talk" title="Talk time done today (calls + PTMs). Click for the task board"><b>${t.talk.minutes || 0}m</b><span>talk time done</span></div>
        <div class="go" data-go="#/ptm" title="PTMs booked for today. Click for the PTM tab"><b data-ptmcard="${esc(r.name)}">…</b><span data-ptmsub>PTMs today</span></div>
        <div class="go" data-go="#/tasks/ic2" title="Open IC2 bookings"><b>${t.ic2.done}/${t.ic2.morning}</b><span>IC2 booked</span></div>
        <div class="go" data-go="#/tasks/chapters" title="Open chapter planning"><b>${t.chapters ? t.chapters.pending : 0}</b><span>chapters missing</span></div>
        <div class="go" data-go="#/tasks/approvals" title="Open approvals"><b>${t.approvals ? t.approvals.pending : 0}</b><span>approvals pending</span></div>
        <div title="Student Learning Progress: TM process done (Maths)"><b>${r.perf.metrics.tmprocess && r.perf.metrics.tmprocess.maths != null ? r.perf.metrics.tmprocess.maths + '%' : '—'}</b><span>Maths TM process done</span></div>
        <div><b data-count="${open}">0</b><span>open items</span></div>
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
// "NC15 %" per TM for this week, as in Lighthouse's TM Performance report: parents not connected for 15+ days / the TM's students
function ncCard(b) {
  const rows = (b.rows || []).filter((r) => r.tasks && r.tasks.nc15 && r.tasks.nc15.share);
  if (!rows.length) return '';
  const day = (S.status && S.status.now && S.status.now.date) || new Date().toISOString().slice(0, 10);
  const d = new Date(day + 'T12:00:00Z');
  const mon = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000);
  const sun = new Date(mon.getTime() + 6 * 86400000);
  const f = (x) => x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const c = rows.reduce((a, r) => a + r.tasks.nc15.share.count, 0);
  const n = rows.reduce((a, r) => a + r.tasks.nc15.share.den, 0);
  return `<div class="card rise" style="--i:3;margin-top:18px"><div class="toolbar"><div><h3>NC-15 %</h3><div class="sub">Parents not connected for 15+ days, out of each TM’s students · ${f(mon)} to ${f(sun)}</div></div><span style="flex:1"></span><a class="btn btn-ghost" href="#/tasks/nc15">Open NC-15 list</a></div>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Tutor Manager</th><th class="num">NC-15 %</th></tr></thead><tbody>
      <tr style="background:var(--soft,#f4f8fc)"><td><b>All TMs (${rows.length})</b></td><td class="num"><b>${rnPct2(c, n)}</b></td></tr>
      ${rows.map((r) => `<tr data-go="#/tm/${encodeURIComponent(r.name)}/nc15" style="cursor:pointer"><td>${esc(r.name)}</td><td class="num">${rnPct2(r.tasks.nc15.share.count, r.tasks.nc15.share.den)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
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
      const all = (b.teamRows || b.rows).map((r) => r.tasks[t.key]);
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
        meta = b.slot === 'morning' ? `${sum('flagged')} overdue / ageing` : `${sum('done')} closed since 10 AM`;
        p = sum('morning') ? (100 * sum('done')) / sum('morning') : 100;
      }
      return `<span class="rise kpi-wrap" style="--i:${i}" data-go="#/tasks/${t.key}" data-bit="SpotlightCard" data-props="${esc(JSON.stringify({ theme: 'light', spotlightColor: crit ? '#e0563f' : '#5b60d6', intensity: 0.22, spotlightSize: 260, className: `kpi${crit ? ' crit' : ''}` }))}">
        <div class="top"><div class="ico">${t.icon}</div>${crit ? pill('critical', `${crit} TM${crit > 1 ? 's' : ''}`) : pill('ok', 'OK')}</div>
        <div class="val">${val}</div><div class="lbl">${esc(t.label)}</div><div class="meta">${esc(meta)}</div>
        <div class="prog ${crit ? 'red' : ''}"><i data-w="${p}"></i></div></span>`;
    })
    .join('') + processTile(b);
  view.innerHTML = `
    <div class="hero rise">
      ${bit('Aurora', { colorStops: ['#7c81e8', '#b3b6fa', '#4a4fc4'], amplitude: 1.1, blend: 0.6, speed: 0.6, opacity: 0.55, mouseInteraction: true }, '', 'position:absolute;inset:0;display:block;pointer-events:none')}
      ${magic('BorderBeam', { size: 160, duration: 9, colorFrom: '#b3b6fa', colorTo: '#ffffff', borderWidth: 2 })}
      <div style="position:relative"><h2>${bit('BlurText', { text: `${hello}, ${(st.userName || st.fromName || 'there').split(' ')[0]} 👋`, delay: 90, animateBy: 'words', direction: 'top' }, '', 'display:inline-block')}</h2>
        <p>${b.scoped ? (b.rows.length ? 'Your tasks and students are in My profile. The tiles below are the overall team numbers.' : 'Overall team numbers.') : critTMs.length ? `${critTMs.length} of ${b.rows.length} TMs have something that needs attention.` : 'Everything is on track across the team.'}</p>
        <div class="hero-faces" style="margin:16px 0 0 12px">${b.rows.map((r) => `<a href="#/tm/${encodeURIComponent(r.name)}" title="${esc(r.name)}"><img src="${photo(r)}" alt=""></a>`).join('')}</div></div>
      <div class="next-send" style="position:relative"><small>${esc(nx.label)}</small><b>${bit('GradientText', { colors: ['#ffffff', '#b3b6fa', '#ffffff'], animationSpeed: 5 }, esc(nx.value))}</b><small style="margin-top:4px">${st.email ? `from ${esc(st.sender)}` : 'Email not set up yet'}</small></div>
    </div>
    ${critTMs.length ? `<span class="ticker rise" style="--i:1" data-bit="Marquee" data-props="${esc(JSON.stringify({ pauseOnHover: true, repeat: 4, style: { '--duration': `${Math.max(30, critTMs.reduce((a, r) => a + r.concerns.length, 0) * 5)}s`, '--gap': '12px' } }))}">${critTMs.map((r) => r.concerns.map((c) => `<a href="#/tm/${encodeURIComponent(r.name)}"><img src="${photo(r)}" alt=""><b>${esc(r.first)}</b><i></i>${esc(c)}</a>`).join('')).join('')}</span>` : ''}
    <div class="section-title"><h2>Team tasks</h2><span>${esc(SLOT_LABEL[b.slot])}. Click a tile for the full list.</span></div>
    <div class="grid g-kpi">${kpis}</div>
    <div class="grid g-2" style="margin-top:18px">
      <div class="card rise" style="--i:9"><h3>Task board</h3><div class="sub" style="margin-bottom:12px">${b.slot === 'morning' ? 'Pending per TM. Red needs attention today.' : 'Done since 10 AM, of the morning total.'} Click a cell to open that TM.</div>${heatmap(b)}</div>
      <div class="card rise" style="--i:10"><h3>Needs attention</h3><div class="sub" style="margin-bottom:12px">Critical items by TM</div>
        <div class="attn">${
          critTMs.length
            ? critTMs.map((r) => `<a href="#/tm/${encodeURIComponent(r.name)}"><img src="${photo(r)}" alt=""><div><div class="who">${esc(r.name)}</div><div class="what">${esc(r.concerns.join(' · '))}</div></div></a>`).join('')
            : '<div class="empty">🎉 Nothing critical right now</div>'
        }</div></div>
    </div>
    ${ncCard(b)}
    <div class="section-title"><h2>Team</h2><span>Performance score out of 100</span></div>
    <div class="grid g-team">${[...b.rows].sort((a, c) => c.perf.score - a.perf.score).map((r, i) => tmCard(r, i + 11, i === 0)).join('')}</div>`;
}
view.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) location.hash = go.dataset.go;
});

// ---------- Team ----------
const teamState = { q: '', filter: 'all', sort: 'score', mode: 'cards' };
async function team() {
  const b = await load();
  title('Team', b ? `${b.rows.length} tutor managers` : '');
  if (!b) return noData();
  const rows = b.rows;
  const openOf = (r) => S.tasks.filter((x) => x.kind === 'list').reduce((a, x) => a + r.tasks[x.key].pending, 0);
  const avg = Math.round(rows.reduce((a, r) => a + r.perf.score, 0) / rows.length);
  const pushN = rows.filter((r) => /push/i.test(r.perf.grade)).length;
  const concN = rows.filter((r) => r.concerns.length).length;
  const openN = rows.reduce((a, r) => a + openOf(r), 0);
  const talkN = rows.reduce((a, r) => a + (r.tasks.talk.minutes || 0), 0);
  const chips = [['all', 'All', rows.length], ['track', 'On track', rows.length - pushN], ['push', 'Needs a push', pushN], ['concerns', 'Has concerns', concN]];
  view.innerHTML = `
    <div class="team-sum">
      <button class="ts rise" style="--i:0" data-f="all"><div class="ts-ring">${ring(avg)}</div><div><b>Team score</b><small>average of ${rows.length} TMs</small></div></button>
      <button class="ts rise" style="--i:1" data-f="push"><div class="ts-n" data-count="${pushN}">0</div><div><b>Need a push</b><small>click to filter</small></div></button>
      <button class="ts rise" style="--i:2" data-f="concerns"><div class="ts-n" data-count="${concN}">0</div><div><b>With concerns</b><small>critical items today</small></div></button>
      <div class="ts rise" style="--i:3"><div class="ts-n" data-count="${openN}">0</div><div><b>Open items</b><small>across the team</small></div></div>
      <div class="ts rise" style="--i:4"><div class="ts-n" data-count="${talkN}">0</div><div><b>Talk minutes</b><small>done today</small></div></div>
    </div>
    <div class="toolbar team-tools">
      <div class="search"><input id="tmQ" placeholder="Search a TM…" autocomplete="off" value="${esc(teamState.q)}"></div>
      <div class="chipset" id="tmChips">${chips.map(([k, l, n]) => `<button class="fchip ${teamState.filter === k ? 'on' : ''}" data-f="${k}">${l}<span>${n}</span></button>`).join('')}</div>
      <select class="sel" id="tmSort"><option value="score">Sort: Score</option><option value="open">Sort: Open items</option><option value="talk">Sort: Talk time</option><option value="proc">Sort: Maths TM process</option><option value="name">Sort: Name</option></select>
      <div class="seg2" id="tmMode"><button data-m="cards" class="${teamState.mode === 'cards' ? 'on' : ''}" title="Cards">▦ Cards</button><button data-m="rank" class="${teamState.mode === 'rank' ? 'on' : ''}" title="Leaderboard">☰ Ranking</button></div>
      <span style="flex:1"></span><a class="btn btn-ghost" href="/api/students.csv" download>⬇ All students + parents (CSV)</a>
    </div>
    <div id="tmGrid"></div>`;
  $('#tmSort').value = teamState.sort;
  const paint = () => {
    const q = teamState.q.trim().toLowerCase();
    let list = rows.filter((r) => (!q || r.name.toLowerCase().includes(q)) && (teamState.filter === 'all' || (teamState.filter === 'push' && /push/i.test(r.perf.grade)) || (teamState.filter === 'track' && !/push/i.test(r.perf.grade)) || (teamState.filter === 'concerns' && r.concerns.length)));
    const proc = (r) => (r.perf.metrics.tmprocess && r.perf.metrics.tmprocess.maths) ?? -1;
    const key = { score: (r) => -r.perf.score, open: (r) => -openOf(r), talk: (r) => -(r.tasks.talk.minutes || 0), proc: (r) => -proc(r), name: (r) => r.name }[teamState.sort];
    list = [...list].sort((x, y) => (key(x) > key(y) ? 1 : key(x) < key(y) ? -1 : 0));
    $('#tmGrid').innerHTML = !list.length
      ? '<div class="card empty">No TM matches. Clear the search or pick another filter.</div>'
      : teamState.mode === 'rank'
        ? `<div class="rank-list">${list
            .map((r, i) => `<a class="rank-row rise" style="--i:${i}" href="#/tm/${encodeURIComponent(r.name)}"><span class="rk">${i + 1}</span><img src="${photo(r)}" alt=""><span class="rn"><b>${esc(r.name)}</b><small>${esc(r.perf.grade)} · ${r.perf.students} students · ${openOf(r)} open · Maths TM process ${proc(r) < 0 ? '—' : proc(r) + '%'}</small></span><span class="rbar"><i data-w="${r.perf.score}" class="${gradeClass(r.perf.score)}"></i></span><span class="rs">${r.perf.score}</span></a>`)
            .join('')}</div>`
        : `<div class="grid g-team">${list.map((r, i) => tmCard(r, i)).join('')}</div>`;
    animate();
  };
  paint();
  $('#tmQ').oninput = (e) => ((teamState.q = e.target.value), paint());
  $('#tmSort').onchange = (e) => ((teamState.sort = e.target.value), paint());
  const setFilter = (f) => {
    teamState.filter = f;
    $$('#tmChips .fchip').forEach((c) => c.classList.toggle('on', c.dataset.f === f));
    paint();
  };
  $$('#tmChips .fchip').forEach((c) => (c.onclick = () => setFilter(c.dataset.f)));
  $$('.team-sum [data-f]').forEach((c) => (c.onclick = () => setFilter(c.dataset.f)));
  $$('#tmMode button').forEach((c) => (c.onclick = () => {
    teamState.mode = c.dataset.m;
    $$('#tmMode button').forEach((x) => x.classList.toggle('on', x === c));
    paint();
  }));
}

// ---------- TM profile ----------
const CRM = 'https://lighthouse.uprio.com/tutoring-crm';
const lhLink = (href, html) => (href ? `<a class="lh" href="${esc(href)}" target="_blank" rel="noopener" title="Open in Lighthouse">${html}<span class="ext">↗</span></a>` : html);
const TASK_PAGE = { onboarding: CRM + '/task', negfb: CRM + '/task', ic2: CRM + '/revision-lift', chapters: CRM + '/management-review', approvals: CRM + '/management-review' };
// Next renewal date, with a red tag when it is close or already passed.
function renewalCell(s) {
  if (!s.renewal) return '—';
  const d = new Date(s.renewal);
  const days = Math.ceil((d - Date.now()) / 86400000);
  const date = esc(d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: '2-digit' }));
  const when = days < 0 ? `<span class="tag red">${-days}d overdue</span>` : days <= 7 ? `<span class="tag red">in ${days}d</span>` : `<small style="color:var(--ink-3)">in ${days} days</small>`;
  return `${date}<br>${when}`;
}
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
// Parent / guardian name + number, filled in from /api/parents after the students tab opens.
const parentMap = {};
const isOwnerUI = () => true; // parent names show for everyone allowed; numbers only arrive from the server for the owner
const telLink = (p, id) => (p ? (id ? `<a class="tel" href="${esc(CRM)}/students/view/${esc(id)}" target="_blank" rel="noopener" title="Open in Lighthouse to call">${esc(p)} <span class="ext">↗</span></a>` : `<a class="tel" href="tel:${esc(String(p).replace(/[^+0-9]/g, ''))}">${esc(p)}</a>`) : '');
const mailLink = (v) => `<a class="par-mail" href="mailto:${encodeURIComponent(v).replace('%40', '@')}" title="Write to ${esc(v)}">✉ ${esc(v)}</a>`;
function parentCell(id) {
  const g = parentMap[id];
  if (!g) return '<span style="color:var(--ink-3)">…</span>';
  if (!g.length) return '<span style="color:var(--ink-3)">Not in Lighthouse</span>';
  return g
    .slice(0, 2)
    .map((x) => `<div class="par"><b>${esc(x.name || '—')}</b>${x.relation ? ` <small style="color:var(--ink-3)">${esc(x.relation)}</small>` : ''}${x.primary ? ' <span class="tag">Primary</span>' : ''}${x.phone ? `<br>${telLink(x.phone, id)}` : ''}${x.email ? `<br>${mailLink(x.email)}` : ''}</div>`)
    .join('');
}
function studentRows(students) {
  const f = stuState;
  let list = students.filter((s) => {
    const hay = `${s.name} ${s.id} ${s.school} ${s.batch} ${s.grade}`.toLowerCase();
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
  const key = { name: (s) => s.name.toLowerCase(), renewal: (s) => (s.renewal ? new Date(s.renewal).getTime() : Infinity), grade: (s) => Number(s.grade) || 0, green: (s) => s.greenPct ?? -1, imp: (s) => s.improvementPct ?? -1, contact: (s) => daysAgo(s.lastContact) ?? 999, lift: (s) => s.liftLoad ?? 0, att: (s) => (s.att && s.att.regHeld ? s.att.regAttended / s.att.regHeld : s.att && s.att.allHeld ? s.att.allAttended / s.att.allHeld - 2 : -3), streak: (s) => (s.att ? s.att.streak : -1) }[f.sort];
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
          ${isOwnerUI() ? `<td class="par-cell" data-par="${s.id}">${parentCell(s.id)}</td>` : ''}
          <td class="num">${esc(s.grade ?? '—')}</td>
          <td>${lhLink(s.schoolId ? `https://lighthouse.uprio.com/school-planning/v2/${s.schoolId}?grade=${encodeURIComponent(s.grade ?? '')}` : '', esc(s.school || '—'))}<br><small style="color:var(--ink-3)">${esc((s.batch || '').split('|')[0])}</small></td>
          <td style="white-space:nowrap">${attCell}</td><td style="white-space:nowrap">${absCell}</td>
          <td style="white-space:nowrap">${bar(s.greenPct)}</td><td style="white-space:nowrap">${bar(s.improvementPct)}</td>
          <td class="num">${s.liftLoad ?? '—'}</td>
          <td>${d === null ? '<span class="tag red">Never</span>' : nc ? `<span class="tag red">${d}d ago</span>` : `${d}d ago`}</td>
          <td>${renewalCell(s)}</td></tr>`;
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
  const j = await cachedApi(`/api/tm/${encodeURIComponent(name)}?slot=${S.slot}`);
  const r = j.row;
  const P = r.perf;
  title(r.name, `${P.grade} · ${SLOT_LABEL[j.slot]}`);
  const rank = [...j.team].sort((a, b) => b.score - a.score).findIndex((x) => x.name === r.name) + 1;
  stuState = { q: '', filter: 'all', sort: 'name', dir: 1 };
  const monthLabel = j.monthStart ? `${new Date(j.monthStart + 'T12:00:00+05:30').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(j.dataDate + 'T12:00:00+05:30').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'this month';
  const absent3 = j.students.filter((x) => x.att && x.att.streak >= 3).length;
  const openCount = S.tasks.filter((t) => t.kind !== 'talk').reduce((a, t) => a + r.tasks[t.key].items.length, 0);

  const scoreList = S.score || S.tasks;
  const wTotal = scoreList.reduce((n, t) => n + (t.weight || 0), 0) || 1;
  const metricRows = scoreList
    .filter((t) => P.metrics[t.key])
    .map((t, i) => {
      const m = P.metrics[t.key];
      const v = m.value == null ? 0 : m.value;
      const cls = v >= 70 ? '' : v >= 40 ? 'amber' : 'red';
      const share = Math.round((1000 * (t.weight || 0)) / wTotal) / 10;
      const tier = i && (scoreList[i - 1].weight || 0) !== (t.weight || 0) ? ' tier-gap' : '';
      return `<div class="metric-row${tier}"><div class="nm">${t.icon} ${esc(t.short)} <span class="wt" title="Share of the score">${share}%</span><small>${esc(m.label)}</small></div><div class="prog ${cls}"><i data-w="${v}"></i></div><div class="v">${m.value == null ? '—' : v}</div></div>`;
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
    <div class="profile-hero rise">${magic('BorderBeam', { size: 180, duration: 10, colorFrom: '#b3b6fa', colorTo: '#f2b84b', borderWidth: 2 })}
      <div class="blur" style="background-image:url('${photo(r)}')"></div>
      ${bit('TiltedCard', { imageSrc: photo(r), altText: r.name, containerHeight: '156px', containerWidth: '156px', imageHeight: '148px', imageWidth: '148px', rotateAmplitude: 14, scaleOnHover: 1.08, showTooltip: false, flipOnClick: false, gyroscope: false, radius: 30, glare: 0.5 }, '', 'display:block;width:156px;height:156px')}
      <div><h2>${bit('BlurText', { text: r.name, delay: 120, animateBy: 'words', direction: 'top' }, '', 'display:inline-block')}</h2><div class="meta">Tutor Manager · ${esc(r.email)}</div><div class="voice-box" data-voice="${esc(r.name)}"></div>
        <div class="chips"><span class="chip">🏅 Rank ${rank} of ${j.team.length}</span><span class="chip">👩‍🎓 ${P.students} students</span><span class="chip">🏫 ${P.batches} batches</span><span class="chip">${bit('ShinyText', { text: P.grade, color: '#dfe0fa', shineColor: '#ffffff', speed: 2.5 })}</span>${r.concerns.length ? `<span class="chip" style="background:rgba(255,120,100,.3)">⚠ ${r.concerns.length} critical</span>` : ''}</div></div>
      ${ring(P.score, 'lg')}
    </div>
    <div class="grid g-2" style="margin-top:18px">
      <div class="card rise" style="--i:1"><h3>Performance card</h3><div class="sub">Each metric scored out of 100, weighted into the overall score</div><div class="metric-rows">${metricRows}</div></div>
      <div class="card rise" style="--i:2"><h3>Student outcomes</h3><div class="sub">From the All Students tab</div>
        <div class="quality" style="margin-top:14px;grid-template-columns:repeat(2,1fr)">
          <div class="go" data-sf="all|name" title="Show all students"><b><span data-count="${P.students}">0</span></b><span>active students</span></div>
          <div class="go" data-sf="low|green" title="Show students by green %, lowest first"><b>${P.avgGreen ?? '—'}${P.avgGreen !== null ? '%' : ''}</b><span>avg green (mastery)</span></div>
          <div class="go" data-sf="all|imp" title="Show students by improvement, lowest first"><b>${P.avgImprovement ?? '—'}${P.avgImprovement !== null ? '%' : ''}</b><span>avg improvement</span></div>
          <div class="go" data-sf="nc15|contact" style="${P.noContact15 ? 'background:var(--red-bg)' : ''}" title="Show students not contacted in 15+ days"><b><span data-count="${P.noContact15}">0</span></b><span>not contacted in 15+ days</span></div>
          <div class="go" data-sf="absent|name" style="grid-column:1/-1;${absent3 ? 'background:var(--red-bg)' : ''}" title="Show students absent 3+ class days"><b><span data-count="${absent3}">0</span></b><span>students absent for 3+ class days in a row</span></div>
        </div>${sparkline(j.history)}</div>
    </div>
    <div class="section-title"><div class="tabs" id="ptabs"><button class="on" data-tab="tasks">Today's tasks<span class="count">${openCount}</span></button><button data-tab="students">Students<span class="count">${j.students.length}</span></button></div>
      <a class="btn btn-ghost" href="#/reports/${encodeURIComponent(r.name)}">✉ Preview ${esc(r.first)}'s email</a></div>
    <div id="ptab-tasks" class="rise" style="--i:3">${accs}</div>
    <div id="ptab-students" hidden>
      <div class="card">
        <div class="toolbar"><div class="search"><input id="stuQ" placeholder="Search ${j.students.length} students by name, student ID, school or batch"></div>
          <select class="sel" id="stuF"><option value="all">All students</option><option value="low">Green below 60%</option><option value="nc15">Not contacted 15+ days</option><option value="absent">Absent 3+ class days</option><option value="lowatt">Regular attendance below 70%</option><option value="one">1:1 students</option><option value="lapsed">Subscription lapsed</option></select>
          <span class="note" id="stuN"></span>
          <a class="btn btn-ghost" href="/api/students.csv?tm=${encodeURIComponent(r.name)}" download>⬇ Download CSV</a></div>
        <div class="table-wrap" style="max-height:70vh;overflow:auto"><table class="tbl"><thead><tr><th class="num">#</th><th class="sort asc" data-s="name">Student</th>${isOwnerUI() ? '<th>Parent / phone</th>' : ''}<th class="sort num" data-s="grade">Class</th><th>School / batch</th><th class="sort" data-s="att">Regular attendance<br><small style="font-weight:500">${esc(monthLabel)}</small></th><th class="sort" data-s="streak">Absent for</th><th class="sort" data-s="green">Green %</th><th class="sort" data-s="imp">Improvement</th><th class="sort num" data-s="lift">IC2 load</th><th class="sort" data-s="contact">Last contact</th><th class="sort" data-s="renewal">Next renewal</th></tr></thead><tbody id="stuBody"></tbody></table></div>
      </div>
    </div>`;

  const paintStudents = () => {
    const o = studentRows(j.students);
    $('#stuBody').innerHTML = o.html || '<tr><td colspan="12" class="empty">No students match</td></tr>';
    $('#stuN').textContent = `${o.count} shown`;
  };
  paintStudents();
  if (isOwnerUI()) api(`/api/parents?tm=${encodeURIComponent(r.name)}`).then((p) => { Object.assign(parentMap, p.parents || {}); paintStudents(); }).catch(() => {});
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
  // a tile in "Student outcomes" opens the Students tab with that list
  $$('.quality .go[data-sf]').forEach((t) => (t.onclick = () => {
    const [f, sort] = t.dataset.sf.split('|');
    stuState = { q: '', filter: f, sort, dir: sort === 'name' ? 1 : 1 };
    $('#stuQ').value = '';
    $('#stuF').value = f;
    $$('#ptab-students th.sort').forEach((x) => { x.classList.remove('asc', 'desc'); if (x.dataset.s === sort) x.classList.add('asc'); });
    const tab = $('#ptabs button[data-tab="students"]');
    if (tab) tab.click();
    paintStudents();
    setTimeout(() => $('#ptab-students').scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }));
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

// "20/57 | 35.09%": closed out of the students on the list at 10 AM
const rnPct = (done, total) => (total ? `${done}/${total} | ${((100 * done) / total).toFixed(2)}%` : `${done}/${total} | —`);
// "58/306 | 18.95%" for the NC-15 share of students (red when above 5%)
const rnPct2 = (n, d) => { const p = (100 * n) / d; return `<span style="color:${p > 5 ? 'var(--red)' : 'var(--green)'}">${n}/${d} | ${p.toFixed(2)}%</span>`; };
// What the talk-time status means
function talkLegend(b) {
  const r0 = (b.rows || [])[0];
  const s0 = r0 && r0.tasks.talk;
  const target = (s0 && s0.target) || 90;
  const exp = s0 && s0.expected != null ? s0.expected : null;
  const dot = (c, txt) => `<span class="pill ${c}" style="margin-right:6px">${txt}</span>`;
  return `<div style="margin-top:8px;line-height:1.9">Target: <b>${target} min of talk time (calls plus PTMs) by 8 PM</b>, spread evenly over the call day from 11 AM${exp != null ? `, so about <b>${exp} min</b> is expected by now` : ''}.<br>
    ${dot('clear', 'Target met')} ${target} min or more.
    ${dot('ok', 'On track')} At or above the pace expected for this time of day.
    ${dot('watch', 'Concerning')} Behind pace, but within 30% of it.
    ${dot('critical', 'Needs attention')} More than 30% behind pace.</div>`;
}
// ---------- Task board ----------
async function tasks([key]) {
  const b = await load();
  title('Task board', b ? `Task-wise, all TMs · ${SLOT_LABEL[b.slot]}` : '');
  if (!b) return noData();
  const t = S.tasks.find((x) => x.key === key) || S.tasks[0];
  const count = (x) => (x.kind === 'talk' ? '' : `<span class="count">${b.rows.reduce((a, r) => a + r.tasks[x.key].items.length, 0)}</span>`);
  const totalRow = () => {
    if (t.kind === 'talk') return '';
    const sum = (k) => b.rows.reduce((a, r) => a + (r.tasks[t.key][k] || 0), 0);
    const [morning, done, pending, flagged] = [sum('morning'), sum('done'), sum('pending'), sum('flagged')];
    const p = morning ? Math.round((100 * done) / morning) : 100;
    return `<tr style="background:var(--soft,#f4f8fc)"><td><b>All TMs (${b.rows.length})</b></td><td class="num"><b>${morning}</b></td><td class="num"><b>${done}</b></td><td class="num"><b>${pending}</b>${morning ? ` <span class="open-pct"><b>| ${((100 * Math.max(0, morning - done)) / morning).toFixed(2)}%</b></span>` : ''}</td><td class="num">${flagged ? `<span class="tag red">${flagged}</span>` : '0'}</td><td style="min-width:150px"><div style="display:flex;align-items:center;gap:10px"><div class="prog" style="margin:0;flex:1"><i data-w="${p}"></i></div><b class="num" style="min-width:112px;text-align:right;white-space:nowrap">${rnPct(done, morning)}</b></div></td>${t.key === 'nc15' ? `<td class="num" style="white-space:nowrap"><b>${(() => { const sh = b.rows.map((r) => r.tasks.nc15.share).filter(Boolean); const c = sh.reduce((x, y) => x + y.count, 0); const dn = sh.reduce((x, y) => x + y.den, 0); return dn ? rnPct2(c, dn) : '—'; })()}</b></td>` : ''}<td></td><td></td></tr>`;
  };
  const summary = `<div class="table-wrap"><table class="tbl"><thead><tr><th>TM</th>${
    t.kind === 'talk'
      ? '<th class="num">Today</th><th class="num">On calls</th><th class="num">PTM today</th><th class="num">Last day talk time</th><th class="num">Parents connected</th><th class="num">Connected / dialled</th>'
      : '<th class="num">At 10 AM</th><th class="num">' + (t.kind === 'booking' ? 'Booked today' : 'Closed today') + '</th><th class="num">Still open</th><th class="num">Flagged</th>'
  }<th>Progress</th>${t.key === 'nc15' ? '<th class="num">NC-15 %</th>' : ''}<th>Status</th><th>Idea / hint</th></tr></thead><tbody>${totalRow()}${b.rows
    .map((r) => {
      const s = r.tasks[t.key];
      const st = t.kind === 'talk' && s.liveStatus ? s.liveStatus : s.status;
      const p = t.kind === 'talk' ? (s.target ? Math.round((100 * s.done) / s.target) : 100) : s.morning ? Math.round((100 * s.done) / s.morning) : 100;
      const nums =
        t.kind === 'talk'
          ? `<td class="num"><b>${s.minutes}m</b></td><td class="num">${s.callMinutes ?? 0}m</td><td class="num">${s.ptm ? `<b>${s.ptm}</b> <small style="color:var(--ink-3)">· ${s.ptmMinutes ?? 0}m</small>` : '0'}</td><td class="num">${s.yesterday}m${s.yesterdayPtm ? `<br><small style="color:var(--ink-3)">${s.yesterdayPtm} PTM · ${s.yesterdayPtmMinutes}m</small>` : ''}</td><td class="num">${s.connected}</td><td class="num">${s.calls}/${s.dialled}</td>`
          : `<td class="num">${s.morning}</td><td class="num"><b>${s.done}</b></td><td class="num">${s.pending}${s.fresh ? ` <small>(+${s.fresh} new)</small>` : ''}${s.morning ? ` <span class="open-pct">| ${((100 * Math.max(0, s.morning - s.done)) / s.morning).toFixed(2)}%</span>` : ''}</td><td class="num">${s.flagged ? `<span class="tag red">${s.flagged}</span>` : '0'}</td>`;
      return `<tr class="${st === 'critical' ? 'flag' : ''}" data-go="#/tm/${encodeURIComponent(r.name)}/${t.key}" style="cursor:pointer"><td><div style="display:flex;align-items:center;gap:10px"><img src="${photo(r)}" style="width:34px;height:34px;border-radius:10px;object-fit:cover" alt=""><b>${esc(r.name)}</b></div></td>${nums}
        <td style="min-width:150px"><div style="display:flex;align-items:center;gap:10px"><div class="prog ${st === 'critical' ? 'red' : st === 'watch' ? 'amber' : ''}" style="margin:0;flex:1"><i data-w="${p}"></i></div><b class="num" style="min-width:${t.kind === 'talk' ? 38 : 112}px;text-align:right;white-space:nowrap">${t.kind === 'talk' ? p + '%' : rnPct(s.done, s.morning)}</b></div></td>${t.key === 'nc15' ? `<td class="num" style="white-space:nowrap">${s.share ? rnPct2(s.share.count, s.share.den) : '—'}</td>` : ''}<td>${t.kind === 'talk' ? `<span title="${s.expected != null ? esc('Expected by now: about ' + s.expected + ' min of ' + s.target + '. Done: ' + s.done + ' min.') : ''}">${pill(st, TALK_LABEL[st])}</span>` : pill(st)}</td><td style="min-width:260px;max-width:340px;font-size:12.5px;color:var(--ink-2)">${esc((t.kind === 'talk' && s.liveHint) || s.hints[0] || '')}</td></tr>`;
    })
    .join('')}</tbody></table></div>`;
  const all = b.rows.flatMap((r) => r.tasks[t.key].items.map((it) => ({ ...it, tm: r.first }))).sort((a, c) => c.flag - a.flag || a.sort - c.sort);
  view.innerHTML = `
    <div class="tabs rise" id="ttabs">${S.tasks.map((x) => `<button class="${x.key === t.key ? 'on' : ''}" data-key="${x.key}">${x.icon} ${esc(x.short)}${count(x)}</button>`).join('')}</div>
    <div class="card rise" style="--i:1;margin-top:18px"><h3>${t.icon} ${esc(t.label)} · by TM <a class="lh" style="font-size:12.5px;font-weight:500;margin-left:8px" href="${TASK_PAGE[t.key] || CRM + '/tm-performance'}" target="_blank" rel="noopener">Open in Lighthouse<span class="ext">↗</span></a></h3><div class="sub" style="margin-bottom:12px">Rows in red need attention. Click a row to open the TM.${t.kind === 'talk' ? talkLegend(b) : ''}</div>${summary}</div>
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

// The full send of this slot that already went out today, if any.
function sentToday(st, slot) {
  const e = (st.log || []).find((x) => x.slot === slot && !x.test && x.sent >= 2 && new Date(x.at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === st.now.date);
  if (!e) return null;
  return { time: new Date(e.at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }), how: e.manual ? 'by hand' : 'automatically', sent: e.sent };
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
        ${(() => { const d = sentToday(st, S.slot); return d ? `<p class="note" style="background:var(--green-bg);color:var(--green);padding:10px 12px;border-radius:10px;font-weight:600">✓ Today's ${esc(SLOT_LABEL[S.slot])} mail was already sent ${d.how} at ${esc(d.time)} (${d.sent} mails).</p>` : `<p class="note" style="background:var(--amber-bg);color:var(--amber);padding:10px 12px;border-radius:10px">Today's ${esc(SLOT_LABEL[S.slot])} mail has not been sent yet. It goes out automatically within a few minutes of its time.</p>`; })()}<p class="note">Automatic sending runs Mon–Sat at ${esc(st.config.slots.morning)}, ${esc(st.config.slots.progress)} and ${esc(st.config.slots.closure)}.</p>
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
    const label = btn.innerHTML;
    btn.textContent = 'Refreshing Lighthouse, then sending…';
    try {
      const j = await api('/api/send', { body: { slot: S.slot, ...body } });
      S.data = null;
      const bad = j.results.filter((x) => !x.ok);
      if (bad.length) toast(`${bad.length} failed: ${bad[0].error}`, 'err');
      else toast(`${okMsg} (${j.results.length} mail${j.results.length > 1 ? 's' : ''})`, 'ok');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
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
    await load(true).catch(() => {});
    const dup = sentToday(S.status || st, S.slot);
    if (dup) {
      if (!(await confirmBox('Already sent today', `The <b>${esc(SLOT_LABEL[S.slot])}</b> mail already went out ${dup.how} at <b>${esc(dup.time)}</b>. Sending again gives every TM a second copy.`, 'Send again anyway'))) return;
    } else if (!(await confirmBox('Send to the whole team?', `This sends the <b>${esc(SLOT_LABEL[S.slot])}</b> mail to all ${b.rows.length} TMs individually, plus the team board with everyone in CC.`, 'Send all'))) return;
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
  const meta = { morning: ['🌅', "Today's tasks", 'Total tasks, overdue items and student-wise lists'], progress: ['⏱️', 'Progress update', 'Closed vs still open since 10 AM'], closure: ['🌙', 'Task closure', 'Achieved vs missed, carry-forward list'] };
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
    <div class="card rise"><div class="toolbar"><div><h3>Daily automatic emails</h3><div class="sub">Each mail refreshes Lighthouse first, then sends. Sundays are skipped.</div></div><span style="flex:1"></span>
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
const accessRow = (p, acts) => `<div class="acc-row"><div><b>${esc(p.name || p.email)}</b><small>${esc(p.email)}${p.at ? ' · ' + esc(new Date(p.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) : ''}</small></div><div class="acc-act">${acts}</div></div>`;
async function paintAccess() {
  const box = $('#accessBody');
  if (!box) return;
  let j;
  try {
    j = await api('/api/access');
  } catch (e) {
    box.textContent = e.message;
    return;
  }
  const btn = (act, email, label, cls) => `<button class="btn ${cls}" data-acc="${act}" data-email="${esc(email)}">${label}</button>`;
  box.classList.remove('note');
  box.innerHTML = `
    <h4 class="acc-h">Waiting for your approval <span class="tag ${j.pending.length ? 'red' : ''}">${j.pending.length}</span></h4>
    ${j.pending.length ? j.pending.map((p) => accessRow(p, btn('approve', p.email, 'Approve', 'btn-primary') + btn('deny', p.email, 'Deny', 'btn-ghost'))).join('') : '<p class="note" style="margin:4px 0 14px">No requests right now.</p>'}
    <h4 class="acc-h">Approved <span class="tag">${j.approved.length}</span></h4>
    ${j.approved.length ? j.approved.map((p) => accessRow(p, btn('remove', p.email, 'Remove', 'btn-ghost'))).join('') : '<p class="note" style="margin:4px 0 14px">Nobody added yet.</p>'}
    ${j.denied.length ? `<h4 class="acc-h">Denied <span class="tag">${j.denied.length}</span></h4>${j.denied.map((p) => accessRow(p, btn('approve', p.email, 'Approve now', 'btn-ghost') + btn('remove', p.email, 'Clear', 'btn-ghost'))).join('')}` : ''}
    <div class="acc-add"><input id="accNew" type="email" placeholder="Add someone: name@uprio.com"><button class="btn btn-primary" data-acc="approve" data-email="__new">Approve</button></div>`;
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest && e.target.closest('[data-acc]');
  if (!b) return;
  let email = b.dataset.email;
  if (email === '__new') {
    email = ($('#accNew').value || '').trim().toLowerCase();
    if (!email) return toast('Type an email first.', 'err');
  }
  b.disabled = true;
  try {
    const dec = await api('/api/access/decide', { body: { email, action: b.dataset.acc } });
    if (b.dataset.acc === 'approve') toast(dec.mail === 'sent' ? 'Approved. Confirmation mail with the website link sent to ' + email : dec.mail || 'Approved', dec.mail === 'sent' ? 'ok' : 'err');
    else toast(b.dataset.acc === 'deny' ? 'Denied' : 'Removed', 'ok');
    S.status = await api('/api/status');
    paintChrome();
    paintAccess();
  } catch (err) {
    b.disabled = false;
    toast(err.message, 'err');
  }
});
async function settings() {
  await load(true);
  const st = S.status;
  const g = st.google || {};
  title('Settings', 'Lighthouse login and email account');
  view.innerHTML = `
    <div class="card rise" id="mbCard" style="margin-bottom:18px"><h3>✉ TM mailboxes</h3><div id="mbBox" class="note">${loader({ small: true })}</div></div>
    <div class="card rise" id="remCard" style="margin-bottom:18px"><h3>⏰ PTM remark reminders</h3><div id="remBox" class="note">${loader({ small: true })}</div></div>
    <div class="card rise" id="accessCard" style="margin-bottom:18px"><h3>🔑 Access</h3><div class="sub">TMs in your team list see their own tasks and students plus overall team numbers. Anyone else with an UPRIO mail asks for access and shows up here (you also get a mail).</div><div id="accessBody" class="note" style="margin-top:10px">Loading…</div></div>
    <div class="card rise" style="margin-bottom:18px"><h3>🎙 My voice for hover read-outs</h3><div id="packBox" class="note">${loader({ small: true })}</div></div>
    <div class="card rise" style="margin-bottom:18px"><div class="toolbar"><div><h3>🔊 Speak on hover</h3><div class="sub">Rest the pointer on a TM’s card, photo or row and the site reads out their name and today’s numbers. If a TM has recorded a greeting in their own voice, that plays first.</div></div>
      <label class="toggle"><input type="checkbox" id="voiceOn" ${voiceOn() ? 'checked' : ''}><span class="sw"></span>Speak on hover</label></div>
      <div class="voice-list" id="voiceList"></div><p class="note" style="margin-top:10px">Each TM records their own greeting: they sign in, open their profile and press “Record my greeting”. Nobody else can record it for them. This switch is saved for this browser only. Sound starts after your first click on the page (browsers block it before that).</p></div>
    ${st.owner ? `<div class="card rise" id="lhCard" style="margin-bottom:18px"><h3>🔐 Lighthouse login</h3><div class="sub" style="margin-bottom:12px">${st.lighthouse ? (st.refreshError ? `<span style="color:var(--red)">${esc(st.refreshError)}</span>` : `Connected · last data ${esc(fmtTime(st.dataAt))}`) : '<b style="color:var(--red)">Not connected</b>'}</div>
      <div class="form"><label>Authorization value<textarea id="lhAuth" rows="3" autocomplete="off" placeholder="Bearer eyJ…"></textarea></label>
        <p class="note">In Chrome open lighthouse.uprio.com → press F12 → <b>Network</b> tab → reload the page → click any request to backend.uprio.com → under <b>Request Headers</b> copy the whole <b>authorization</b> value and paste it here. Paste a fresh one whenever Refresh says the login was refused.</p>
        <div><button class="btn btn-primary" id="saveLh">Save login</button></div></div></div>` : ''}
    <div class="grid g-2" style="grid-template-columns:1fr 1fr">
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
  const paintRem = async () => {
    const box = $('#remBox');
    if (!box) return;
    try {
      const j = await api('/api/ptm-reminders');
      const t = (iso) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
      box.innerHTML = `<p style="margin:0 0 10px">${esc(j.rule)} Mails go from your mailbox to the TM who conducted the PTM.</p>
        <label class="toggle"><input type="checkbox" id="remOn" ${j.enabled ? 'checked' : ''}><span class="sw"></span>${j.enabled ? 'On: TMs are being reminded' : 'Off: nothing is sent'}</label>
        <div style="margin:12px 0"><button class="btn btn-ghost" id="remTest" type="button">Send me a test mail</button> <span class="note">The test goes only to you, never to a TM.</span></div>
        <b>Waiting for a remark right now</b>${j.error ? `<p class="note" style="color:var(--red)">${esc(j.error)}</p>` : ''}
        ${j.pending.length ? '<ul style="margin:6px 0 0;padding-left:18px">' + j.pending.map((p) => `<li><b>${esc(p.tm)}</b>: ${p.items.map((i) => esc(i.student)).join(', ')}${p.lastReminder ? ` <small style="color:var(--ink-3)">· last reminder ${esc(t(p.lastReminder))}</small>` : ''}</li>`).join('') + '</ul>' : '<p class="note" style="margin:6px 0 0">Nobody. Every PTM that is due has a remark.</p>'}
        ${j.log.length ? '<details style="margin-top:10px"><summary style="cursor:pointer">Recent reminders</summary><ul style="margin:6px 0 0;padding-left:18px">' + j.log.map((l) => `<li>${esc(t(l.at))}: ${l.sent.map((x) => esc(x.tm) + ' (' + x.pending + ')').join(', ') || 'none sent'}${l.failed.length ? ' · failed: ' + l.failed.map((x) => esc(x.tm)).join(', ') : ''}</li>`).join('') + '</ul></details>' : ''}`;
      $('#remOn').onchange = async (e) => {
        try {
          await api('/api/ptm-reminders/config', { body: { enabled: e.target.checked } });
          toast(e.target.checked ? 'Reminders switched on' : 'Reminders switched off', 'ok');
          paintRem();
        } catch (err) {
          toast(err.message, 'err');
        }
      };
      $('#remTest').onclick = async (e) => {
        e.target.disabled = true;
        try {
          await api('/api/ptm-reminders/test', { body: {} });
          toast('Test mail sent to you', 'ok');
        } catch (err) {
          toast(err.message, 'err');
        }
        e.target.disabled = false;
      };
    } catch (err) {
      box.textContent = err.message;
    }
  };
  paintRem();
  api('/api/mailboxes')
    .then((j) => {
      const box = $('#mbBox');
      if (!box) return;
      box.innerHTML = `<p style="margin:0 0 10px">Each TM connects their own Google mailbox once (the “Connect my mailbox” link in their sidebar). Mails that a rule sets to “from the TM” then go out from the TM's own address. Google asks them for permission to send mail only; they can disconnect any time.</p>
        <ul style="margin:0;padding-left:18px">${j.tms.map((t) => `<li><b>${esc(t.name)}</b> <small style="color:var(--ink-3)">${esc(t.email)}</small> · ${t.connected ? '<span style="color:var(--green)">connected</span>' : '<span style="color:var(--ink-3)">not connected yet</span>'}</li>`).join('')}</ul>
        <p class="note" style="margin:10px 0 0">Hub mailbox (used for reminders): ${j.hub ? esc(j.hub) : 'not connected'}</p>`;
    })
    .catch((e) => ($('#mbBox') && ($('#mbBox').textContent = e.message)));
  if ($('#saveLh')) $('#saveLh').onclick = async () => {
    try {
      await api('/api/login', { body: { auth: $('#lhAuth').value } });
      $('#lhAuth').value = '';
      toast('Lighthouse login saved. Loading data…', 'ok');
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
  paintAccess();
  paintPack();
}

// ---------- start ----------
view.innerHTML = loader();
route();
setTimeout(swrWarm, 600); // once per visit; no repeating timer, to keep server and database traffic low
// A tab left open keeps the old look and code, so it reloads itself after the site is updated; never while someone is
// typing, has a window or a filter open, has unsaved text, or a report is being made.
let seenVersion = '';
function reloadIfUpdated(version) {
  if (!version) return;
  if (!seenVersion) {
    seenVersion = version;
    return;
  }
  if (version === seenVersion) return;
  const el = document.activeElement;
  const busy =
    reportBusy ||
    (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) ||
    ($('#modal') && !$('#modal').hidden) ||
    document.querySelector('.ms-pop:not([hidden])') ||
    [...document.querySelectorAll('textarea')].some((t) => t.value.trim());
  if (!busy) location.reload(); // otherwise tried again at the next check
}
async function keepCurrent() {
  // Quietly keep the sidebar status current.
  try {
    S.status = await api('/api/status');
    paintChrome();
    reloadIfUpdated(S.status.version);
  } catch {}
}
keepCurrent();
setInterval(keepCurrent, 60000);
document.addEventListener('visibilitychange', () => !document.hidden && keepCurrent());

// ---------- Speak on hover ----------
// Reads a TM's name and today's numbers aloud when the pointer rests on them. If the TM has
// recorded a greeting (public/voices/<first name>.mp3), that plays first.
const voiceOn = () => {
  // hover read-outs are for the admin only; TMs and viewers never hear them
  if (!S.status || S.status.role !== 'owner') return false;
  try {
    return localStorage.getItem('tmhub.voice') !== 'off';
  } catch {
    return true;
  }
};
document.addEventListener('change', (e) => {
  if (e.target.id !== 'voiceOn') return;
  try {
    localStorage.setItem('tmhub.voice', e.target.checked ? 'on' : 'off');
  } catch {}
  if (!e.target.checked) hush();
  toast(e.target.checked ? 'Speak on hover is on' : 'Speak on hover is off', 'ok');
});
const voice = { timer: null, last: '', at: 0, clip: null, run: 0, src: null };
function hush() {
  clearTimeout(voice.timer);
  voice.run++;
  try {
    if (voice.src) voice.src.stop();
  } catch {}
  voice.src = null;
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (voice.clip) voice.clip.pause();
  voice.clip = null;
}
function tmLine(r) {
  const T = r.tasks;
  const list = S.tasks.filter((t) => t.kind !== 'talk');
  const pending = list.reduce((n, t) => n + (T[t.key].pending || 0), 0);
  const done = list.reduce((n, t) => n + ((t.kind === 'list' ? T[t.key].closed : T[t.key].done) || 0), 0);
  const s = (n) => (n === 1 ? '' : 's');
  return `${r.first}. ${pending} task${s(pending)} pending. ${done} task${s(done)} completed.`;
}
function sayText(text) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  const v = speechSynthesis.getVoices().find((x) => /en[-_]IN/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
  if (v) u.voice = v;
  u.rate = 1.02;
  speechSynthesis.speak(u);
}
// ---- Voice pack: the owner's own voice, stitched from short clips ----
const slugOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
let packCache = null;
async function packKeys(force) {
  if (!packCache || force)
    packCache = Promise.all([
      fetch('/voicepack/index.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      api('/api/voicepack').then((j) => j.keys).catch(() => ({})),
    ]).then(([shipped, mine]) => ({ ...Object.fromEntries(Object.keys(shipped).map((k) => [k, 's1'])), ...mine }));
  return packCache;
}
function lineParts(r) {
  const T = r.tasks;
  const list = S.tasks.filter((t) => t.kind !== 'talk');
  const pending = list.reduce((n, t) => n + (T[t.key].pending || 0), 0);
  const done = list.reduce((n, t) => n + ((t.kind === 'list' ? T[t.key].closed : T[t.key].done) || 0), 0);
  const one = (n, word) => ({ key: n === 1 ? 'task-' + word : 'tasks-' + word, text: `${n === 1 ? 'task' : 'tasks'} ${word}` });
  return [
    { key: 'name-' + slugOf(r.first), text: r.first },
    { key: 'n-' + pending, text: String(pending) },
    one(pending, 'pending'),
    { key: 'n-' + done, text: String(done) },
    one(done, 'completed'),
  ];
}
let audioCtx = null;
const bufCache = new Map();
async function clipBuffer(key, v) {
  const id = key + ':' + v;
  if (!bufCache.has(id)) {
    bufCache.set(id, fetch(String(v).startsWith('s') ? '/voicepack/' + key + '.wav?v=' + v : '/api/voicepack/' + key + '?v=' + v).then((r) => r.arrayBuffer()).then((b) => audioCtx.decodeAudioData(b)));
  }
  return bufCache.get(id);
}
function speakFallback(text) {
  return new Promise((res) => {
    if (!window.speechSynthesis) return res();
    const u = new SpeechSynthesisUtterance(text);
    const v = speechSynthesis.getVoices().find((x) => /en[-_]IN/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    u.onend = u.onerror = () => res();
    speechSynthesis.speak(u);
  });
}
async function playParts(parts, pack) {
  const run = voice.run;
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {});
  for (const p of parts) {
    if (voice.run !== run) return;
    if (pack[p.key]) {
      try {
        const buf = await clipBuffer(p.key, pack[p.key]);
        if (voice.run !== run) return;
        await new Promise((res) => {
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.connect(audioCtx.destination);
          src.onended = res;
          voice.src = src;
          src.start();
        });
        continue;
      } catch {}
    }
    await speakFallback(p.text);
  }
}
// ---- Settings: guided recorder for the voice pack (owner only) ----
function packPrompts() {
  const names = ((S.data && S.data.rows) || []).map((r) => ({ key: 'name-' + slugOf(r.first), say: r.first, hint: 'a TM name' }));
  const nums = Array.from({ length: 51 }, (_, i) => ({ key: 'n-' + i, say: String(i), hint: 'a number' }));
  return [
    { key: 'tasks-pending', say: 'tasks pending', hint: 'the phrase, like “9 tasks pending”' },
    { key: 'task-pending', say: 'task pending', hint: 'singular, like “1 task pending”' },
    { key: 'tasks-completed', say: 'tasks completed', hint: 'the phrase, like “2 tasks completed”' },
    { key: 'task-completed', say: 'task completed', hint: 'singular, like “1 task completed”' },
    ...names,
    ...nums,
  ];
}
function toWav(buf) {
  const ch = buf.getChannelData(0);
  const thr = 0.02;
  let s = 0, e = ch.length - 1;
  while (s < e && Math.abs(ch[s]) < thr) s++;
  while (e > s && Math.abs(ch[e]) < thr) e--;
  const pad = Math.round(buf.sampleRate * 0.03);
  s = Math.max(0, s - pad);
  e = Math.min(ch.length - 1, e + pad);
  const rate = 24000;
  const ratio = buf.sampleRate / rate;
  const n = Math.max(1, Math.floor((e - s) / ratio));
  const out = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, t) => [...t].forEach((x, i) => out.setUint8(o + i, x.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, ch[s + Math.floor(i * ratio)] * 1.15));
    out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([out], { type: 'audio/wav' });
}
async function packRecorder() {
  if (!navigator.mediaDevices || !window.MediaRecorder) return toast('This browser cannot record sound. Try Chrome.', 'err');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } });
  } catch {
    return toast('Allow the microphone to record.', 'err');
  }
  const have = await packKeys(true);
  const prompts = packPrompts().filter((p) => !have[p.key]);
  if (!prompts.length) {
    stream.getTracks().forEach((t) => t.stop());
    return toast('Every clip is already recorded.', 'ok');
  }
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const m = $('#modal');
  $('#modalCard').innerHTML = `<h3>🎙 Record your voice pack</h3><div class="note">Say each word on its own, clearly, in your normal voice. About ${prompts.length} short clips.</div>
    <div class="pk-say" id="pkSay"></div><div class="pk-hint" id="pkHint"></div><div class="rp-bar"><i id="pkBar"></i></div><div class="rp-meta"><span id="pkN"></span><span id="pkStat"></span></div>
    <div class="actions"><button class="btn btn-ghost" id="pkSkip">Skip</button><button class="btn btn-primary" id="pkRec">● Record</button><button class="btn btn-ghost" id="pkDone">Finish</button></div>`;
  m.hidden = false;
  let i = 0, rec = null, chunks = [];
  const show = () => {
    const p = prompts[i];
    if (!p) return finish();
    $('#pkSay').textContent = p.say;
    $('#pkHint').textContent = p.hint;
    $('#pkN').textContent = `${i + 1} of ${prompts.length}`;
    $('#pkBar').style.width = (100 * i) / prompts.length + '%';
    $('#pkStat').textContent = '';
  };
  const finish = () => {
    stream.getTracks().forEach((t) => t.stop());
    m.hidden = true;
    packKeys(true);
    toast('Voice pack saved', 'ok');
    const box = $('#packBox');
    if (box) paintPack();
  };
  $('#pkDone').onclick = finish;
  $('#pkSkip').onclick = () => { i++; show(); };
  $('#pkRec').onclick = async () => {
    const btn = $('#pkRec');
    if (!rec) {
      chunks = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        $('#pkStat').textContent = 'Saving…';
        try {
          const buf = await audioCtx.decodeAudioData(await new Blob(chunks).arrayBuffer());
          const wav = toWav(buf);
          const r = await fetch('/api/voicepack/' + prompts[i].key, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not save');
          i++;
          show();
        } catch (err) {
          $('#pkStat').textContent = err.message;
        }
        rec = null;
        btn.textContent = '● Record';
        btn.classList.remove('rec-on');
      };
      rec.start();
      btn.textContent = '■ Stop';
      btn.classList.add('rec-on');
    } else {
      rec.stop();
    }
  };
  show();
}
async function paintPack() {
  const box = $('#packBox');
  if (!box) return;
  const have = await packKeys(true);
  const all = packPrompts();
  const n = all.filter((p) => have[p.key]).length;
  box.innerHTML = `<div class="sub">${n} of ${all.length} clips recorded.${n ? '' : ' Record once, then hovering a TM speaks in your voice.'}</div>
    <div class="actions" style="justify-content:flex-start;margin-top:10px"><button class="btn btn-primary" id="packRec">🎙 ${n ? 'Record the rest' : 'Start recording'}</button>${n ? '<button class="btn btn-ghost" id="packTest">▶ Test it</button><button class="btn btn-ghost" id="packClear">Delete all</button>' : ''}</div>`;
}
document.addEventListener('click', async (e) => {
  const id = e.target.closest && e.target.closest('#packRec, #packTest, #packClear');
  if (!id) return;
  if (id.id === 'packRec') return packRecorder();
  if (id.id === 'packTest') {
    const r = S.data && S.data.rows[0];
    if (!r) return toast('Load the dashboard first.', 'err');
    hush();
    return playParts(lineParts(r), await packKeys());
  }
  if (await confirmBox('Delete the voice pack?', 'All recorded clips will be removed. Hover read-outs go back to the browser voice.', 'Delete')) {
    await fetch('/api/voicepack', { method: 'DELETE' }).catch(() => {});
    packCache = null;
    paintPack();
  }
});

// Which TMs have a greeting (asked once, and again after a recording changes).
let voiceList = null;
async function voices(force) {
  if (!voiceList || force) voiceList = api('/api/voice').then((j) => j.voices).catch(() => ({}));
  return voiceList;
}
const voiceUrl = (name, v) => `/api/voice/${encodeURIComponent(name)}?v=${v}`;
async function speakTm(name) {
  const r = S.data && S.data.rows.find((x) => x.name === name);
  if (!r) return;
  hush();
  const pack = await packKeys();
  const parts = lineParts(r);
  if (parts.some((p) => pack[p.key])) return playParts(parts, pack);
  const text = tmLine(r);
  const v = (await voices())[name];
  if (!v || !v.has) return sayText(text);
  const clip = new Audio(voiceUrl(name, v.v));
  voice.clip = clip;
  clip.onended = () => voice.clip === clip && sayText(text);
  clip.onerror = () => voice.clip === clip && sayText(text);
  clip.play().catch(() => {});
}

// Greeting controls on a TM's profile, and the list in Settings.
async function paintVoice() {
  const box = $('.voice-box:not([data-done])');
  const list = $('#voiceList:not([data-done])');
  if (!box && !list) return;
  if (box) box.dataset.done = 1;
  if (list) list.dataset.done = 1;
  const all = await voices(true);
  if (list)
    list.innerHTML = Object.entries(all)
      .map(([n, v]) => `<span class="chip ${v.has ? 'ok' : ''}">${v.has ? '🎙' : '○'} ${esc(n.split(' ')[0])}${v.has ? ` <button class="mini" data-vplay="${esc(n)}">Play</button>${v.canRemove ? `<button class="mini" data-vdel="${esc(n)}">Remove</button>` : ''}` : ' · no greeting'}${v.sample ? ' · voice sample ✓' : ''}</span>`)
      .join('');
  if (box) {
    const n = box.dataset.voice;
    const v = all[n] || {};
    box.innerHTML =
      (v.has ? `<button class="mini" data-vplay="${esc(n)}">▶ Play greeting</button>` : '') +
      (v.canRecord ? `<button class="mini" data-vrec="${esc(n)}">🎙 ${v.has ? 'Record again' : 'Record my greeting'}</button>` : '') +
      (v.has && v.canRemove ? `<button class="mini" data-vdel="${esc(n)}">Remove</button>` : '') +
      (v.canRecord && !v.sample ? `<button class="mini" data-vshare="${esc(n)}">🗣 Share my voice for read-outs</button>` : '') +
      (v.sample ? `<span class="voice-none">✓ Voice sample shared${v.consentAt ? ` on ${esc(fmtTime(v.consentAt))}` : ''}</span>${v.canRemove ? `<button class="mini" data-vwithdraw="${esc(n)}">Withdraw</button>` : ''}` : '') +
      (!v.has && !v.canRecord && !v.sample ? '<span class="voice-none">No greeting recorded yet</span>' : '');
  }
}
new MutationObserver(() => paintVoice()).observe(view, { childList: true, subtree: true });
const repaintVoice = () => {
  $$('.voice-box, #voiceList').forEach((el) => el.removeAttribute('data-done'));
  paintVoice();
};

// Records up to five seconds from the microphone and saves it as this TM's greeting.
async function recordGreeting(name, btn, kind = '', seconds = 5) {
  if (!navigator.mediaDevices || !window.MediaRecorder) return toast('This browser cannot record sound. Try Chrome.', 'err');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return toast('Microphone access was not allowed.', 'err');
  }
  const type = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined);
  const parts = [];
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  const stopped = new Promise((r) => (rec.onstop = r));
  rec.start();
  let left = seconds;
  btn.dataset.recording = 1;
  btn.textContent = `■ Stop (${left}s)`;
  const tick = setInterval(() => {
    left--;
    if (left <= 0) rec.state === 'recording' && rec.stop();
    else btn.textContent = `■ Stop (${left}s)`;
  }, 1000);
  btn.onclick = (e) => {
    e.stopPropagation();
    rec.state === 'recording' && rec.stop();
  };
  await stopped;
  clearInterval(tick);
  stream.getTracks().forEach((t) => t.stop());
  btn.textContent = 'Saving…';
  btn.disabled = true;
  try {
    const blob = new Blob(parts, { type: rec.mimeType || type });
    const data = await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(String(fr.result).split(',')[1]);
      fr.readAsDataURL(blob);
    });
    await api(`/api/voice/${encodeURIComponent(name)}${kind ? `?kind=${kind}` : ''}`, { body: { type: blob.type, data, consent: kind ? true : undefined } });
    toast(kind ? 'Voice sample saved. Thank you!' : 'Greeting saved', 'ok');
  } catch (e) {
    toast(e.message, 'err');
  }
  if (kind) $('#modal').hidden = true;
  repaintVoice();
}
// The agreement a TM reads and ticks before sharing a voice sample.
const VOICE_SCRIPT = 'Hello, this is my voice sample for the T M Hub. Today I will check my onboarding tasks, call the parents I have not spoken to for fifteen days, book the pending I C 2 and evaluation classes, and close my open concerns. Numbers like twelve, thirty five and ninety minutes should sound clear. Thank you.';
function shareVoice(name) {
  const m = $('#modal');
  $('#modalCard').innerHTML = `<h3>Share my voice for read-outs</h3>
    <div class="note" style="font-size:13.5px;line-height:1.55">This records about 30 seconds of you reading the text below. It is used to make a copy of your voice that reads out <b>your own task numbers</b> inside the TM Hub, and for nothing else. You can withdraw whenever you like; that deletes the recording.</div>
    <div class="callout" style="margin:12px 0;font-size:14px;line-height:1.6">“${esc(VOICE_SCRIPT)}”</div>
    <label class="toggle" style="margin-bottom:14px"><input type="checkbox" id="vAgree"><span class="sw"></span>I agree, and this is my own decision</label>
    <div class="actions"><button class="btn btn-ghost" id="vCancel">Cancel</button><button class="btn btn-primary" id="vGo" disabled>🎙 Start recording</button></div>`;
  m.hidden = false;
  $('#vAgree').onchange = (e) => ($('#vGo').disabled = !e.target.checked);
  $('#vCancel').onclick = () => (m.hidden = true);
  $('#vGo').onclick = (e) => {
    $('#vAgree').disabled = true;
    $('#vCancel').hidden = true;
    e.currentTarget.onclick = null;
    recordGreeting(name, e.currentTarget, 'sample', 40);
  };
}
document.addEventListener('click', async (e) => {
  const w = e.target.closest && e.target.closest('[data-vshare], [data-vwithdraw]');
  if (!w) return;
  e.preventDefault();
  e.stopPropagation();
  if (w.dataset.vshare) return shareVoice(w.dataset.vshare);
  if (await confirmBox('Withdraw your voice sample?', 'The recording and the agreement are deleted. Read-outs go back to the standard voice.', 'Withdraw')) {
    await fetch(`/api/voice/${encodeURIComponent(w.dataset.vwithdraw)}?kind=sample`, { method: 'DELETE' }).catch(() => {});
    repaintVoice();
  }
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest && e.target.closest('[data-vplay], [data-vrec], [data-vdel]');
  if (!b || b.dataset.recording) return;
  e.preventDefault();
  e.stopPropagation();
  if (b.dataset.vplay) {
    hush();
    const v = (await voices())[b.dataset.vplay];
    if (v && v.has) (voice.clip = new Audio(voiceUrl(b.dataset.vplay, v.v))).play().catch(() => toast('Could not play the greeting.', 'err'));
  } else if (b.dataset.vrec) {
    recordGreeting(b.dataset.vrec, b);
  } else if (await confirmBox('Remove this greeting?', `${esc(b.dataset.vdel)}’s recorded greeting will be deleted.`, 'Remove')) {
    await fetch(`/api/voice/${encodeURIComponent(b.dataset.vdel)}`, { method: 'DELETE' }).catch(() => {});
    repaintVoice();
  }
});
document.addEventListener('mouseover', (e) => {
  if (!voiceOn() || !e.target.closest) return;
  const el = e.target.closest('a[href^="#/tm/"], [data-go^="#/tm/"]');
  if (!el) return;
  const name = decodeURIComponent((el.getAttribute('href') || el.dataset.go).split('/')[2] || '');
  if (!name || (name === voice.last && Date.now() - voice.at < 6000)) return;
  clearTimeout(voice.timer);
  // A short pause, so passing over a card on the way elsewhere stays silent.
  voice.timer = setTimeout(() => {
    voice.last = name;
    voice.at = Date.now();
    speakTm(name);
  }, 450);
});
document.addEventListener('mouseout', (e) => {
  const el = e.target.closest && e.target.closest('a[href^="#/tm/"], [data-go^="#/tm/"]');
  if (el && !el.contains(e.relatedTarget)) clearTimeout(voice.timer);
});
window.addEventListener('hashchange', hush);

// ---------- PTM ----------
// Parent-teacher meetings from Lighthouse: today's schedule, each TM's count, and history.
const PTM_STATUS = {
  completed: ['Done', 'ok'],
  no_show: ['Parent no-show', 'red'],
  cancelled: ['Cancelled', 'grey'],
  upcoming: ['Upcoming', 'blue'],
  live: ['In progress', 'blue'],
  unmarked: ['Not marked', 'amber'],
};
function ptmState(m) {
  if (m._st) return m._st;
  if (m.status !== 'scheduled') return PTM_STATUS[m.status] ? m.status : 'unmarked';
  const now = Date.now();
  if (new Date(m.start) > now) return 'upcoming';
  if (new Date(m.end) > now) return 'live';
  return 'unmarked';
}
// A student counts once a day, however many PTMs they had; the parent minutes are added together.
const PTM_RANK = ['completed', 'live', 'upcoming', 'no_show', 'unmarked', 'cancelled'];
function ptmUniq(list) {
  const by = new Map();
  for (const m of list) {
    const k = m.date + '|' + String(m.studentId || m.student || '').toLowerCase().trim();
    const g = by.get(k);
    if (!g) by.set(k, { first: m, all: [m] });
    else g.all.push(m);
  }
  return [...by.values()].map(({ first, all }) => {
    if (all.length === 1) return first;
    const rank = (m) => PTM_RANK.indexOf(ptmState(m));
    const rep = all.slice().sort((a, b) => rank(a) - rank(b) || Number(!!b.remark) - Number(!!a.remark))[0];
    const mins = all.some((x) => x.parentMinutes != null) ? all.reduce((s, x) => s + (x.parentMinutes || 0), 0) : null;
    const withs = [...new Set(all.flatMap((x) => x.with || []))];
    const remark = rep.remark || (all.find((x) => x.remark) || {}).remark || null;
    return { ...rep, _st: ptmState(rep), parentMinutes: mins, with: withs, remark, recording: all.some((x) => x.recording), _n: all.length };
  });
}
const ptmTag = (m) => {
  const [label, cls] = PTM_STATUS[ptmState(m)];
  return `<span class="ptag ${cls}">${esc(label)}</span>`;
};
const ptmTime = (m) => new Date(m.start).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });
const ptmDay = (m) => new Date(m.start).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
const ptmParent = (m) => (m.parentMinutes == null ? (m.parentJoined ? 'Joined' : '—') : m.parentMinutes ? `${m.parentMinutes} min` : 'Did not join');
const ptmStudent = (m) => lhLink(m.studentId ? `${CRM}/students/view/${m.studentId}` : '', esc(m.student));
const ptmView = { tm: '', status: '', preset: '', from: '', to: '' };
// Remarks the TM writes after the PTM (saved on the hub, shown to the owner and the TM)
const rmCan = (m) => !S.status || !S.status.role || S.status.role === 'owner' || (S.status.role === 'tm' && S.status.myTm === m.tm);
function remarkHtml(m) {
  const r = m.remark;
  const can = rmCan(m) && ptmState(m) !== 'upcoming';
  const txt = r ? `<div class="rm-text">${esc(r.text)}</div><small class="rm-by">${esc(r.by || '')}${r.at ? ' · ' + esc(new Date(r.at).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })) : ''}</small>` : '';
  const btn = can ? `<button class="rm-btn" type="button">${r ? '✎ Edit' : '＋ Add remark'}</button>` : r ? '' : '<small style="color:var(--ink-3)">—</small>';
  return txt + btn;
}
// The student's PTM report: open the latest saved one, or make one (also for PTMs still to come)
const reportCell = (m) => {
  if (!m.studentId || ptmState(m) === 'cancelled') return '<td><small style="color:var(--ink-3)">—</small></td>';
  const r = (m.reports || [])[0];
  const when = (x) => new Date(x.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) + ' · ' + new Date(x.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).toUpperCase();
  return r
    ? `<td class="rp-cell" style="white-space:nowrap"><a class="chip" href="/api/reports/file/${esc(r.id)}" target="_blank" rel="noopener" title="Open the saved PTM report (${esc(r.month || '')})">📄 ${esc(when(r))}</a><br><a href="#" data-report="${esc(m.studentId)}" class="rp-link" style="font-size:12px">↻ Make a new one</a></td>`
    : `<td class="rp-cell" style="white-space:nowrap"><a href="#" data-report="${esc(m.studentId)}" class="btn btn-ghost" style="padding:5px 10px;font-size:12px">📄 Create report</a></td>`;
};
const remarkCell = (m) => `<td class="rm-cell" data-rm="${esc(m.id)}">${remarkHtml(m)}</td>`;
// Under the status: mark a PTM held outside Lighthouse as done, or take such an entry back
const manualCell = (m) => {
  if (!rmCan(m)) return m.manual ? '<br><small style="color:var(--ink-3)">added by hand</small>' : '';
  if (m.manual) return `<br><small style="color:var(--ink-3)">added by hand · <a href="#" data-pm="undo" data-id="${esc(m.id)}">undo</a></small>`;
  const st = ptmState(m);
  if (st === 'completed' || st === 'upcoming' || st === 'cancelled') return '';
  return `<br><a href="#" data-pm="mark" data-id="${esc(m.id)}" data-who="${esc(m.student)}" style="font-size:12px">✓ Mark done (GMeet)</a>`;
};
function ptmRows(list, withDay) {
  if (!list.length) return '<div class="empty">No PTMs here.</div>';
  list = ptmUniq(list);
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>${withDay ? 'Date' : 'Time'}</th><th>TM</th><th>Student</th><th>Status</th><th class="num">Parent time</th><th>Agenda</th><th>Also in the meeting</th><th>Remarks</th><th>Report</th></tr></thead><tbody>${list
    .map(
      (m) => `<tr class="ptm-row" data-ptm="${esc(m.id)}" title="Click for student and meeting details"><td style="white-space:nowrap"><b>${withDay ? `${esc(ptmDay(m))}</b><br><small style="color:var(--ink-3)">${esc(ptmTime(m))}</small>` : `${esc(ptmTime(m))}</b>`}</td>
        <td><a href="#/tm/${encodeURIComponent(m.tm)}"><b>${esc(m.tm.split(' ')[0])}</b></a></td><td>${ptmStudent(m)}${m._n > 1 ? `<br><small style="color:var(--ink-3)" title="Several PTMs with this student on the same day are shown as one, with the parent minutes added">${m._n} meetings, 1 student</small>` : ''}</td><td style="white-space:nowrap">${ptmTag(m)}${m.recording ? ' <span title="Recording available in Lighthouse">🎥</span>' : ''}${manualCell(m)}</td>
        <td class="num">${esc(ptmParent(m))}</td><td class="ptm-agenda">${esc(m.agenda) || '<small style="color:var(--ink-3)">—</small>'}</td><td><small>${esc(m.with.join(', ')) || '—'}</small></td>${remarkCell(m)}${reportCell(m)}</tr>`
    )
    .join('')}</tbody></table></div>`;
}
const isoShift = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
async function ptm() {
  title('PTM', 'Loading parent-teacher meetings from Lighthouse…');
  view.innerHTML = loader({ text: 'Loading parent-teacher meetings' });
  let j;
  try {
    j = await cachedApi('/api/ptm', 180000);
  } catch (e) {
    title('PTM', '');
    view.innerHTML = `<div class="card rise"><h3>PTMs could not be loaded</h3><p class="note">${esc(e.message)}</p></div>`;
    return;
  }
  title('PTM', `Parent-teacher meetings · from Lighthouse at ${fmtTime(j.fetchedAt)}`);
  const all = j.meetings;
  window.__ptmMeetings = all;
  const today = all.filter((m) => m.date === j.today);
  const tomorrowIso = isoShift(j.today, 1);
  const tomorrow = all.filter((m) => m.date === tomorrowIso);
  const weekStart = isoShift(j.today, -((new Date(`${j.today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const count = (list, st) => ptmUniq(list).filter((m) => ptmState(m) === st).length;
  const booked = (list) => ptmUniq(list).filter((m) => ptmState(m) !== 'cancelled').length;
  const since = (d) => all.filter((m) => m.date >= d);
  const tiles = [
    ['📅', booked(today), 'PTMs today', `${count(today, 'upcoming') + count(today, 'live')} still to come`],
    ['✅', count(today, 'completed'), 'Done today', `${count(today, 'no_show')} parent no-show`],
    ['🗓', count(since(weekStart), 'completed'), 'Done this week', `of ${booked(since(weekStart))} booked`],
    ['📈', count(since(j.monthStart), 'completed'), 'Done this month', `of ${booked(since(j.monthStart))} booked`],
  ]
    .map(
      ([ico, v, lbl, meta], i) =>
        `<div class="card kpi rise ptm-kpi" data-ptmq="${i}" tabindex="0" role="button" title="Show these PTMs below" style="--i:${i};cursor:pointer"><div class="top"><div class="ico">${ico}</div></div><div class="val"><span data-count="${v}">0</span></div><div class="lbl">${esc(lbl)}</div><div class="meta">${esc(meta)}</div></div>`
    )
    .join('');
  // One row per TM.
  const stat = (list) => {
    const o = { booked: 0, done: 0, noshow: 0, cancelled: 0, unmarked: 0, minutes: 0 };
    for (const m of ptmUniq(list)) {
      const s = ptmState(m);
      if (s === 'cancelled') o.cancelled++;
      else o.booked++;
      if (s === 'completed') o.done++;
      if (s === 'no_show') o.noshow++;
      if (s === 'unmarked') o.unmarked++;
      if (m.date >= j.monthStart) o.minutes += m.parentMinutes || 0;
    }
    return o;
  };
  const names = [...new Set([...j.team, ...all.map((m) => m.tm)])];
  const perTm = names
    .map((n) => {
      const mine = all.filter((m) => m.tm === n);
      return { n, t: stat(mine.filter((m) => m.date === j.today)), w: stat(mine.filter((m) => m.date >= weekStart)), mo: stat(mine.filter((m) => m.date >= j.monthStart)) };
    })
    .sort((a, b) => b.mo.done - a.mo.done || b.mo.booked - a.mo.booked);
  const frac = (o) => (o.booked ? `${o.done}/${o.booked} done` : '—');
  const tmTable = `<div class="table-wrap"><table class="tbl"><thead><tr><th>TM</th><th class="num">Today</th><th class="num">This week</th><th class="num">Month: booked</th><th class="num">Done</th><th class="num">Parent no-show</th><th class="num">Not marked</th><th class="num">Cancelled</th><th class="num">Parent time</th></tr></thead><tbody>${perTm
    .map(
      (r) => `<tr class="ptm-tm" data-ptmtm="${esc(r.n)}" title="Show ${esc(r.n)}’s past PTMs below"><td><b>${esc(r.n)}</b></td>
        <td class="num">${frac(r.t)}</td><td class="num">${frac(r.w)}</td><td class="num">${r.mo.booked}</td><td class="num"><b>${r.mo.done}</b></td>
        <td class="num">${r.mo.noshow ? `<span class="ptag red">${r.mo.noshow}</span>` : 0}</td><td class="num">${r.mo.unmarked ? `<span class="ptag amber">${r.mo.unmarked}</span>` : 0}</td>
        <td class="num">${r.mo.cancelled}</td><td class="num">${r.mo.minutes} min</td></tr>`
    )
    .join('')}</tbody></table></div>`;
  // ---- PTMs by date: quick picks, From/To dates, TM and status filters ----
  const dayFmt = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const presets = {
    today: ['Today', j.today, j.today],
    yesterday: ['Yesterday', isoShift(j.today, -1), isoShift(j.today, -1)],
    week: ['This week', weekStart, j.today],
    last7: ['Last 7 days', isoShift(j.today, -6), j.today],
    month: ['This month', j.monthStart, j.today],
    last30: ['Last 30 days', isoShift(j.today, -29), j.today],
    upcoming: ['Upcoming', j.today, isoShift(j.today, 14)],
  };
  if (!ptmView.from) Object.assign(ptmView, { preset: 'last7', from: presets.last7[1], to: presets.last7[2] });
  const loaded = { from: j.from, to: j.to };
  const paintHistory = async () => {
    const { from, to } = ptmView;
    const box = $('#ptmHist');
    let list = all;
    // Outside what this page already has: ask Lighthouse for that range.
    if (from < loaded.from || to > loaded.to) {
      box.innerHTML = loader({ small: true });
      try {
        const r = await api(`/api/ptm?from=${from}&to=${to}`);
        list = r.meetings;
        const ids = new Set(ptmAll.map((m) => m.id));
        ptmAll.push(...list.filter((m) => !ids.has(m.id)));
      } catch (e) {
        box.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
        return;
      }
      if (ptmView.from !== from || ptmView.to !== to) return;
    }
    const inRange = list.filter((m) => m.date >= from && m.date <= to);
    // Counts per TM for the chosen dates, shown on the TM buttons.
    $$('#ptmTabs button').forEach((b) => {
      const mine = inRange.filter((m) => !b.dataset.tm || m.tm === b.dataset.tm);
      const um = ptmUniq(mine);
      const n = um.filter((m) => ptmState(m) !== 'cancelled').length;
      b.innerHTML = `${esc(b.dataset.tm ? b.dataset.tm.split(' ')[0] : 'All TMs')}${n ? `<span class="count">${um.filter((m) => ptmState(m) === 'completed').length}/${n}</span>` : ''}`;
      b.classList.toggle('on', b.dataset.tm === ptmView.tm);
    });
    const byTm = inRange.filter((m) => !ptmView.tm || m.tm === ptmView.tm);
    const shown = byTm.filter((m) => !ptmView.status || ptmState(m) === ptmView.status || (ptmView.status === 'upcoming' && ptmState(m) === 'live'));
    const st = stat(byTm);
    const label = ptmView.preset && presets[ptmView.preset] ? presets[ptmView.preset][0] : from === to ? dayFmt(from) : `${dayFmt(from)} – ${dayFmt(to)}`;
    $('#ptmSum').innerHTML = `<b>${esc(label)}${ptmView.tm ? ` · ${esc(ptmView.tm)}` : ''}:</b>
      <span class="ptag blue">${st.booked} booked</span><span class="ptag ok">${st.done} done</span><span class="ptag red">${st.noshow} parent no-show</span>
      <span class="ptag amber">${st.unmarked} not marked</span><span class="ptag grey" style="text-decoration:none">${st.cancelled} cancelled</span>
      <span class="ptag">${byTm.reduce((a, m) => a + (m.parentMinutes || 0), 0)} min parent time</span>`;
    // Newest first for past dates; soonest first when looking ahead.
    const ordered = from >= j.today ? shown : shown.slice().reverse();
    box.innerHTML = ordered.length ? ptmRows(ordered, from !== to) : `<div class="empty">No PTMs ${ptmView.status ? 'with this status ' : ''}for these dates.</div>`;
    $$('#ptmPresets button').forEach((b) => b.classList.toggle('on', b.dataset.preset === ptmView.preset));
    $('#ptmFrom').value = from;
    $('#ptmTo').value = to;
    $$('.ptm-tm').forEach((tr) => tr.classList.toggle('on', tr.dataset.ptmtm === ptmView.tm));
    moveTab($('#ptmTabs'));
    moveTab($('#ptmPresets'));
  };
  const dayName = new Date(`${j.today}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const minDay = isoShift(j.today, -179);
  const maxDay = isoShift(j.today, 30);
  view.innerHTML = `
    <div class="grid g-kpi">${tiles}</div>
    ${reportCard()}
    ${!S.status || S.status.role !== 'viewer' ? '<div style="display:flex;justify-content:flex-end;margin:4px 0 -6px"><button type="button" class="btn btn-primary" data-pm="add">＋ Add PTM taken on Google Meet</button></div>' : ''}
    <div class="section-title"><h2>Today’s PTM schedule</h2><span>${esc(dayName)} · ${lhLink(CRM + '/parent-meetings', 'Open in Lighthouse')}</span></div>
    <div class="card rise">${today.length ? ptmRows(today, false) : '<div class="empty">No PTMs booked for today yet. New bookings show up here when you open this page again.</div>'}</div>
    <div class="section-title"><h2>Tomorrow’s PTM schedule</h2><span>${esc(new Date(tomorrowIso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}</span></div>
    <div class="card rise">${tomorrow.length ? ptmRows(tomorrow, false) : '<div class="empty">No PTMs booked for tomorrow yet.</div>'}</div>
    <div class="section-title"><h2>PTMs taken by each TM</h2><span>Done = held and marked done in Lighthouse. Click a TM to see their PTMs below.</span></div>
    <div class="card rise">${tmTable}</div>
    <div class="section-title" id="ptmByDate"><h2>PTMs by date</h2><span>Click a meeting for student details.</span></div>
    <div class="card rise ptm-filter">
      <div class="tabs" id="ptmPresets">${Object.entries(presets).map(([k, p]) => `<button data-preset="${k}">${esc(p[0])}</button>`).join('')}</div>
      <div class="ptm-dates">
        <label>From <input type="date" id="ptmFrom" min="${minDay}" max="${maxDay}"></label>
        <label>To <input type="date" id="ptmTo" min="${minDay}" max="${maxDay}"></label>
        <label>Status <select id="ptmStatus"><option value="">All</option><option value="completed">Done</option><option value="no_show">Parent no-show</option><option value="unmarked">Not marked</option><option value="cancelled">Cancelled</option><option value="upcoming">Upcoming</option></select></label>
      </div>
      <div class="tabs" id="ptmTabs"><button data-tm="">All TMs</button>${j.team.map((n) => `<button data-tm="${esc(n)}">${esc(n.split(' ')[0])}</button>`).join('')}</div>
      <div class="ptm-sum" id="ptmSum"></div>
    </div>
    <div class="card rise" id="ptmHist" style="margin-top:12px"></div>
    <p class="note" style="margin-top:10px">“Not marked” means the meeting time has passed but it was not marked done or no-show in Lighthouse. Parent time is how long the parent was in the meeting. Dates can go back up to 6 months.</p>`;
  ptmAll = all.slice();
  $('#ptmStatus').value = ptmView.status || '';
  paintHistory();
  view.querySelectorAll('#ptmTabs button').forEach((b) => (b.onclick = () => ((ptmView.tm = b.dataset.tm), paintHistory())));
  view.querySelectorAll('#ptmPresets button').forEach(
    (b) =>
      (b.onclick = () => {
        const p = presets[b.dataset.preset];
        Object.assign(ptmView, { preset: b.dataset.preset, from: p[1], to: p[2] });
        paintHistory();
      })
  );
  const pickDates = () => {
    let from = $('#ptmFrom').value || ptmView.from;
    let to = $('#ptmTo').value || ptmView.to;
    if (from < minDay) from = minDay;
    if (to > maxDay) to = maxDay;
    if (to < from) [from, to] = [to, from];
    Object.assign(ptmView, { preset: '', from, to });
    paintHistory();
  };
  $('#ptmFrom').onchange = pickDates;
  $('#ptmTo').onchange = pickDates;
  $('#ptmStatus').onchange = (e) => ((ptmView.status = e.target.value), paintHistory());
  // the four tiles at the top open the matching list below
  const TILE = [['today', ''], ['today', 'completed'], ['week', 'completed'], ['month', 'completed']];
  const openTile = (k) => {
    const [preset, status] = TILE[k];
    const p = presets[preset];
    Object.assign(ptmView, { preset, from: p[1], to: p[2], tm: '', status });
    $('#ptmStatus').value = status;
    paintHistory();
    const to = $('#ptmByDate');
    if (to) window.scrollTo({ top: to.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
  };
  view.querySelectorAll('.ptm-kpi').forEach((c) => {
    c.onclick = () => openTile(Number(c.dataset.ptmq));
    c.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openTile(Number(c.dataset.ptmq));
      }
    };
  });
  view.querySelectorAll('.ptm-tm').forEach(
    (tr) =>
      (tr.onclick = () => {
        ptmView.tm = ptmView.tm === tr.dataset.ptmtm ? '' : tr.dataset.ptmtm;
        paintHistory();
        window.scrollTo({ top: $('#ptmByDate').getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
      })
  );
}

// ---------- PTM detail panel ----------
// Click a PTM row: the meeting, the student's profile, open tasks and every PTM with this family.
let ptmAll = [];
const dDate = (iso, opts) => (iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', ...opts }) : '—');
const dAgo = (iso) => {
  if (!iso) return '';
  const d = istDaysAgo(iso);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};
const dField = (label, html, full) => `<div class="${full ? 'dfull' : ''}"><small>${esc(label)}</small><b>${html}</b></div>`;
const dPct = (label, v) => (v == null ? '' : dField(label, `${v}%<div class="dbar"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>`));
const BOOKED_FROM = { student_page: 'student page', task: 'a task', tm_meetings: 'Parent Meetings page' };
function closePtmPanel() {
  $$('.drawer, .drawer-bg').forEach((el) => el.remove());
  document.removeEventListener('keydown', ptmEsc);
}
function ptmEsc(e) {
  if (e.key === 'Escape') closePtmPanel();
}
async function openPtmPanel(meetingId) {
  const m = ptmAll.find((x) => x.id === meetingId);
  if (!m) return;
  closePtmPanel();
  const bg = document.createElement('div');
  bg.className = 'drawer-bg';
  bg.onclick = closePtmPanel;
  const dr = document.createElement('aside');
  dr.className = 'drawer';
  dr.setAttribute('role', 'dialog');
  dr.innerHTML = `<div class="drawer-head"><button class="drawer-x" title="Close (Esc)">✕</button><h3>${esc(m.student)}</h3><div class="sub">PTM with ${esc(m.tm)} · ${esc(ptmDay(m))}, ${esc(ptmTime(m))}</div></div>
    <div class="drawer-body">${loader({ small: true })}</div>`;
  document.body.append(bg, dr);
  $('.drawer-x', dr).onclick = closePtmPanel;
  document.addEventListener('keydown', ptmEsc);
  let j;
  try {
    j = await api(`/api/ptm/student/${encodeURIComponent(m.studentId)}`);
  } catch (e) {
    $('.drawer-body', dr).innerHTML = `<div class="dsec"><h4>Could not load the student</h4><p class="note">${esc(e.message)}</p></div>`;
    return;
  }
  if (!dr.isConnected) return;
  const s = j.student || {};
  const cur = j.ptms.find((x) => x.id === m.id) || {};
  const parent = cur.parent || '';
  const links = [
    `<a href="${esc(j.crm)}" target="_blank" rel="noopener">Tutoring CRM ↗</a>`,
    `<a href="${esc(j.crm)}?activeTab=concernsAndRequests" target="_blank" rel="noopener">Concerns ↗</a>`,
    s.schoolId ? `<a href="https://lighthouse.uprio.com/school-planning/v2/${esc(s.schoolId)}?grade=${esc(s.grade || '')}" target="_blank" rel="noopener">School planning ↗</a>` : '',
    `<a href="${esc(CRM)}/parent-meetings" target="_blank" rel="noopener">Parent Meetings ↗</a>`,
    `<a href="#" data-report="${esc(m.studentId)}" class="rp-link">📄 Create PTM report</a>`,
  ].join('');
  $('.drawer-head', dr).insertAdjacentHTML(
    'beforeend',
    `<div class="sub">${[s.grade ? `Grade ${esc(s.grade)}` : '', s.school ? esc(s.school) : '', j.tm ? `TM ${esc(j.tm)}` : ''].filter(Boolean).join(' · ')}</div><div class="links">${links}</div>`
  );
  // This meeting
  const meeting = `<div class="dsec"><h4>This meeting ${ptmTag(m)}</h4><div class="dgrid">
      ${dField('When', `${esc(ptmDay(m))}, ${esc(ptmTime(m))}`)}
      ${dField('Hosted by', esc(m.tm))}
      ${dField('Parent', esc(parent) || '—')}
      ${dField('Parent time in meeting', esc(ptmParent(m)))}
      ${dField('Also in the meeting', esc(m.with.join(', ')) || '—', true)}
      ${cur.bookedAt ? dField('Booked', `${esc(dDate(cur.bookedAt))}${cur.bookedFrom ? ` from the ${esc(BOOKED_FROM[cur.bookedFrom] || cur.bookedFrom.replace(/_/g, ' '))}` : ''}`) : ''}
      ${dField('Recording', m.recording ? 'Available in Lighthouse' : 'None')}
      ${m.agenda ? `<div class="dfull"><small>Agenda</small><div class="dnote">${esc(m.agenda)}</div></div>` : ''}
      ${cur.cancelReason ? `<div class="dfull"><small>Cancel reason</small><div class="dnote">${esc(cur.cancelReason)}</div></div>` : ''}
    </div></div>`;
  // Student profile from the hub's latest Lighthouse pull
  const att = s.att || {};
  const profile = j.student
    ? `<div class="dsec"><h4>Student</h4><div class="dgrid">
      ${dField('Batch', esc(s.batch) || '—', true)}
      ${dField('Maths level', esc(s.level) || '—')}
      ${dField('Class type', s.oneOnOne ? '1-on-1' : 'Group batch')}
      ${dField('Joined', esc(dDate(s.joinedAt)))}
      ${dField('Next renewal', s.renewal ? `${esc(dDate(s.renewal))}${s.lapsed ? ' <span class="ptag red">lapsed</span>' : ''}` : s.lapsed ? '<span class="ptag red">Subscription lapsed</span>' : '—')}
      ${dField('Attendance this month', att.allHeld ? `${att.allAttended}/${att.allHeld} classes${att.regHeld ? ` · regular ${att.regAttended}/${att.regHeld}` : ''}` : '—')}
      ${dField('Last class attended', att.lastAttended ? `${esc(dDate(att.lastAttended))}${att.onHoliday ? ' · on holiday' : ''}` : '—')}
      ${dField('Last parent connect', s.lastContact ? `${esc(dDate(s.lastContact))} <span style="color:var(--ink-3);font-weight:500">(${esc(dAgo(s.lastContact))})</span>` : '—')}
      ${dField('Parent connects, last 30 days', s.contacts30 == null ? '—' : esc(s.contacts30))}
      ${dPct('Green chapters', s.greenPct)}
      ${dPct('Process', s.processPct)}
      ${dPct('Improvement', s.improvementPct)}
      ${dField('Evaluations', s.evalCount == null ? '—' : esc(s.evalCount))}
      ${s.catchupMissPct != null ? dField('Catch-up missed', `${esc(s.catchupMissPct)}%`) : ''}
    </div></div>`
    : `<div class="dsec"><h4>Student</h4><p class="note">This student is not in the team's current student lists, so only Lighthouse links are shown.</p></div>`;
  // Open tasks today
  const tasks = `<div class="dsec"><h4>Open tasks on this student <span class="ptag ${j.tasks.length ? 'amber' : 'ok'}">${j.tasks.length || 'None'}</span></h4>${
    j.tasks.length
      ? `<div class="dlist">${j.tasks
          .map(
            (t) =>
              `<div class="it"><div class="when">${t.icon} ${esc(t.task.split(' (')[0])}</div><div class="what">${t.cells
                .slice(1)
                .map((c, i) => `<small style="color:var(--ink-3)">${esc(t.cols[i + 1] || '')}:</small> ${esc(c)}`)
                .join('<br>')}${t.flag ? ' <span class="ptag red">overdue</span>' : ''}</div>${t.link ? `<a class="lh" href="${esc(t.link)}" target="_blank" rel="noopener">Open<span class="ext">↗</span></a>` : ''}</div>`
          )
          .join('')}</div>`
      : '<p class="note" style="margin:0">Nothing open for this student on today’s board.</p>'
  }</div>`;
  // All PTMs with this family
  const hist = `<div class="dsec"><h4>All PTMs with this family <span class="ptag blue">${j.ptms.length}</span></h4>${
    j.error
      ? `<p class="note">${esc(j.error)}</p>`
      : j.ptms.length
      ? `<div class="dlist">${j.ptms
          .map((p) => {
            const st = { ...p, status: p.status };
            return `<div class="it ${p.id === m.id ? 'cur' : ''}"><div class="when">${esc(dDate(p.start, { year: '2-digit' }))}<small>${esc(ptmTime(p))}</small></div><div class="what">${ptmTag(st)} <small style="color:var(--ink-3)">with ${esc(p.host)}${p.parent ? ` · parent ${esc(p.parent)}` : ''}${p.parentMinutes ? ` · ${p.parentMinutes} min` : ''}</small>${p.agenda ? `<div style="margin-top:4px">${esc(p.agenda)}</div>` : ''}</div></div>`;
          })
          .join('')}</div>`
      : '<p class="note" style="margin:0">No PTMs found.</p>'
  }</div>`;
  const fam = !isOwnerUI() ? '' : `<div class="dsec"><h4>Parents / guardians <span class="ptag blue">${(j.parents || []).length}</span></h4>${
    (j.parents || []).length
      ? `<div class="dlist">${j.parents.map((g) => `<div class="it"><div class="when">${esc(g.relation || 'Guardian')}${g.primary ? '<small>Primary contact</small>' : ''}</div><div class="what"><b>${esc(g.name || '—')}</b><br>${telLink(g.phone, m.studentId) || '<small style="color:var(--ink-3)">No number</small>'}${g.email ? `<br><small style="color:var(--ink-3)">${esc(g.email)}</small>` : ''}</div></div>`).join('')}</div>`
      : '<p class="note" style="margin:0">No parent details found in Lighthouse.</p>'
  }</div>`;
  $('.drawer-body', dr).innerHTML = meeting + fam + profile + tasks + hist;
}
const rmStore = new Map();
function rmFind(id) {
  const list = window.__ptmMeetings;
  return Array.isArray(list) ? list.find((x) => String(x.id) === String(id)) || null : null;
}
document.addEventListener('click', async (e) => {
  const cell = e.target.closest && e.target.closest('.rm-cell');
  if (cell) {
    const id = cell.dataset.rm;
    if (e.target.closest('.rm-btn')) {
      const cur = (cell.querySelector('.rm-text') || {}).textContent || '';
      rmStore.set(id, cell.innerHTML);
      cell.innerHTML = `<textarea class="rm-area" rows="3" maxlength="2000" placeholder="How did the PTM go? Parent's concerns, what was agreed, follow-ups…">${esc(cur)}</textarea><div class="rm-act"><button class="btn btn-primary rm-save" type="button">Save</button><button class="btn btn-ghost rm-cancel" type="button">Cancel</button></div>`;
      cell.querySelector('textarea').focus();
    } else if (e.target.closest('.rm-cancel')) cell.innerHTML = rmStore.get(id) || '';
    else if (e.target.closest('.rm-save')) {
      const text = cell.querySelector('textarea').value;
      const b = e.target.closest('.rm-save');
      b.disabled = true;
      try {
        const out = await api('/api/ptm-remark', { body: { id, text } });
        const m = rmFind(id);
        if (m) m.remark = out.remark;
        else apiCache.delete('/api/ptm');
        document.querySelectorAll('.rm-cell').forEach((c) => { if (c.dataset.rm === id) c.innerHTML = remarkHtml({ ...(m || {}), id, remark: out.remark, tm: (m && m.tm) || (S.status && S.status.myTm) || '', status: (m && m.status) || 'completed' }); });
        toast('Remark saved', 'ok');
      } catch (er) {
        b.disabled = false;
        toast(er.message, 'err');
      }
    }
    return;
  }
  const row = e.target.closest && e.target.closest('.ptm-row');
  if (!row || e.target.closest('a')) return;
  openPtmPanel(row.dataset.ptm);
});
window.addEventListener('hashchange', closePtmPanel);

// ---------- PTMs today on the TM cards ----------
let ptmToday = null;
async function fillPtmCards() {
  const els = $$('[data-ptmcard]:not([data-done])');
  if (!els.length) return;
  els.forEach((el) => (el.dataset.done = 1));
  if (!ptmToday || Date.now() - ptmToday.at > 3 * 60 * 1000) {
    const j = await cachedApi('/api/ptm', 180000).catch(() => null);
    ptmToday = { at: Date.now(), list: j ? j.meetings.filter((m) => m.date === j.today) : null };
  }
  for (const el of els) {
    if (!ptmToday.list) {
      el.textContent = '—';
      continue;
    }
    const mine = ptmUniq(ptmToday.list.filter((m) => m.tm === el.dataset.ptmcard)).filter((m) => ptmState(m) !== 'cancelled');
    const done = mine.filter((m) => ptmState(m) === 'completed').length;
    el.textContent = mine.length;
    const sub = el.parentElement.querySelector('[data-ptmsub]');
    if (sub) sub.textContent = mine.length ? `PTMs today · ${done} done` : 'PTMs today';
  }
}
new MutationObserver(() => fillPtmCards()).observe(view, { childList: true, subtree: true });

// ---------- Loading ahead ----------
document.addEventListener('mouseover', (e) => {
  const a = e.target.closest && e.target.closest('a[href^="#/tm/"], [data-go^="#/tm/"]');
  if (!a || !S.slot) return;
  const name = decodeURIComponent((a.getAttribute('href') || a.dataset.go).split('/')[2] || '');
  if (name) cachedApi(`/api/tm/${encodeURIComponent(name)}?slot=${S.slot}`).catch(() => {});
});
document.addEventListener('mouseover', (e) => {
  if (e.target.closest && e.target.closest('a[href="#/ptm"]')) cachedApi('/api/ptm', 180000).catch(() => {});
});
setTimeout(() => S.data && cachedApi('/api/ptm', 180000).catch(() => {}), 2500);

// ---------- PTMs recorded by hand ----------
async function ptmManual(body, done) {
  try {
    await api('/api/ptm-manual', { body });
    $('#modal').hidden = true;
    toast(done, 'ok');
    apiCache.delete('/api/ptm');
    ptmToday = null;
    route(true);
  } catch (err) {
    toast(err.message, 'err');
  }
}
function ptmModal(title_, fields, onSave) {
  $('#modalCard').innerHTML = `<h3>${title_}</h3><div class="form">${fields}</div><p class="note">Saved in the hub only. Lighthouse is not changed.</p><div class="actions"><button class="btn btn-ghost" id="pmCancel" type="button">Cancel</button><button class="btn btn-primary" id="pmSave" type="button">Save</button></div>`;
  $('#modal').hidden = false;
  $('#pmCancel').onclick = () => ($('#modal').hidden = true);
  $('#pmSave').onclick = onSave;
}
document.addEventListener('click', async (e) => {
  const t = e.target.closest && e.target.closest('[data-pm]');
  if (!t) return;
  e.preventDefault();
  e.stopPropagation();
  const kind = t.dataset.pm;
  if (kind === 'undo') {
    if (window.confirm('Remove this hand-added PTM entry?')) ptmManual({ action: 'undo', id: t.dataset.id }, 'Removed');
    return;
  }
  const mins = '<label>Parent time on the call (minutes)<input id="pmMin" type="number" min="1" max="240" value="20"></label>';
  if (kind === 'mark') {
    ptmModal('✓ Mark PTM done · ' + esc(t.dataset.who || ''), mins, () => ptmManual({ action: 'mark', id: t.dataset.id, minutes: $('#pmMin').value }, 'Marked as done'));
    return;
  }
  await rpLoad();
  const now = new Date(Date.now() + 5.5 * 3600000).toISOString();
  ptmModal(
    '＋ PTM taken on Google Meet',
    `<label>Student<input id="pmStudent" list="pmList" autocomplete="off" placeholder="Type a name or ID"><datalist id="pmList">${(window.__rpStudents || []).map((s) => '<option value="' + esc(s.name + ' · ' + s.id) + '">' + esc(s.school || '') + '</option>').join('')}</datalist></label>
     <label>Date<input id="pmDate" type="date" value="${now.slice(0, 10)}" max="${now.slice(0, 10)}"></label>
     <label>Start time<input id="pmTime" type="time" value="${now.slice(11, 16)}"></label>
     ${mins}
     <label>Note (what it was about)<input id="pmNote" type="text" maxlength="500" placeholder="Optional"></label>`,
    () => {
      const raw = ($('#pmStudent').value || '').trim();
      const id = (raw.match(/(\d+)\s*$/) || [])[1] || String(((window.__rpStudents || []).find((s) => s.name.toLowerCase() === raw.toLowerCase()) || {}).id || '');
      if (!id) return toast('Pick the student from the list.', 'err');
      ptmManual({ action: 'add', studentId: id, date: $('#pmDate').value, time: $('#pmTime').value, minutes: $('#pmMin').value, note: $('#pmNote').value }, 'PTM added');
    }
  );
}, true);

// ---------- Create PTM report ----------
// Runs the four server steps one after another and shows progress. The finished PDF is saved to Google Drive.
function reportMonths() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const fmt = (d) => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const list = [fmt(now), fmt(next)];
  return { list, pick: now.getDate() >= 15 ? list[1] : list[0] };
}
function reportCard() {
  const m = reportMonths();
  const st = S.status || {};
  return `<div class="card rise report-card"><div class="rc-l"><h3>📄 Create PTM report</h3><div class="sub">Type a student name or ID and get a 3-page plan for the one-to-one PTM, built from the student’s Lighthouse reports (with photos of their own work). It downloads as a PDF. Free, takes about 30 seconds.</div></div>
    <div class="rc-r"><input id="rpId" list="rpList" autocomplete="off" placeholder="Student name or ID, e.g. 33682"><datalist id="rpList"></datalist><select id="rpMonth">${m.list.map((x) => `<option ${x === m.pick ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><select id="rpWin" title="How far back to read"><option value="30" selected>Last 30 days</option><option value="60">Last 60 days</option><option value="all">Since joining</option></select>
      <button class="btn btn-primary" id="rpGo">Create report</button></div></div>`;
}
// Student names for the report box (the person's own students; the owner sees all)
async function rpLoad() {
  if (window.__rpStudents) return;
  try {
    const j = await cachedApi('/api/students-all', 600000);
    window.__rpStudents = (j.rows || []).map((r) => ({ id: r.id, name: r.name, school: r.school }));
  } catch {
    window.__rpStudents = [];
  }
  const dl = document.getElementById('rpList');
  if (dl) dl.innerHTML = window.__rpStudents.map((s) => '<option value="' + esc(s.name + ' · ' + s.id) + '">' + esc(s.school || '') + '</option>').join('');
}
document.addEventListener('focusin', async (e) => {
  if (e.target.id !== 'rpId') return;
  await rpLoad();
  const dl = document.getElementById('rpList');
  if (dl && !dl.children.length) dl.innerHTML = (window.__rpStudents || []).map((s) => '<option value="' + esc(s.name + ' · ' + s.id) + '">' + esc(s.school || '') + '</option>').join('');
});
const RSTEPS = ['Gathering Lighthouse data', 'Reading the reports', 'Writing the plan', 'Making the PDF'];
let reportBusy = false;
async function createPtmReport(studentId, month, win) {
  win = win || '30';
  if (reportBusy) return toast('A report is already being made. Please wait for it to finish.', 'err');
  reportBusy = true;
  const m = $('#modal');
  let closed = false;
  $('#modalCard').innerHTML = `<h3>📄 PTM report</h3><div class="note" id="rpWho">Student ${esc(studentId)} · ${esc(month)} · ${win === "all" ? "since joining" : "last " + win + " days"}</div>
    <div class="rp-bar"><i id="rpBar"></i></div><div class="rp-meta"><span id="rpPct">0%</span><span id="rpTime">0s</span></div>
    <ol class="rp-steps">${RSTEPS.map((s, i) => `<li data-i="${i}"><span class="dot"></span><span class="t">${esc(s)}</span><small></small></li>`).join('')}</ol>
    <div id="rpOut"></div><div class="actions"><button class="btn btn-ghost" id="rpClose">Close</button></div>`;
  m.hidden = false;
  const card = $('#modalCard');
  const q = (sel) => card.querySelector(sel);
  const t0 = Date.now();
  q('#rpClose').onclick = () => {
    closed = true;
    m.hidden = true;
  };
  let pct = 0, creep = null;
  const setPct = (p) => {
    pct = Math.max(pct, Math.min(100, p));
    q('#rpBar').style.width = pct + '%';
    q('#rpPct').textContent = Math.round(pct) + '%';
  };
  const clock = setInterval(() => (q('#rpTime').textContent = Math.round((Date.now() - t0) / 1000) + 's'), 500);
  const step = (i, state, note) => {
    const li = $(`.rp-steps li[data-i="${i}"]`);
    li.className = state;
    if (note !== undefined) li.querySelector('small').textContent = note;
  };
  // While a long step runs, the bar creeps towards its end so it never looks stuck.
  const creepTo = (end, secs) => {
    clearInterval(creep);
    const start = pct, ts = Date.now();
    creep = setInterval(() => setPct(start + (end - start) * (1 - Math.exp(-(Date.now() - ts) / (secs * 1000)))), 400);
  };
  const post = (u, body) => api(u, { body });
  try {
    step(0, 'run');
    creepTo(10, 8);
    const ctx = await post('/api/ptm-report/gather', { studentId, window: win });
    q('#rpWho').textContent = `${ctx.student.name} · Grade ${ctx.student.grade} · ${ctx.student.school} · ${month} · ${win === "all" ? "since joining" : "last " + win + " days"}`;
    step(0, 'done', `${ctx.evals.length} evaluation report${ctx.evals.length === 1 ? '' : 's'}${(ctx.chapterReports || []).length ? ' + ' + ctx.chapterReports.length + ' chapter reports' : ''}${ctx.monthly ? ' + monthly report' : ''}`);
    setPct(10);
    step(1, 'run');
    const files = [...(ctx.monthly ? [{ item: ctx.monthly, kind: 'monthly' }] : []), ...(ctx.earlier || []).map((x) => ({ item: x, kind: 'monthly', older: true })), ...ctx.evals.map((e, i) => ({ item: e, kind: 'eval', tag: (e.subject === 'Maths' ? 'M' : 'S') + (i + 1) + '.' })), ...(ctx.chapterReports || []).map((c, i) => ({ item: c, kind: 'chapter', tag: (c.subject === 'science' ? 'Sc' : 'Mc') + (i + 1) + '.' }))];
    let monthlyText = '';
    let candidates = [];
    const chapters = [];
    for (const [i, f] of files.entries()) {
      step(1, 'run', `${i + 1} of ${files.length}`);
      creepTo(10 + (35 * (i + 1)) / files.length, 6);
      const r = await post('/api/ptm-report/read', { item: f.item, kind: f.kind, tag: f.tag });
      if (f.kind === 'monthly') monthlyText += (monthlyText ? '=== EARLIER CYCLE ===' : '') + r.text;
      else if (f.kind === 'chapter') { if (r.chapter) chapters.push(r.chapter); candidates = candidates.concat(r.candidates || []); }
      else candidates = candidates.concat(r.candidates);
      setPct(10 + (35 * (i + 1)) / files.length);
    }
    step(1, 'done', `${candidates.length} answer photos with mistakes`);
    step(2, 'run');
    creepTo(84, 10);
    const w = await post('/api/ptm-report/write', { ctx, monthlyText, candidates: S.status && S.status.ai ? candidates : candidates.map((c) => ({ ...c, photo: '' })), month, chapters });
    step(2, 'done', `${w.plan.mistakes.length} mistakes picked`);
    setPct(85);
    step(3, 'run');
    creepTo(99, 15);
    const photos = Object.fromEntries(candidates.filter((c) => w.plan.mistakes.some((x) => x.photo === c.id)).map((c) => [c.id, c.photo]));
    const out = await post('/api/ptm-report/publish', { ctx, plan: w.plan, photos, month, drive: !!(S.status && S.status.owner && S.status.reportFolder) });
    clearInterval(creep);
    setPct(100);
    step(3, 'done', 'ready');
    const blob = new Blob([Uint8Array.from(atob(out.pdf), (c) => c.charCodeAt(0))], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const viewUrl = out.saved ? out.saved.url : url;
    q('#rpOut').innerHTML = `<div class="rp-done">✅ Report ready: <b>${esc(out.name)}</b><br><button class="btn btn-primary" data-view="${esc(viewUrl)}" data-title="${esc(out.name)}">👁 View report</button> <a class="btn btn-ghost" href="${url}" download="${esc(out.name)}">⬇ Download PDF</a>${out.link ? ` <a class="btn btn-ghost" href="${esc(out.link)}" target="_blank" rel="noopener">Open in Drive</a>` : ''}${out.saved ? '<div class="note" style="margin-top:8px">Saved to this student’s history on the All students tab.</div>' : ''}</div>`;
    document.dispatchEvent(new CustomEvent('ptm-report-saved', { detail: { studentId } }));
    toast(closed ? 'PTM report ready. Open it from the All students tab.' : 'PTM report ready', 'ok');
    if (!closed) viewPdf(viewUrl, out.name, { back: true });
  } catch (e) {
    clearInterval(creep);
    const i = [...card.querySelectorAll('.rp-steps li')].findIndex((li) => li.className === 'run');
    if (i >= 0) step(i, 'fail', '');
    q('#rpOut').innerHTML = `<div class="rp-err">${esc(e.message)}</div><div class="actions" style="margin-top:8px"><button class="btn btn-ghost" id="rpRetry">Try again</button></div>`;
    if (!closed) q('#rpRetry').onclick = () => {
      reportBusy = false;
      createPtmReport(studentId, month, win);
    };
  } finally {
    clearInterval(clock);
    reportBusy = false;
  }
}
document.addEventListener('click', async (e) => {
  const tile = e.target.closest && e.target.closest('.mini-stats .go');
  if (tile) {
    e.preventDefault();
    e.stopPropagation();
    location.hash = tile.dataset.go;
    return;
  }
  const go = e.target.closest && e.target.closest('#rpGo, [data-report]');
  if (!go) return;
  e.preventDefault();
  if (go.id === 'rpGo') {
    const raw = ($('#rpId').value || '').trim();
    let id = /^\d+$/.test(raw) ? raw : '';
    if (!id) {
      // a name (or "Name · 12345" picked from the list)
      const tail = raw.match(/·\s*(\d+)\s*$/);
      if (tail) id = tail[1];
      else {
        await rpLoad();
        const q = raw.toLowerCase();
        const hits = (window.__rpStudents || []).filter((s) => s.name.toLowerCase() === q);
        const part = hits.length ? hits : (window.__rpStudents || []).filter((s) => q && s.name.toLowerCase().includes(q));
        if (part.length === 1) id = String(part[0].id);
        else if (part.length > 1) return toast(part.length + ' students match "' + raw + '". Pick one from the list (it shows the ID).', 'err');
      }
    }
    if (!id) return toast('No student found. Type a name from the list or the student ID.', 'err');
    createPtmReport(id, $('#rpMonth').value, $('#rpWin').value);
  } else {
    closePtmPanel();
    const w = $('#rpWin');
    createPtmReport(go.dataset.report, ($('#rpMonth') && $('#rpMonth').value) || reportMonths().pick, w ? w.value : '30');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'rpId') $('#rpGo').click();
});
// Settings: Claude API key and Drive folder.
document.addEventListener('click', async (e) => {
  if (!e.target.closest || !e.target.closest('#aiSave')) return;
  const key = $('#aiKey').value.trim();
  const folder = $('#aiFolder').value.trim();
  if (!key && !folder) return toast('Paste the API key or the folder link first.', 'err');
  try {
    const j = await api('/api/ai-key', { body: { key, folder } });
    S.status = { ...S.status, ai: j.ai, reportFolder: j.reportFolder };
    $('#aiKey').value = '';
    toast('Saved', 'ok');
    route(true);
  } catch (err) {
    toast(err.message, 'err');
  }
});

// ---------- PDF viewer (pdf.js), with Download ----------
let pdfjsReady = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  if (!pdfjsReady)
    pdfjsReady = new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      sc.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        res();
      };
      sc.onerror = () => rej(new Error('Could not load the PDF viewer.'));
      document.head.appendChild(sc);
    });
  return pdfjsReady;
}
async function viewPdf(url, title) {
  const m = $('#modal');
  const card = $('#modalCard');
  const dl = url.startsWith('blob:') ? url : url + (url.includes('?') ? '&' : '?') + 'dl=1';
  card.classList.add('wide');
  card.innerHTML = `<div class="pdf-head"><h3 style="margin:0">📄 ${esc(title || 'PTM report')}</h3><span style="flex:1"></span><a class="btn btn-ghost" href="${esc(dl)}" download="${esc(title || 'report.pdf')}">⬇ Download</a><a class="btn btn-ghost" href="${esc(url)}" target="_blank" rel="noopener" id="pdfNew">Open in new tab ↗</a><button class="btn btn-primary" id="pdfClose">Close</button></div><div class="pdf-pages" id="pdfPages"><div class="empty">Loading the report…</div></div>`;
  m.hidden = false;
  const close = () => {
    m.hidden = true;
    card.classList.remove('wide');
  };
  $('#pdfClose').onclick = close;
  try {
    await loadPdfJs();
    let pdf = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 4 && !pdf; attempt++) {
      try {
        if (attempt) await new Promise((r) => setTimeout(r, 1200 * attempt));
        const res = await fetch(url + (url.startsWith('blob:') ? '' : (url.includes('?') ? '&' : '?') + 'r=' + Date.now() + attempt), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const buf = await res.arrayBuffer();
        const tail = new TextDecoder('latin1').decode(new Uint8Array(buf).slice(-64));
        if (!tail.includes('%%EOF')) throw new Error('the file is still being saved');
        pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!pdf) throw lastErr || new Error('could not open the file');
    const box = $('#pdfPages');
    box.innerHTML = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 1.5 });
      const cv = document.createElement('canvas');
      cv.width = vp.width;
      cv.height = vp.height;
      cv.className = 'pdf-page';
      box.appendChild(cv);
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    }
  } catch (err) {
    const box = $('#pdfPages');
    if (box) box.innerHTML = `<div class="empty">Could not show the report here (${esc(err.message)}). Use <b>Open in new tab</b> or <b>Download</b>.</div>`;
  }
}
document.addEventListener('click', (e) => {
  const v = e.target.closest && e.target.closest('[data-view]');
  if (v) {
    e.preventDefault();
    return viewPdf(v.dataset.view, v.dataset.title);
  }
  const l = e.target.closest && e.target.closest('a[href^="/api/reports/file/"]');
  if (l && !l.href.includes('dl=1') && !e.ctrlKey && !e.metaKey && e.button === 0 && !l.id) {
    e.preventDefault();
    viewPdf(l.getAttribute('href'), l.title || 'PTM report');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#modal').hidden) {
    $('#modal').hidden = true;
    $('#modalCard').classList.remove('wide');
  }
});
