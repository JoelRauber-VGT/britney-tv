/* ════════════════════════════════════════════════════════════════
 * BRITNEY DASHBOARD · WETTER + UHR (Kacheln oben, bei CONFIG.weather.show)
 *
 * Wetter von Open-Meteo (gratis, ohne Key):
 *  - Jetzt: Linien-Icon, Temperatur, Beschreibung, gefühlt/Wind
 *  - Nächste 24 h: Temperaturkurve + Regenwahrscheinlichkeit
 *  - Nächste 5 Tage: Icon + Max/Min
 * Uhr-Kachel: Zeit, Datum, Kalenderwoche.
 *
 * Bewegung über die Web Animations API (CSS-Animationen sind global aus).
 * Netzfehler → letzte Daten bleiben stehen (auch über Reloads, localStorage).
 * ════════════════════════════════════════════════════════════════ */

(() => {
  const W = CONFIG.weather;
  if (!W || !W.show || document.documentElement.dataset.mode !== 'weather') return;

  const $ = (id) => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const CACHE_KEY = 'britney-weather';
  const TZ = 'Europe/Zurich';

  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${W.lat}&longitude=${W.lon}`
    + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day'
    + '&hourly=temperature_2m,precipitation_probability'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + `&timezone=${encodeURIComponent(TZ)}&forecast_days=7`;

  /* ── WMO-Code → Icon-Art + Text ── */
  function kindOf(code) {
    if (code === 0 || code === 1) return 'clear';
    if (code === 2) return 'partly';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'thunder';
    return 'cloud';
  }
  const TEXT = {
    0: 'Sonnig', 1: 'Überwiegend sonnig', 2: 'Teilweise bewölkt', 3: 'Bedeckt',
    45: 'Nebel', 48: 'Nebel mit Reif', 51: 'Leichter Niesel', 53: 'Niesel', 55: 'Starker Niesel',
    56: 'Gefrierender Niesel', 57: 'Gefrierender Niesel', 61: 'Leichter Regen', 63: 'Regen',
    65: 'Starker Regen', 66: 'Gefrierender Regen', 67: 'Gefrierender Regen',
    71: 'Leichter Schneefall', 73: 'Schneefall', 75: 'Starker Schneefall', 77: 'Schneegriesel',
    80: 'Regenschauer', 81: 'Regenschauer', 82: 'Heftige Schauer', 85: 'Schneeschauer',
    86: 'Starke Schneeschauer', 95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Gewitter mit Hagel',
  };

  /* ── Linien-Icons (ein Strich, currentColor; Akzent nur für Sonne/Regen) ── */
  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const CLOUD = 'M29 76h43a17 17 0 0 0 1-34 23 23 0 0 0-44 5 15 15 0 0 0 0 29z';
  const SUN_C = 'var(--wx-sun)', RAIN_C = 'var(--wx-rain)';

  function icon(code, isDay, animate) {
    const svg = el('svg', { viewBox: '0 0 100 100', class: 'wx-ico', fill: 'none', stroke: 'currentColor',
      'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    const k = kindOf(code);
    const day = isDay !== 0;
    const anim = animate && !reduced;

    const sun = (cx, cy, r) => {
      const g = el('g', { stroke: SUN_C }, svg);
      el('circle', { cx, cy, r }, g);
      const rays = el('g', {}, g);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        el('line', { x1: cx + Math.cos(a) * r * 1.55, y1: cy + Math.sin(a) * r * 1.55,
          x2: cx + Math.cos(a) * r * 2, y2: cy + Math.sin(a) * r * 2 }, rays);
      }
      if (anim) {
        rays.style.transformOrigin = `${cx}px ${cy}px`;
        rays.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(45deg)' }],
          { duration: 12000, iterations: Infinity });
      }
    };
    const moon = (cx, cy, r) => el('path', {
      d: `M${cx + r * 0.3} ${cy - r}a${r} ${r} 0 1 0 ${r * 0.7} ${r * 1.55}a${r * 0.8} ${r * 0.8} 0 0 1-${r * 0.7}-${r * 1.55}z`,
      stroke: SUN_C }, svg);

    if (k === 'clear') { day ? sun(50, 50, 16) : moon(46, 50, 26); return svg; }
    if (k === 'partly') {
      day ? sun(36, 34, 11) : moon(34, 32, 16);
      el('path', { d: CLOUD, transform: 'translate(8 6) scale(.92)' }, svg);
      return svg;
    }
    el('path', { d: CLOUD, transform: k === 'cloud' ? '' : 'translate(0 -10)' }, svg);
    if (k === 'cloud') return svg;

    const fall = (node, i, dy, dur) => {
      if (!anim) return;
      node.animate([
        { transform: 'translateY(-4px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1, offset: 0.2 },
        { transform: `translateY(${dy}px)`, opacity: 0 },
      ], { duration: dur, delay: i * (dur / 3), iterations: Infinity });
    };
    if (k === 'rain' || k === 'drizzle' || k === 'thunder') {
      const xs = k === 'thunder' ? [36, 66] : [36, 51, 66];
      xs.forEach((x, i) => {
        const l = el('line', { x1: x, y1: 74, x2: x - 4, y2: k === 'drizzle' ? 80 : 86, stroke: RAIN_C }, svg);
        fall(l, i, 10, 1100);
      });
    }
    if (k === 'snow') {
      [36, 51, 66].forEach((x, i) => {
        const c = el('circle', { cx: x, cy: 80, r: 2.5, fill: 'currentColor', stroke: 'none' }, svg);
        fall(c, i, 12, 2400);
      });
    }
    if (k === 'thunder') {
      const b = el('path', { d: 'M54 66 46 80h10l-6 12', stroke: SUN_C }, svg);
      if (anim) b.animate([{ opacity: 0.25 }, { opacity: 0.25, offset: 0.8 }, { opacity: 1, offset: 0.83 },
        { opacity: 0.3, offset: 0.88 }, { opacity: 1, offset: 0.92 }, { opacity: 0.25 }],
        { duration: 4000, iterations: Infinity });
    }
    if (k === 'fog') {
      [72, 82].forEach((y, i) => {
        const l = el('line', { x1: 24 + i * 8, y1: y, x2: 76 - i * 4, y2: y }, svg);
        if (anim) l.animate([{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' },
          { transform: 'translateX(-3px)' }], { duration: 4000 + i * 1200, iterations: Infinity });
      });
    }
    return svg;
  }

  /* ── Formatierung ── */
  const fmtTime = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  const fmtDate = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  const fmtDay  = new Intl.DateTimeFormat('de-CH', { weekday: 'short', timeZone: TZ });
  const deg = (t) => `${Math.round(t)}°`;

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86_400_000 + 1) / 7);
  }

  /* ── Uhr ── */
  function tickClock() {
    const now = new Date();
    $('wxClock').textContent = fmtTime.format(now);
    $('wxDate').textContent = fmtDate.format(now);
    $('wxWeek').textContent = `KW ${isoWeek(now)}`;
  }
  $('wxCity').textContent = W.city;
  tickClock();
  setInterval(tickClock, 5000);

  /* ── Rendern ── */
  let lastKey = '';
  function render(d, animateIn) {
    const cur = d.current;
    const key = `${cur.weather_code}-${cur.is_day}`;
    if (key !== lastKey) {
      $('wxIcon').replaceChildren(icon(cur.weather_code, cur.is_day, true));
      lastKey = key;
    }
    $('wxTemp').textContent = deg(cur.temperature_2m);
    $('wxDesc').textContent = TEXT[cur.weather_code] || '';
    $('wxFacts').innerHTML =
      `Gefühlt <b>${deg(cur.apparent_temperature)}</b> · Wind <b>${Math.round(cur.wind_speed_10m)} km/h</b>`;
    renderDays(d, animateIn);
    renderHours(d, animateIn);
  }

  /* Nächste 24 h: glatte Kurve (Catmull-Rom → Bézier) + Regenbalken */
  function renderHours(d, animateIn) {
    const box = $('wxHours');
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const nowIso = d.current.time.slice(0, 13);
    let start = d.hourly.time.findIndex((t) => t.slice(0, 13) === nowIso);
    if (start < 0) start = 0;
    const T = d.hourly.temperature_2m.slice(start, start + 25);
    const P = d.hourly.precipitation_probability.slice(start, start + 25);
    const H = d.hourly.time.slice(start, start + 25);
    if (T.length < 2) return;

    const fs = parseFloat(getComputedStyle(box).fontSize) || 14;
    const padX = fs * 1.2, top = fs * 1.9, bottom = h * 0.58, rainTop = h * 0.66, rainH = h * 0.16;
    const lo = Math.min(...T), hi = Math.max(...T);
    const span = Math.max(hi - lo, 4);
    const mid = (hi + lo) / 2;
    const X = (i) => padX + (i * (w - 2 * padX)) / (T.length - 1);
    const Y = (t) => bottom - ((t - (mid - span / 2)) / span) * (bottom - top);
    const pts = T.map((t, i) => [X(i), Y(t)]);

    let path = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      path += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6},`
        + `${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6},${p2[0]} ${p2[1]}`;
    }

    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'wx-chart' });
    const defs = el('defs', {}, svg);
    const ga = el('linearGradient', { id: 'wxArea', x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': 'var(--wx-line)', 'stop-opacity': 0.22 }, ga);
    el('stop', { offset: 1, 'stop-color': 'var(--wx-line)', 'stop-opacity': 0 }, ga);

    const bw = ((w - 2 * padX) / (T.length - 1)) * 0.4;
    const rain = el('g', { fill: 'var(--wx-rain)' }, svg);
    P.forEach((p, i) => {
      const bh = Math.max((p / 100) * rainH, 1.5);
      el('rect', { x: X(i) - bw / 2, y: rainTop + rainH - bh, width: bw, height: bh, rx: 1.5,
        opacity: p ? 0.35 + (p / 100) * 0.55 : 0.15 }, rain);
    });

    const area = el('path', { d: `${path} L${X(T.length - 1)} ${rainTop - fs * 0.4} L${X(0)} ${rainTop - fs * 0.4} Z`,
      fill: 'url(#wxArea)' }, svg);
    const line = el('path', { d: path, fill: 'none', stroke: 'var(--wx-line)', 'stroke-width': fs * 0.2,
      'stroke-linecap': 'round' }, svg);

    const labels = el('g', {}, svg);
    const step = w < 520 ? 6 : 3;            /* schmale Kachel → weniger Beschriftung */
    for (let i = 0; i < T.length; i += step) {
      el('circle', { cx: X(i), cy: Y(T[i]), r: fs * 0.22, fill: i === 0 ? 'var(--wx-line)' : 'var(--color-card)',
        stroke: 'var(--wx-line)', 'stroke-width': fs * 0.14 }, labels);
      const tt = el('text', { x: X(i), y: Y(T[i]) - fs * 0.7, 'text-anchor': 'middle', class: 'wx-chart__t' }, labels);
      tt.textContent = deg(T[i]);
      const hh = el('text', { x: X(i), y: h - fs * 0.1, 'text-anchor': 'middle', class: 'wx-chart__h' }, labels);
      hh.textContent = i === 0 ? 'Jetzt' : `${H[i].slice(11, 13)} h`;
    }

    box.replaceChildren(svg);

    if (animateIn && !reduced) {
      const len = line.getTotalLength();
      line.style.strokeDasharray = len;
      line.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        { duration: 1600, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards', delay: 200 });
      area.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 900, fill: 'backwards' });
      labels.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 1100, fill: 'backwards' });
      rain.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 800, fill: 'backwards' });
    }
  }

  /* Nächste 5 Tage (ab morgen): Tag · Icon · Max/Min · Regen ab 30 % */
  function renderDays(d, animateIn) {
    const box = $('wxDays');
    const dl = d.daily;
    box.replaceChildren();
    for (let i = 1; i <= 5 && i < dl.time.length; i++) {
      const col = document.createElement('div');
      col.className = 'wx-day';
      const name = fmtDay.format(new Date(`${dl.time[i]}T12:00:00`)).replace('.', '');
      const rain = dl.precipitation_probability_max[i] ?? 0;
      col.innerHTML = `<p class="wx-day__name">${name}</p><div class="wx-day__icon"></div>
        <p class="wx-day__temp"><b>${deg(dl.temperature_2m_max[i])}</b> ${deg(dl.temperature_2m_min[i])}</p>
        <p class="wx-day__rain">${rain >= 30 ? `${rain} %` : '&nbsp;'}</p>`;
      col.querySelector('.wx-day__icon').appendChild(icon(dl.weather_code[i], 1, false));
      box.appendChild(col);
      if (animateIn && !reduced) col.animate(
        [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 600, delay: 300 + i * 80, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
    }
  }

  /* ── Laden ── */
  let data = null;
  try { data = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (_) {}
  let first = true;
  if (data && data.current) { render(data, true); first = false; }

  async function load() {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const d = await res.json();
      if (!d.current || !d.daily || !d.hourly) throw new Error('unvollständig');
      data = d;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch (_) {}
      render(d, first);
      first = false;
    } catch (e) {
      if (CONFIG.debug) console.warn('[weather]', e);
    }
  }
  load();
  setInterval(load, (W.refreshMinutes || 15) * 60_000);
  /* Kurve neu zeichnen, sobald die Kachel ihre endgültige Grösse hat */
  let lastSize = '';
  new ResizeObserver(() => {
    const b = $('wxHours');
    const size = `${b.clientWidth}x${b.clientHeight}`;
    if (data && size !== lastSize) { lastSize = size; renderHours(data, false); }
  }).observe($('wxHours'));


  /* ── Halloween in den Seitenrändern (weather.halloween: 'auto' | true | false) ── */
  const hwOn = W.halloween === true || (W.halloween === 'auto' && new Date().getMonth() === 9);
  if (hwOn) {
    const WEB = (side) => `<svg class="hw__web %s" viewBox="0 0 100 100"><g fill="none" stroke="oklch(94% 0.01 280 / 0.45)" stroke-linecap="round" vector-effect="non-scaling-stroke"><path d="M84.0 0.0L66.0 58.0L0.0 80.0" stroke-width="1.2"/><path d="M34.0 30.0L72.3 37.8 M34.0 30.0L66.5 56.4 M34.0 30.0L48.5 63.8 M34.0 30.0L30.8 69.7 M34.0 30.0L3.1 79.0 M34.0 30.0L0.0 49.7 M34.0 30.0L0.0 31.4 M34.0 30.0L0.0 13.9 M34.0 30.0L11.4 0.0 M34.0 30.0L29.1 0.0 M34.0 30.0L44.0 0.0 M34.0 30.0L65.1 0.0 M34.0 30.0L78.7 17.0" stroke-width="0.9"/><path d="M39.4 31.1Q38.5 32.2 38.5 33.7Q37.0 33.8 36.0 34.7Q34.7 34.6 33.6 35.6Q31.9 35.6 29.7 36.9Q29.9 34.3 29.2 32.8Q29.7 31.3 29.2 30.2Q29.7 29.1 29.2 27.7Q30.4 27.1 30.8 25.8Q32.3 26.2 33.3 25.8Q34.3 26.2 35.4 25.8Q36.6 26.2 38.4 25.8Q38.8 27.3 40.3 28.2Q39.2 29.7 39.4 31.1 M44.0 32.0Q42.3 34.0 42.4 36.9Q39.5 37.1 37.8 38.8Q35.3 38.6 33.2 40.3Q30.0 40.4 26.0 42.7Q26.4 38.0 25.2 35.1Q26.0 32.5 25.2 30.4Q26.0 28.3 25.2 25.8Q27.4 24.6 28.1 22.2Q30.8 23.0 32.7 22.2Q34.6 23.0 36.6 22.2Q38.8 23.0 42.1 22.2Q42.9 25.0 45.6 26.6Q43.7 29.4 44.0 32.0 M48.5 32.9Q46.1 35.8 46.3 40.0Q42.0 40.3 39.5 42.9Q35.9 42.6 32.8 45.1Q28.2 45.2 22.3 48.6Q22.9 41.7 21.1 37.5Q22.4 33.6 21.1 30.5Q22.4 27.5 21.1 23.9Q24.3 22.1 25.4 18.6Q29.3 19.7 32.1 18.6Q34.9 19.7 37.8 18.6Q41.0 19.7 45.8 18.6Q47.0 22.6 51.0 25.1Q48.2 29.1 48.5 32.9 M53.1 33.9Q49.9 37.7 50.2 43.2Q44.6 43.6 41.2 46.9Q36.5 46.6 32.4 49.9Q26.3 50.0 18.6 54.5Q19.4 45.4 17.0 39.8Q18.7 34.7 17.0 30.7Q18.7 26.7 17.0 22.0Q21.3 19.6 22.7 15.0Q27.8 16.5 31.5 15.0Q35.1 16.5 39.0 15.0Q43.3 16.5 49.6 15.0Q51.1 20.3 56.4 23.5Q52.7 28.8 53.1 33.9 M57.7 34.8Q53.7 39.5 54.1 46.4Q47.1 46.8 43.0 51.0Q37.2 50.5 32.0 54.6Q24.5 54.7 14.9 60.4Q15.9 49.2 12.9 42.2Q15.0 35.9 12.9 30.9Q15.0 25.9 12.9 20.0Q18.2 17.1 20.0 11.4Q26.3 13.3 31.0 11.4Q35.4 13.3 40.2 11.4Q45.5 13.3 53.3 11.4Q55.2 18.0 61.7 21.9Q57.2 28.5 57.7 34.8 M62.3 35.7Q57.6 41.4 58.0 49.6Q49.6 50.1 44.7 55.0Q37.8 54.5 31.7 59.4Q22.7 59.5 11.2 66.2Q12.4 52.9 8.8 44.6Q11.4 37.0 8.8 31.0Q11.4 25.1 8.8 18.1Q15.1 14.7 17.3 7.8Q24.8 10.0 30.4 7.8Q35.7 10.0 41.4 7.8Q47.7 10.0 57.0 7.8Q59.3 15.7 67.1 20.4Q61.6 28.2 62.3 35.7 M66.9 36.7Q61.4 43.2 61.9 52.7Q52.2 53.3 46.4 59.1Q38.4 58.5 31.3 64.2Q20.8 64.3 7.5 72.1Q8.9 56.6 4.8 46.9Q7.7 38.2 4.8 31.2Q7.7 24.3 4.8 16.2Q12.1 12.2 14.6 4.2Q23.3 6.8 29.8 4.2Q36.0 6.8 42.6 4.2Q49.9 6.8 60.8 4.2Q63.4 13.3 72.5 18.8Q66.1 28.0 66.9 36.7 M70.8 37.4Q64.6 44.8 65.2 55.4Q54.3 56.0 47.9 62.5Q38.9 61.8 31.0 68.1Q19.3 68.3 4.4 77.0Q6.0 59.7 1.4 48.9Q4.6 39.1 1.4 31.4Q4.6 23.7 1.4 14.6Q9.5 10.1 12.3 1.2Q22.1 4.1 29.3 1.2Q36.2 4.1 43.6 1.2Q51.8 4.1 63.9 1.2Q66.8 11.4 76.9 17.5Q69.9 27.7 70.8 37.4" stroke-width="0.7"/></g></svg>`.replace('%s', `hw__web--${side}`);
    const WING = '<path d="M63 27C72 14 92 8 117 13c-6 4-8 10-6 17-5-3-11-3-15 2-3-5-9-6-13-1-3-4-9-5-13 0-3-3-6-3-8-2z"/>';
    const BAT = `<svg class="hw__bat" viewBox="0 0 120 64"><g fill="oklch(12% 0.02 285)">
      <g class="hw__wing">${WING}</g><g transform="matrix(-1 0 0 1 120 0)"><g class="hw__wing">${WING}</g></g>
      <ellipse cx="60" cy="33" rx="6.5" ry="11"/><circle cx="60" cy="21" r="6"/>
      <path d="M54.5 19 55 9l4.5 7zM65.5 19 65 9l-4.5 7z"/></g>
      <circle cx="57.6" cy="20.5" r="1.1" fill="oklch(75% 0.18 30)"/><circle cx="62.4" cy="20.5" r="1.1" fill="oklch(75% 0.18 30)"/></svg>`;
    const SPIDER = (cls, len) => `<div class="hw__spider ${cls}"><span class="hw__thread" style="height:${len}"></span>
      <svg viewBox="0 0 60 50"><g stroke="oklch(14% 0.02 280)" stroke-width="2.5" fill="none" stroke-linecap="round">
      <path d="M22 22 6 10M22 26 2 24M22 30 6 40M24 33 12 48M38 22 54 10M38 26 58 24M38 30 54 40M36 33 48 48"/></g>
      <ellipse cx="30" cy="28" rx="11" ry="13" fill="oklch(14% 0.02 280)"/><circle cx="30" cy="13" r="7" fill="oklch(14% 0.02 280)"/>
      <circle cx="27" cy="12" r="1.6" fill="oklch(70% 0.2 25)"/><circle cx="33" cy="12" r="1.6" fill="oklch(70% 0.2 25)"/></svg></div>`;
    const PUMPKIN = (cls) => `<svg class="hw__pumpkin ${cls}" viewBox="0 0 120 104">
      <path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(45% 0.09 130)"/>
      <ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.17 50)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.17 50)"/>
      <ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.18 55)"/>
      <g class="hw__face" fill="oklch(90% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/>
      <path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></svg>`;

    /* Kürbisfeld: drei Reihen, hinten klein/dunkel, vorne gross, einige mit Gesicht */
    const FIELD = `<svg class="hw__field" viewBox="0 0 1000 150" preserveAspectRatio="xMidYMax slice"><g transform="translate(11.0 60.7) scale(0.269 0.256)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 45)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 45)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 56)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(89.3 59.6) scale(0.274 0.255)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 52)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 52)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 52)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(176.2 53.6) scale(0.343 0.323)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 54)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 54)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 51)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(290.5 58.3) scale(0.269 0.261)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 52)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 52)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 53)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(362.6 58.2) scale(0.263 0.279)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 45)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 45)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 53)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(448.0 57.6) scale(0.297 0.274)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 47)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 47)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 59)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(528.2 54.6) scale(0.363 0.294)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 51)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 51)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 54)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(628.5 55.2) scale(0.275 0.282)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 49)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 49)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 51)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(697.1 57.2) scale(0.304 0.294)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 51)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 51)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 57)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(774.4 53.6) scale(0.343 0.315)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 51)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 51)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 52)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(863.4 53.3) scale(0.334 0.326)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 48)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 48)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 58)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(923.6 59.0) scale(0.248 0.263)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 52)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 52)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 52)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(19.3 82.2) scale(0.420 0.376)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 53)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 53)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 59)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(136.9 74.6) scale(0.521 0.421)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 54)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 54)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 53)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(206.9 76.9) scale(0.449 0.397)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 47)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 47)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 51)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(315.0 72.9) scale(0.516 0.442)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 49)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 49)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 57)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(422.8 66.7) scale(0.600 0.486)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 52)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 52)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 55)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(519.4 70.6) scale(0.426 0.451)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 46)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 46)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 53)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(90% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(621.0 79.3) scale(0.350 0.365)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 48)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 48)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 51)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(744.6 80.0) scale(0.403 0.385)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 48)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 48)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 52)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(843.0 77.4) scale(0.407 0.428)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 45)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 45)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 54)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(909.0 80.9) scale(0.488 0.387)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 49)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 49)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 52)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(90% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><path d="M0 126 C120 116 200 136 320 126 S520 116 640 126 S860 136 1000 126" fill="none" stroke="oklch(40% 0.08 140)" stroke-width="2.4"/><path d="M70 126c-11-13-2-24 11-22 4 11-2 20-11 22z" fill="oklch(38% 0.08 140)"/><path d="M240 126c-11-13-2-24 11-22 4 11-2 20-11 22z" fill="oklch(38% 0.08 140)"/><path d="M430 126c-11-13-2-24 11-22 4 11-2 20-11 22z" fill="oklch(38% 0.08 140)"/><path d="M600 126c-11-13-2-24 11-22 4 11-2 20-11 22z" fill="oklch(38% 0.08 140)"/><path d="M770 126c-11-13-2-24 11-22 4 11-2 20-11 22z" fill="oklch(38% 0.08 140)"/><path d="M930 126c-11-13-2-24 11-22 4 11-2 20-11 22z" fill="oklch(38% 0.08 140)"/><g transform="translate(-16.0 73.1) scale(0.894 0.765)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 47)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 47)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 55)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(148.7 84.1) scale(0.696 0.670)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 46)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 46)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 59)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(340.0 78.5) scale(0.863 0.728)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 46)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 46)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 56)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(455.4 91.5) scale(0.571 0.564)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 51)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 51)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 61)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(90% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(590.7 74.9) scale(0.806 0.767)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 46)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 46)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 53)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(713.5 79.3) scale(0.842 0.690)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 49)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 49)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 58)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(899.7 77.9) scale(0.837 0.697)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 52)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 52)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 56)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g></svg>`;
    const hw = document.createElement('div');
    hw.className = 'hw';
    hw.setAttribute('aria-hidden', 'true');
    hw.innerHTML = WEB('l') + WEB('r') + SPIDER('', '24vh') + SPIDER('hw__spider--r', '52vh')
      + FIELD + BAT + BAT;
    document.body.appendChild(hw);
    document.documentElement.dataset.halloween = 'on';   /* News rückt hoch → Platz für den Kürbis */

    if (!reduced) {
      hw.querySelectorAll('.hw__spider').forEach((sp, i) => sp.animate(
        [{ transform: 'translateY(0)' }, { transform: `translateY(${i ? 4 : 6}vh)` },
         { transform: `translateY(${i ? 3.5 : 5}vh)` }, { transform: 'translateY(0)' }],
        { duration: 10000 + i * 3000, delay: -i * 4000, iterations: Infinity, easing: 'ease-in-out' }));
      hw.querySelectorAll('.hw__face').forEach((f, i) => f.animate(
        [{ opacity: 1 }, { opacity: 0.65 }, { opacity: 0.95 }, { opacity: 0.75 }, { opacity: 1 }],
        { duration: 2300 + i * 600, iterations: Infinity }));
      /* Fledermäuse: alle ~40 s ein Überflug, sonst ausserhalb des Bildes */
      hw.querySelectorAll('.hw__bat').forEach((b, i) => {
        b.style.top = i ? '45vh' : '12vh';
        b.animate([
          { transform: 'translate(-10vw, 0)' }, { transform: 'translate(40vw, -3vh)', offset: 0.12 },
          { transform: 'translate(75vw, 2vh)', offset: 0.22 }, { transform: 'translate(115vw, -2vh)', offset: 0.3 },
          { transform: 'translate(115vw, -2vh)' },
        ], { duration: 40000, delay: i * 17000, iterations: Infinity, easing: 'linear' });
        b.querySelectorAll('.hw__wing').forEach((w) => w.animate(
          [{ transform: 'rotate(18deg) scaleY(0.9)' }, { transform: 'rotate(-28deg)' }, { transform: 'rotate(18deg) scaleY(0.9)' }],
          { duration: 420 + i * 80, iterations: Infinity, easing: 'ease-in-out' }));
      });
    }
  }

  /* Kacheln blenden beim Start nacheinander ein */
  if (!reduced) document.querySelectorAll('.bento .tile').forEach((t, i) =>
    t.animate([{ opacity: 0, transform: 'translateY(1vh)' }, { opacity: 1, transform: 'none' }],
      { duration: 700, delay: i * 110, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }));
})();
