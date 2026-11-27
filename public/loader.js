// The loading screen: the lighthouse in a round porthole with its beam turning, a ring spinning around it and a
// light-hearted line that changes while you wait. The true progress of a request is not known, so the number climbs
// quickly at first and waits below 100 until the page arrives.
(function () {
  const LINES = [
    'Polishing the lighthouse lamp…',
    'Asking the seagulls where the data went…',
    'Rowing your students ashore…',
    'Bribing the server with chai…',
    'Counting PTMs on our fingers…',
    'Waking up the lighthouse keeper…',
    'Teaching the spreadsheet to swim…',
    'Untangling the fishing nets (and the numbers)…',
    'Shouting “ahoy!” at Lighthouse…',
    'Sharpening every pencil in the building…',
    'Checking homework the server forgot to do…',
    'Almost ashore, hold your chai…',
  ];
  const SCENE =
    '<svg viewBox="0 0 120 220" aria-hidden="true"><defs><linearGradient id="ldg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d2"/><stop offset="1" stop-color="#f5b83c"/></linearGradient></defs>' +
    '<path d="M6 220 Q18 198 38 194 L82 194 Q102 198 114 220Z" fill="#0a1224"/>' +
    '<polygon points="42,196 78,196 70,70 50,70" fill="#e9edf7"/>' +
    '<polygon points="48.2,98 71.8,98 73.1,118 46.9,118" fill="#1d2a5c"/><polygon points="45.2,146 74.8,146 76.1,166 43.9,166" fill="#1d2a5c"/>' +
    '<rect x="57" y="124" width="6" height="11" rx="3" fill="#f5c76a"/><rect x="57" y="174" width="6" height="11" rx="3" fill="#f5c76a"/><rect x="57" y="78" width="6" height="11" rx="3" fill="#f5c76a"/>' +
    '<rect x="43" y="63" width="34" height="7" rx="1.5" fill="#1b2342"/><path d="M45 63v-6M52 63v-6M60 63v-6M68 63v-6M75 63v-6" stroke="#1b2342" stroke-width="1.4"/>' +
    '<rect class="ld-lamp" x="50" y="40" width="20" height="22" rx="2" fill="url(#ldg)"/><path d="M47 41 Q60 20 73 41Z" fill="#1b2342"/><path d="M60 22V12" stroke="#1b2342" stroke-width="2"/></svg>';
  const pick = () => Math.floor(Math.random() * LINES.length);

  window.loader = (opts = {}) => {
    const first = pick();
    return `<div class="ld-wrap${opts.small ? ' sm' : ''}" data-t0="${Date.now()}" data-first="${first}" role="status" aria-label="Loading">
      <div class="ld-lh"><i class="ld-spin"></i><div class="ld-sea"><i class="ld-beam"></i>${SCENE}<i class="ld-wave"></i></div></div>
      <b class="ld-pct"><span class="ld-n">0</span>%</b>
      <p class="ld-msg">${opts.text || LINES[first]}</p></div>`;
  };

  function tick() {
    for (const el of document.querySelectorAll('.ld-wrap')) {
      const s = (Date.now() - Number(el.dataset.t0)) / 1000;
      el.querySelector('.ld-n').textContent = Math.min(99, Math.round(100 * (1 - Math.exp(-s / 2.2))));
      if (s > 2.2) {
        const line = LINES[(Number(el.dataset.first) + Math.floor(s / 2.2)) % LINES.length];
        const msg = el.querySelector('.ld-msg');
        if (msg.textContent !== line) msg.textContent = line;
      }
    }
  }
  setInterval(tick, 120);

  // over the whole window, for actions that take a while (Refresh)
  window.loaderShow = (text) => {
    window.loaderHide();
    const d = document.createElement('div');
    d.id = 'ldOver';
    d.innerHTML = window.loader({ text });
    document.body.appendChild(d);
  };
  window.loaderHide = () => {
    const d = document.getElementById('ldOver');
    if (d) d.remove();
  };
})();
