/* ════════════════════════════════════════════════════════════════
 * BRITNEY DASHBOARD · LUFT & POLLEN (bei CONFIG.air.show)
 *
 * Luftqualität (Europäischer AQI) jetzt + nächste 24 h als Balken,
 * dazu UV-Index und die stärksten Pollen heute (Tagesmaximum).
 * Daten: Open-Meteo Air Quality (CAMS, gratis, ohne Key), Ort = CONFIG.weather.
 * Fehler → letzter Stand bleibt.
 * ════════════════════════════════════════════════════════════════ */

(() => {
  const A = CONFIG.air;
  const W = CONFIG.weather || {};
  const tile = document.getElementById('air');
  if (!tile) return;
  if (!A || !A.show || document.documentElement.dataset.mode !== 'weather') { tile.remove(); return; }

  const $ = (id) => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TZ = 'Europe/Zurich';

  const POLLEN = [
    /* Schwellen in Körnern/m³ (schwach · mässig · stark · sehr stark), angelehnt an MeteoSchweiz */
    { key: 'alder_pollen',   name: 'Erle',     steps: [1, 11, 71, 301] },
    { key: 'birch_pollen',   name: 'Birke',    steps: [1, 11, 71, 301] },
    { key: 'grass_pollen',   name: 'Gräser',   steps: [1, 20, 50, 150] },
    { key: 'mugwort_pollen', name: 'Beifuss',  steps: [1, 6, 15, 40] },
    { key: 'ragweed_pollen', name: 'Ambrosia', steps: [1, 6, 15, 40] },
  ];
  const POLLEN_TXT = ['keine', 'schwach', 'mässig', 'stark', 'sehr stark'];

  /* Europäischer AQI: 0–20 gut … >100 extrem schlecht */
  const AQI = [
    { max: 20,       txt: 'Gut',            lvl: 0 },
    { max: 40,       txt: 'Ordentlich',     lvl: 1 },
    { max: 60,       txt: 'Mässig',         lvl: 2 },
    { max: 80,       txt: 'Schlecht',       lvl: 3 },
    { max: 100,      txt: 'Sehr schlecht',  lvl: 4 },
    { max: Infinity, txt: 'Extrem schlecht', lvl: 5 },
  ];
  const aqiOf = (v) => AQI.find((a) => v <= a.max);

  const url = 'https://air-quality-api.open-meteo.com/v1/air-quality'
    + `?latitude=${W.lat}&longitude=${W.lon}`
    + '&current=european_aqi,uv_index'
    + `&hourly=european_aqi,${POLLEN.map((p) => p.key).join(',')}`
    + `&timezone=${encodeURIComponent(TZ)}&forecast_days=2`;

  let data = null;
  let built = false;

  function render(animateIn) {
    if (!data) return;
    const c = data.current, H = data.hourly;

    /* Jetzt */
    const a = aqiOf(c.european_aqi);
    $('airNow').textContent = Math.round(c.european_aqi);
    $('airLevel').textContent = a.txt;
    tile.dataset.aqi = a.lvl;

    /* Nächste 24 h ab der aktuellen Stunde */
    const nowKey = c.time.slice(0, 13);                 /* «YYYY-MM-DDTHH» in Ortszeit */
    let i0 = H.time.findIndex((t) => t.slice(0, 13) === nowKey);
    if (i0 < 0) i0 = 0;
    const next = H.european_aqi.slice(i0, i0 + 24);

    const box = $('airBars');
    if (!built) {
      box.replaceChildren();
      for (let h = 0; h < 24; h++) {
        const b = document.createElement('span');
        b.className = 'air__bar';
        box.appendChild(b);
      }
      built = true;
    }
    const hi = Math.max(60, ...next.filter((v) => v != null));
    box.querySelectorAll('.air__bar').forEach((b, h) => {
      const v = next[h];
      b.style.height = v == null ? '0' : `${Math.max((v / hi) * 100, 4)}%`;
      b.dataset.aqi = v == null ? '' : aqiOf(v).lvl;
      b.classList.toggle('is-now', h === 0);
      if (animateIn && !reduced) b.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
        { duration: 700, delay: 200 + h * 30, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
    });
    const hh = (k) => `${H.time[k]?.slice(11, 13) ?? '--'} h`;
    $('airAxis').innerHTML = `<span>jetzt</span><span>${hh(i0 + 12)}</span><span>${hh(i0 + 23)}</span>`;

    /* Pollen heute: Maximum über den Kalendertag */
    const today = c.time.slice(0, 10);
    const idx = H.time.map((t, k) => (t.startsWith(today) ? k : -1)).filter((k) => k >= 0);
    const rows = POLLEN.map((p) => {
      const vals = idx.map((k) => H[p.key]?.[k]).filter((v) => v != null);
      const max = vals.length ? Math.max(...vals) : 0;
      return { ...p, max, lvl: p.steps.filter((s) => max >= s).length };   /* lvl 0 … 4 */
    }).filter((r) => r.lvl > 0)
      .sort((a, b) => b.lvl - a.lvl || b.max - a.max)
      .slice(0, 3);                                         /* Platz für max. 3 Zeilen */
    $('airPollen').innerHTML = rows.length
      ? rows.map((r) => {
          return `<li class="pollen" data-lvl="${r.lvl}"><span class="pollen__name">${r.name}</span>`
            + `<span class="pollen__txt"><i></i>${POLLEN_TXT[r.lvl]}</span></li>`;
        }).join('')
      : '<li class="pollen pollen--none">Keine · Saisonpause</li>';

    $('airUv').textContent = c.uv_index == null ? '–' : (Math.round(c.uv_index * 10) / 10).toString();
  }

  async function load() {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const d = await res.json();
      if (!d.current || !d.hourly) throw new Error('unvollständig');
      const firstTime = !data;
      data = d;
      render(firstTime);
    } catch (e) {
      if (CONFIG.debug) console.warn('[air]', e);
    }
  }
  load();
  setInterval(load, (A.refreshMinutes || 30) * 60_000);
})();
