// Premium theme helpers: swaps emoji and glyph icons for crisp line icons, so the UI looks consistent.
(function () {
  const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    check: P('<path d="M20 6 9 17l-5-5"/>'),
    alert: P('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
    mail: P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
    users: P('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5c2.7 0 4.5 1.8 4.5 4.5"/>'),
    user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>'),
    grad: P('<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/>'),
    school: P('<path d="M3 21h18M5 21V9l7-5 7 5v12M10 21v-5h4v5"/>'),
    flask: P('<path d="M9 3h6M10 3v6l-5.5 10a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9V3"/>'),
    sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: P('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    timer: P('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>'),
    file: P('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
    volume: P('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
    mic: P('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>'),
    video: P('<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m22 8-6 4 6 4z"/>'),
    calendar: P('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    trend: P('<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>'),
    bulb: P('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>'),
    award: P('<circle cx="12" cy="8" r="6"/><path d="M8.2 13.5 7 22l5-3 5 3-1.2-8.5"/>'),
    sparkle: P('<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>'),
    rocket: P('<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z"/>'),
    chat: P('<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z"/>'),
    ban: P('<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>'),
    phone: P('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
    clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    grid: P('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
    columns: P('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>'),
    sliders: P('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
    repeat: P('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
    book: P('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>'),
    badge: P('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="11" r="2.2"/><path d="M5.5 16.5c.6-1.8 1.9-2.6 3.5-2.6s2.9.8 3.5 2.6M14.5 9.5H18M14.5 13H18"/>'),
    handshake: P('<path d="M11 17l2 2a2 2 0 0 0 3-3M14 14l2.5 2.5a2 2 0 0 0 3-3L15 9l-3 1-2-2-4 4 5 5a2 2 0 0 0 3 0"/><path d="M3 11l4-4M17 7l4 4"/>'),
  };
  const MAP = {
    '👋': '', '🎉': 'sparkle', '💡': 'bulb', '🏅': 'award', '👩': 'user', '👥': 'users', '🎓': 'grad', '🏫': 'school', '⚠': 'alert', '⚠️': 'alert',
    '✉': 'mail', '🧪': 'flask', '🌅': 'sun', '⏱️': 'timer', '⏱': 'timer', '🌙': 'moon', '📄': 'file', '🔊': 'volume', '🎙': 'mic', '🗣': 'mic',
    '🎥': 'video', '📅': 'calendar', '🗓': 'calendar', '✅': 'check', '📈': 'trend', '🚀': 'rocket', '💬': 'chat', '🚫': 'ban', '📞': 'phone', '☎': 'phone', '⏰': 'clock', '🔁': 'repeat', '📚': 'book', '📖': 'book',
  };
  const NAV = { dashboard: 'grid', team: 'users', tasks: 'columns', ptm: 'handshake', students: 'grad', renewals: 'repeat', tutors: 'badge', reports: 'mail', schedule: 'clock', settings: 'sliders' };
  const emojiRe = new RegExp('(' + Object.keys(MAP).sort((a, b) => b.length - a.length).join('|') + ')\uFE0F?', 'g');

  function nav() {
    document.querySelectorAll('.nav a[data-route]').forEach((a) => {
      const i = a.querySelector('i');
      if (i && !i.dataset.ic) { i.innerHTML = ICONS[NAV[a.dataset.route]] || ''; i.dataset.ic = '1'; }
    });
  }
  function swap(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && !/^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|SELECT)$/.test(n.parentElement.tagName) && emojiRe.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      emojiRe.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      const s = n.nodeValue;
      while ((m = emojiRe.exec(s))) {
        frag.append(s.slice(last, m.index));
        const name = MAP[m[1]];
        if (name && ICONS[name]) {
          const sp = document.createElement('span');
          sp.className = 'ic';
          sp.innerHTML = ICONS[name];
          frag.append(sp);
        }
        last = m.index + m[0].length;
      }
      frag.append(s.slice(last));
      n.replaceWith(frag);
    }
  }

  // ---------- motion ----------
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const REVEAL = '#view .hero, #view .kpi, #view .tm-card, #view .card, #view .section-title, #view .table-wrap, #view .attn, #view .ptm-tm';
  let io = null;
  function ensureIO() {
    if (io || reduce || !('IntersectionObserver' in window)) return;
    io = new IntersectionObserver((entries) => {
      let k = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.style.setProperty('--d', Math.min(k++, 8) * 55 + 'ms');
        e.target.classList.add('rv-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  }
  function reveal() {
    if (reduce) return;
    ensureIO();
    if (!io) return;
    document.documentElement.classList.add('fx-on');
    document.querySelectorAll(REVEAL).forEach((el) => {
      if (el.dataset.rv) return;
      el.dataset.rv = '1';
      el.classList.add('rv');
      io.observe(el);
    });
    // safety net: never leave anything hidden (background tabs, odd layouts)
    clearTimeout(window.__rvT);
    window.__rvT = setTimeout(() => document.querySelectorAll('.rv:not(.rv-in)').forEach((el) => el.classList.add('rv-in')), 1600);
  }
  function countUp() {
    if (reduce) return;
    document.querySelectorAll('#view .kpi .val, #view .mini-stats b, #view .hero .next-send b').forEach((el) => {
      if (el.dataset.cu) return;
      const tn = [...el.childNodes].find((n) => n.nodeType === 3 && /^\s*\d+(\.\d+)?\s*$/.test(n.nodeValue));
      if (!tn) return;
      el.dataset.cu = '1';
      const end = parseFloat(tn.nodeValue), dec = (tn.nodeValue.split('.')[1] || '').trim().length;
      if (!end) return;
      const t0 = performance.now(), dur = 900;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        tn.nodeValue = (end * e).toFixed(dec);
        if (p < 1) setTimeout(() => tick(performance.now()), 16); else tn.nodeValue = end.toFixed(dec);
      };
      tick(t0);
    });
  }

  // Animated lighthouse in the greeting panel: the lamp turns, the beams sweep across, and on hover they follow the pointer.
  const LH_SCENE = '<div class="hero-lh" aria-hidden="true"><i class="beam a"></i><i class="beam b"></i><i class="flare"></i>' +
    '<svg viewBox="0 0 120 220"><defs><linearGradient id="lhg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d2"/><stop offset="1" stop-color="#f5b83c"/></linearGradient></defs>' +
    '<path d="M6 220 Q18 198 38 194 L82 194 Q102 198 114 220Z" fill="#0a1224"/><path d="M26 206 Q40 196 60 196 Q84 196 98 206" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1.5"/>' +
    '<polygon points="42,196 78,196 70,70 50,70" fill="#e9edf7"/>' +
    '<polygon points="48.2,98 71.8,98 73.1,118 46.9,118" fill="#1d2a5c"/><polygon points="45.2,146 74.8,146 76.1,166 43.9,166" fill="#1d2a5c"/>' +
    '<rect x="57" y="124" width="6" height="11" rx="3" fill="#f5c76a"/><rect x="57" y="174" width="6" height="11" rx="3" fill="#f5c76a"/><rect x="57" y="78" width="6" height="11" rx="3" fill="#f5c76a"/>' +
    '<rect x="43" y="63" width="34" height="7" rx="1.5" fill="#1b2342"/><path d="M45 63v-6M52 63v-6M60 63v-6M68 63v-6M75 63v-6" stroke="#1b2342" stroke-width="1.4"/>' +
    '<rect x="50" y="40" width="20" height="22" rx="2" fill="url(#lhg)" class="lamp"/><path d="M47 41 Q60 20 73 41Z" fill="#1b2342"/><path d="M60 22V12" stroke="#1b2342" stroke-width="2"/></svg>' +
    '<span class="waves"></span></div>';
  const ART = '<svg class="hero-art" viewBox="0 0 520 220" preserveAspectRatio="xMaxYMax slice" aria-hidden="true"><defs><linearGradient id="gl" x1="0" x2="1"><stop offset="0" stop-color="#d9b97a" stop-opacity="0"/><stop offset=".5" stop-color="#e9d3a0"/><stop offset="1" stop-color="#fff3d1"/></linearGradient><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b97a" stop-opacity=".22"/><stop offset="1" stop-color="#d9b97a" stop-opacity="0"/></linearGradient></defs><path class="fill" d="M0 190 C70 170 110 150 170 140 S270 90 330 100 S440 40 520 20 L520 220 L0 220Z" fill="url(#gf)"/><path class="ln c" d="M0 205 C90 190 150 175 210 168 S330 140 400 120 S480 90 520 80" stroke="rgba(255,255,255,.18)" stroke-width="1.5"/><path class="ln b" d="M0 198 C80 176 140 165 200 150 S300 112 370 108 S470 62 520 44" stroke="rgba(217,185,122,.45)" stroke-width="1.5"/><path class="ln" d="M0 190 C70 170 110 150 170 140 S270 90 330 100 S440 40 520 20" stroke="url(#gl)" stroke-width="2.4"/><circle class="dot" cx="330" cy="100" r="4.5" fill="#fff3d1"/><circle class="dot" cx="440" cy="52" r="3.5" fill="#e9d3a0"/></svg>';
  function heroArt() {
    document.querySelectorAll('#view .hero').forEach((h) => {
      if (h.querySelector('.hero-art')) return;
      h.insertAdjacentHTML('afterbegin', ART + LH_SCENE);
    });
  }
  function navInd() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    let ind = nav.querySelector('.nav-ind');
    if (!ind) { ind = document.createElement('span'); ind.className = 'nav-ind'; nav.appendChild(ind); }
    const a = nav.querySelector('a.active');
    if (!a) return;
    ind.style.height = a.offsetHeight - 16 + 'px';
    ind.style.transform = 'translateY(' + (a.offsetTop + 8) + 'px)';
  }
  // the lighthouse beam follows the pointer while it is over the logo
  document.addEventListener('pointermove', (e) => {
    const brand = e.target.closest && e.target.closest('.brand');
    document.querySelectorAll('.lh-photo.tracking').forEach((m) => { if (!brand || !brand.contains(m)) m.classList.remove('tracking'); });
    if (!brand) return;
    const mark = brand.querySelector('.lh-photo');
    if (!mark) return;
    const r = mark.getBoundingClientRect();
    const ang = Math.atan2(e.clientY - (r.top + r.height * 0.225), e.clientX - (r.left + r.width * 0.5)) * 180 / Math.PI;
    mark.classList.add('tracking');
    mark.style.setProperty('--ang', ang + 'deg');
  }, { passive: true });
  document.addEventListener('pointermove', (e) => {
    const hero = e.target.closest && e.target.closest('.hero');
    document.querySelectorAll('.hero-lh.tracking').forEach((l) => { if (!hero || !hero.contains(l)) l.classList.remove('tracking'); });
    if (!hero || reduce) return;
    const lh = hero.querySelector('.hero-lh');
    if (!lh) return;
    const r = lh.getBoundingClientRect();
    const ang = Math.atan2(e.clientY - (r.top + r.height * 0.232), e.clientX - (r.left + r.width * 0.5)) * 180 / Math.PI;
    lh.classList.add('tracking');
    lh.style.setProperty('--ang', ang + 'deg');
  }, { passive: true });
  // 3D tilt on team cards
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest && e.target.closest('.tm-card');
    if (!c || reduce) return;
    if (!c.querySelector('.glare')) c.insertAdjacentHTML('beforeend', '<span class="glare"></span>');
    const r = c.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    c.style.setProperty('--ry', (px * 7).toFixed(2) + 'deg');
    c.style.setProperty('--rx', (-py * 7).toFixed(2) + 'deg');
  }, { passive: true });
  document.addEventListener('pointerout', (e) => { const c = e.target.closest && e.target.closest('.tm-card'); if (c && !c.contains(e.relatedTarget)) { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); } });
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('.kpi, .tm-card, .hero');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', e.clientX - r.left + 'px');
    el.style.setProperty('--my', e.clientY - r.top + 'px');
  }, { passive: true });
  window.addEventListener('scroll', () => { const t = document.querySelector('.topbar'); if (t) t.classList.toggle('scrolled', scrollY > 8); }, { passive: true });
  window.addEventListener('resize', navInd);
  let busy = false;
  const run = () => {
    if (busy) return;
    busy = true;
    nav();
    navInd();
    heroArt();
    reveal();
    countUp();
    for (const sel of ['#view', '#modalCard', '#toasts']) { const el = document.querySelector(sel); if (el) swap(el); }
    busy = false;
  };
  new MutationObserver(() => { clearTimeout(window.__icT); window.__icT = setTimeout(run, 30); }).observe(document.body, { childList: true, subtree: true });
  run();
})();
