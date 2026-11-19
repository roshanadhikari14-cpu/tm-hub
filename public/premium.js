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
    handshake: P('<path d="M11 17l2 2a2 2 0 0 0 3-3M14 14l2.5 2.5a2 2 0 0 0 3-3L15 9l-3 1-2-2-4 4 5 5a2 2 0 0 0 3 0"/><path d="M3 11l4-4M17 7l4 4"/>'),
  };
  const MAP = {
    '👋': '', '🎉': 'sparkle', '💡': 'bulb', '🏅': 'award', '👩': 'user', '👥': 'users', '🎓': 'grad', '🏫': 'school', '⚠': 'alert', '⚠️': 'alert',
    '✉': 'mail', '🧪': 'flask', '🌅': 'sun', '⏱️': 'timer', '⏱': 'timer', '🌙': 'moon', '📄': 'file', '🔊': 'volume', '🎙': 'mic', '🗣': 'mic',
    '🎥': 'video', '📅': 'calendar', '🗓': 'calendar', '✅': 'check', '📈': 'trend', '🚀': 'rocket', '💬': 'chat', '🚫': 'ban', '📞': 'phone', '☎': 'phone', '⏰': 'clock',
  };
  const NAV = { dashboard: 'grid', team: 'users', tasks: 'columns', ptm: 'handshake', studentreport: 'file', reports: 'mail', schedule: 'clock', settings: 'sliders' };
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
  let busy = false;
  const run = () => {
    if (busy) return;
    busy = true;
    nav();
    for (const sel of ['#view', '#modalCard', '#toasts']) { const el = document.querySelector(sel); if (el) swap(el); }
    busy = false;
  };
  new MutationObserver(() => requestAnimationFrame(run)).observe(document.body, { childList: true, subtree: true });
  run();
})();
