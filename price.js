/* ════════════════════════════════════════════════════════════════
 * BRITNEY DASHBOARD · STROMPREIS-KACHEL (bei CONFIG.price.show)
 *
 * Day-Ahead-Börsenpreis (€/MWh) für heute als 24 Stundenbalken, die
 * aktuelle Stunde hervorgehoben. Daten: serve.py → /api/price
 * (energy-charts.info, CC BY 4.0). Fehler → letzter Stand bleibt.
 * ════════════════════════════════════════════════════════════════ */

(() => {
  const P = CONFIG.price;
  const tile = document.getElementById('price');
  if (!tile) return;
  if (!P || !P.show || document.documentElement.dataset.mode !== 'weather') { tile.remove(); return; }

  const $ = (id) => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TZ = 'Europe/Zurich';
  const hourOf = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: TZ }); /* nur die Zahl, kein «Uhr» */
  const dayOf  = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });   /* YYYY-MM-DD */
  const r0 = (v) => Math.round(v).toString();

  let data = null;
  let built = false;

  function render(animateIn) {
    if (!data) return;
    const now = new Date();
    const today = dayOf.format(now);
    const tomorrow = dayOf.format(new Date(now.getTime() + 86_400_000));

    /* Stundenwerte nach Kalendertag gruppieren (Zone kann 15-min-Werte liefern → mitteln) */
    const days = {};
    data.unix_seconds.forEach((s, i) => {
      const t = new Date(s * 1000);
      const d = dayOf.format(t), h = +hourOf.format(t);
      if (data.price[i] == null) return;
      ((days[d] ||= {})[h] ||= []).push(data.price[i]);
    });
    const hours = (d) => Array.from({ length: 24 }, (_, h) => {
      const v = days[d] && days[d][h];
      return v ? v.reduce((a, b) => a + b, 0) / v.length : null;
    });
    const T = hours(today);
    const vals = T.filter((v) => v != null);
    if (!vals.length) return;

    const hNow = +hourOf.format(now);
    const cur = T[hNow] ?? vals[vals.length - 1];
    $('priceNow').textContent = r0(cur);
    $('priceHour').textContent = `jetzt ${String(hNow).padStart(2, '0')}–${String((hNow + 1) % 24).padStart(2, '0')} h`;

    const lo = Math.min(...vals), hi = Math.max(...vals);
    const loH = T.indexOf(lo), hiH = T.indexOf(hi);

    /* Balken: Höhe relativ zwischen (Tief − 15 %) und Hoch */
    const box = $('priceBars');
    if (!built) {
      box.replaceChildren();
      for (let h = 0; h < 24; h++) {
        const b = document.createElement('span');
        b.className = 'price__bar';
        box.appendChild(b);
      }
      const axis = document.createElement('div');
      axis.className = 'price__axis';
      axis.innerHTML = '<span>0</span><span>6</span><span>12</span><span>18</span><span>24 h</span>';
      box.appendChild(axis);
      built = true;
    }
    const base = lo - (hi - lo) * 0.25;
    box.querySelectorAll('.price__bar').forEach((b, h) => {
      const v = T[h];
      b.style.height = v == null ? '0' : `${Math.max(((v - base) / (hi - base || 1)) * 100, 4)}%`;
      b.classList.toggle('is-now', h === hNow);
      b.classList.toggle('is-past', h < hNow);
      b.classList.toggle('is-low', h === loH);
      if (animateIn && !reduced) b.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
        { duration: 700, delay: 200 + h * 30, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
    });

    /* Fusszeile: günstigste/teuerste Stunde + morgen (falls schon publiziert) */
    const tm = hours(tomorrow).filter((v) => v != null);
    const avgTm = tm.length >= 20 ? tm.reduce((a, b) => a + b, 0) / tm.length : null;
    const hh = (h) => `${String(h).padStart(2, '0')} h`;
    $('priceFoot').innerHTML =
      `<span>Tief <b>${r0(lo)}</b> ${hh(loH)}</span><span>Hoch <b>${r0(hi)}</b> ${hh(hiH)}</span>`
      + (avgTm != null ? `<span>Morgen Ø <b>${r0(avgTm)}</b></span>` : '');
  }

  async function load() {
    try {
      const res = await fetch(`/api/price?zone=${encodeURIComponent(P.zone || 'CH')}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const d = await res.json();
      if (!d.unix_seconds || !d.price) throw new Error('unvollständig');
      const firstTime = !data;
      data = d;
      render(firstTime);
    } catch (e) {
      if (CONFIG.debug) console.warn('[price]', e);
    }
  }
  load();
  setInterval(load, (P.refreshMinutes || 30) * 60_000);
  setInterval(() => render(false), 60_000);   /* aktuelle Stunde nachführen */
})();
