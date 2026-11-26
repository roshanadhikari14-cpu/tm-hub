// The loading ring: a red circle that fills with a percentage and a line of what is going on. The true progress of a
// request is not known, so the number climbs quickly at first and waits below 100 until the page arrives.
(function () {
  const LINES = ['Fetching the latest from Lighthouse', 'Lining up your students', 'Counting the PTMs', 'Sharpening the pencils', 'Checking the calendar', 'Almost there, tidying the tables'];
  const R = 44;
  const C = 2 * Math.PI * R;

  window.loader = (opts = {}) =>
    `<div class="ld-wrap${opts.small ? ' sm' : ''}" data-t0="${Date.now()}" role="status" aria-label="Loading">
      <div class="ld-ring"><svg viewBox="0 0 100 100"><circle class="ld-track" cx="50" cy="50" r="${R}"/><circle class="ld-bar" cx="50" cy="50" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><b><span class="ld-n">0</span><i>%</i></b></div>
      <p class="ld-msg">${opts.text || LINES[0]}</p></div>`;

  function tick() {
    for (const el of document.querySelectorAll('.ld-wrap')) {
      const s = (Date.now() - Number(el.dataset.t0)) / 1000;
      const pct = Math.min(99, Math.round(100 * (1 - Math.exp(-s / 2.2))));
      el.querySelector('.ld-n').textContent = pct;
      el.querySelector('.ld-bar').style.strokeDashoffset = C * (1 - pct / 100);
      if (s > 2.5) el.querySelector('.ld-msg').textContent = LINES[Math.floor(s / 2.5) % LINES.length];
    }
  }
  setInterval(tick, 120);

  // a ring over the whole window, for actions that take a while (Refresh)
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
