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
    /* Zwei verschiedene Netze: links dicht und regelmässig, rechts lockerer mit Rissen */
    const WEB_L = `<svg class="hw__web hw__web--l" viewBox="0 0 100 100"><g fill="none" stroke="oklch(94% 0.01 280 / 0.45)" stroke-linecap="round" vector-effect="non-scaling-stroke"><path d="M84.0 0.0L66.0 58.0L0.0 80.0" stroke-width="1.2"/><path d="M34.0 30.0L72.3 37.8 M34.0 30.0L66.5 56.4 M34.0 30.0L48.5 63.8 M34.0 30.0L30.8 69.7 M34.0 30.0L3.1 79.0 M34.0 30.0L0.0 49.7 M34.0 30.0L0.0 31.4 M34.0 30.0L0.0 13.9 M34.0 30.0L11.4 0.0 M34.0 30.0L29.1 0.0 M34.0 30.0L44.0 0.0 M34.0 30.0L65.1 0.0 M34.0 30.0L78.7 17.0" stroke-width="0.9"/><path d="M39.4 31.1Q38.5 32.2 38.5 33.7Q37.0 33.8 36.0 34.7Q34.7 34.6 33.6 35.6Q31.9 35.6 29.7 36.9Q29.9 34.3 29.2 32.8Q29.7 31.3 29.2 30.2Q29.7 29.1 29.2 27.7Q30.4 27.1 30.8 25.8Q32.3 26.2 33.3 25.8Q34.3 26.2 35.4 25.8Q36.6 26.2 38.4 25.8Q38.8 27.3 40.3 28.2Q39.2 29.7 39.4 31.1 M44.0 32.0Q42.3 34.0 42.4 36.9Q39.5 37.1 37.8 38.8Q35.3 38.6 33.2 40.3Q30.0 40.4 26.0 42.7Q26.4 38.0 25.2 35.1Q26.0 32.5 25.2 30.4Q26.0 28.3 25.2 25.8Q27.4 24.6 28.1 22.2Q30.8 23.0 32.7 22.2Q34.6 23.0 36.6 22.2Q38.8 23.0 42.1 22.2Q42.9 25.0 45.6 26.6Q43.7 29.4 44.0 32.0 M48.5 32.9Q46.1 35.8 46.3 40.0Q42.0 40.3 39.5 42.9Q35.9 42.6 32.8 45.1Q28.2 45.2 22.3 48.6Q22.9 41.7 21.1 37.5Q22.4 33.6 21.1 30.5Q22.4 27.5 21.1 23.9Q24.3 22.1 25.4 18.6Q29.3 19.7 32.1 18.6Q34.9 19.7 37.8 18.6Q41.0 19.7 45.8 18.6Q47.0 22.6 51.0 25.1Q48.2 29.1 48.5 32.9 M53.1 33.9Q49.9 37.7 50.2 43.2Q44.6 43.6 41.2 46.9Q36.5 46.6 32.4 49.9Q26.3 50.0 18.6 54.5Q19.4 45.4 17.0 39.8Q18.7 34.7 17.0 30.7Q18.7 26.7 17.0 22.0Q21.3 19.6 22.7 15.0Q27.8 16.5 31.5 15.0Q35.1 16.5 39.0 15.0Q43.3 16.5 49.6 15.0Q51.1 20.3 56.4 23.5Q52.7 28.8 53.1 33.9 M57.7 34.8Q53.7 39.5 54.1 46.4Q47.1 46.8 43.0 51.0Q37.2 50.5 32.0 54.6Q24.5 54.7 14.9 60.4Q15.9 49.2 12.9 42.2Q15.0 35.9 12.9 30.9Q15.0 25.9 12.9 20.0Q18.2 17.1 20.0 11.4Q26.3 13.3 31.0 11.4Q35.4 13.3 40.2 11.4Q45.5 13.3 53.3 11.4Q55.2 18.0 61.7 21.9Q57.2 28.5 57.7 34.8 M62.3 35.7Q57.6 41.4 58.0 49.6Q49.6 50.1 44.7 55.0Q37.8 54.5 31.7 59.4Q22.7 59.5 11.2 66.2Q12.4 52.9 8.8 44.6Q11.4 37.0 8.8 31.0Q11.4 25.1 8.8 18.1Q15.1 14.7 17.3 7.8Q24.8 10.0 30.4 7.8Q35.7 10.0 41.4 7.8Q47.7 10.0 57.0 7.8Q59.3 15.7 67.1 20.4Q61.6 28.2 62.3 35.7 M66.9 36.7Q61.4 43.2 61.9 52.7Q52.2 53.3 46.4 59.1Q38.4 58.5 31.3 64.2Q20.8 64.3 7.5 72.1Q8.9 56.6 4.8 46.9Q7.7 38.2 4.8 31.2Q7.7 24.3 4.8 16.2Q12.1 12.2 14.6 4.2Q23.3 6.8 29.8 4.2Q36.0 6.8 42.6 4.2Q49.9 6.8 60.8 4.2Q63.4 13.3 72.5 18.8Q66.1 28.0 66.9 36.7 M70.8 37.4Q64.6 44.8 65.2 55.4Q54.3 56.0 47.9 62.5Q38.9 61.8 31.0 68.1Q19.3 68.3 4.4 77.0Q6.0 59.7 1.4 48.9Q4.6 39.1 1.4 31.4Q4.6 23.7 1.4 14.6Q9.5 10.1 12.3 1.2Q22.1 4.1 29.3 1.2Q36.2 4.1 43.6 1.2Q51.8 4.1 63.9 1.2Q66.8 11.4 76.9 17.5Q69.9 27.7 70.8 37.4" stroke-width="0.7"/></g><g transform="translate(56 34) rotate(148) scale(2.1)"><ellipse cx="-2.6" cy="-1.2" rx="3.4" ry="1.7" transform="rotate(-28 -2.6 -1.2)" fill="oklch(95% 0.01 250 / 0.35)" stroke="oklch(95% 0.01 250 / 0.6)" stroke-width="0.25"/><ellipse cx="2.6" cy="-1.2" rx="3.4" ry="1.7" transform="rotate(28 2.6 -1.2)" fill="oklch(95% 0.01 250 / 0.35)" stroke="oklch(95% 0.01 250 / 0.6)" stroke-width="0.25"/><path d="M-1 0.5q-2.4 0.6-2.6 2.4M1 0.5q2.4 0.6 2.6 2.4M-1 1.6q-2 1.4-1.6 3M1 1.6q2 1.4 1.6 3M-0.8-0.6q-2.2-0.4-2.8 0.8M0.8-0.6q2.2-0.4 2.8 0.8" stroke="oklch(16% 0.02 280)" stroke-width="0.35" fill="none" stroke-linecap="round"/><ellipse cx="0" cy="1.2" rx="1.5" ry="2.7" fill="oklch(16% 0.02 280)"/><circle cx="0" cy="-1.9" r="1.25" fill="oklch(16% 0.02 280)"/><circle cx="-0.6" cy="-2.1" r="0.45" fill="oklch(55% 0.17 25)"/><circle cx="0.6" cy="-2.1" r="0.45" fill="oklch(55% 0.17 25)"/></g><g transform="translate(19 56) rotate(-35) scale(1.9)"><ellipse cx="-2.6" cy="-1.2" rx="3.4" ry="1.7" transform="rotate(-28 -2.6 -1.2)" fill="oklch(95% 0.01 250 / 0.35)" stroke="oklch(95% 0.01 250 / 0.6)" stroke-width="0.25"/><ellipse cx="2.6" cy="-1.2" rx="3.4" ry="1.7" transform="rotate(28 2.6 -1.2)" fill="oklch(95% 0.01 250 / 0.35)" stroke="oklch(95% 0.01 250 / 0.6)" stroke-width="0.25"/><path d="M-1 0.5q-2.4 0.6-2.6 2.4M1 0.5q2.4 0.6 2.6 2.4M-1 1.6q-2 1.4-1.6 3M1 1.6q2 1.4 1.6 3M-0.8-0.6q-2.2-0.4-2.8 0.8M0.8-0.6q2.2-0.4 2.8 0.8" stroke="oklch(16% 0.02 280)" stroke-width="0.35" fill="none" stroke-linecap="round"/><ellipse cx="0" cy="1.2" rx="1.5" ry="2.7" fill="oklch(16% 0.02 280)"/><circle cx="0" cy="-1.9" r="1.25" fill="oklch(16% 0.02 280)"/><circle cx="-0.6" cy="-2.1" r="0.45" fill="oklch(55% 0.17 25)"/><circle cx="0.6" cy="-2.1" r="0.45" fill="oklch(55% 0.17 25)"/><path d="M-2 -0.8l4 0.9M-2.1 0.6l4.2 0.8M-2 2l4 0.7M-1.6 3.2l3.2 0.6M-1.8-0.2l3.6 2.6M1.8-0.2l-3.6 2.8" stroke="oklch(96% 0.01 280 / 0.85)" stroke-width="0.35" stroke-linecap="round"/><ellipse cx="0" cy="1" rx="2.2" ry="3.6" fill="oklch(96% 0.01 280 / 0.18)"/></g></svg>`;
    const WEB_R = `<svg class="hw__web hw__web--r" viewBox="0 0 100 100"><g fill="none" stroke="oklch(94% 0.01 280 / 0.45)" stroke-linecap="round" vector-effect="non-scaling-stroke"><path d="M92.0 0.0L60.0 72.0L0.0 62.0" stroke-width="1.2"/><path d="M42.0 24.0L72.9 43.0 M42.0 24.0L61.0 69.8 M42.0 24.0L31.6 67.3 M42.0 24.0L0.0 59.9 M42.0 24.0L0.0 27.3 M42.0 24.0L2.9 0.0 M42.0 24.0L32.1 0.0 M42.0 24.0L47.8 0.0 M42.0 24.0L70.1 0.0 M42.0 24.0L82.8 20.8 M31.6 67.3q2 9 -1 16" stroke-width="0.9"/><path d="M48.2 27.8Q46.1 29.3 45.8 33.2M45.8 33.2Q42.7 31.3 39.9 32.7M39.9 32.7Q37.7 30.5 33.6 31.2M33.6 31.2Q35.1 27.2 33.6 24.7M33.6 24.7Q35.3 22.3 34.2 19.2M34.2 19.2Q38.0 20.1 40.0 19.2M40.0 19.2Q41.7 20.1 43.2 19.2M43.2 19.2Q44.8 20.1 47.6 19.2M47.6 19.2Q47.6 21.8 50.2 23.4M50.2 23.4Q47.9 25.3 48.2 27.8 M53.1 30.8Q49.4 33.6 48.8 40.5M48.8 40.5Q43.3 37.1 38.3 39.6M38.3 39.6Q34.3 35.7 26.9 36.9M26.9 36.9Q29.6 29.8 26.9 25.2M26.9 25.2Q30.0 20.9 27.9 15.4M27.9 15.4Q34.8 16.9 38.4 15.4M38.4 15.4Q41.4 16.9 44.1 15.4M52.1 15.4Q52.2 20.0 56.7 22.8M56.7 22.8Q52.6 26.3 53.1 30.8 M58.1 33.9Q52.6 37.8 51.9 47.8M51.9 47.8Q43.8 43.0 36.6 46.5M36.6 46.5Q30.8 40.9 20.2 42.6M20.2 25.7Q24.7 19.6 21.6 11.5M21.6 11.5Q31.5 13.8 36.8 11.5M36.8 11.5Q41.1 13.8 45.0 11.5M45.0 11.5Q49.2 13.8 56.6 11.5M56.6 11.5Q56.7 18.2 63.2 22.3M63.2 22.3Q57.3 27.4 58.1 33.9 M63.0 36.9Q55.9 42.1 54.9 55.2M54.9 55.2Q44.4 48.8 34.9 53.4M34.9 53.4Q27.4 46.1 13.4 48.4M15.4 7.7Q28.3 10.6 35.2 7.7M35.2 7.7Q40.8 10.6 45.9 7.7M45.9 7.7Q51.4 10.6 61.1 7.7M61.1 7.7Q61.2 16.4 69.7 21.8M69.7 21.8Q62.0 28.4 63.0 36.9 M68.0 39.9Q59.2 46.3 57.9 62.5M57.9 62.5Q45.0 54.7 33.3 60.3M33.3 60.3Q24.0 51.2 6.7 54.1M6.7 54.1Q13.1 37.5 6.7 26.8M6.7 26.8Q14.1 16.9 9.1 3.8M9.1 3.8Q25.1 7.5 33.7 3.8M46.8 3.8Q53.7 7.5 65.6 3.8M65.6 3.8Q65.7 14.6 76.2 21.3M76.2 21.3Q66.7 29.4 68.0 39.9" stroke-width="0.7"/></g><g transform="translate(34 44) rotate(205) scale(2.2)"><ellipse cx="-2.6" cy="-1.2" rx="3.4" ry="1.7" transform="rotate(-28 -2.6 -1.2)" fill="oklch(95% 0.01 250 / 0.35)" stroke="oklch(95% 0.01 250 / 0.6)" stroke-width="0.25"/><ellipse cx="2.6" cy="-1.2" rx="3.4" ry="1.7" transform="rotate(28 2.6 -1.2)" fill="oklch(95% 0.01 250 / 0.35)" stroke="oklch(95% 0.01 250 / 0.6)" stroke-width="0.25"/><path d="M-1 0.5q-2.4 0.6-2.6 2.4M1 0.5q2.4 0.6 2.6 2.4M-1 1.6q-2 1.4-1.6 3M1 1.6q2 1.4 1.6 3M-0.8-0.6q-2.2-0.4-2.8 0.8M0.8-0.6q2.2-0.4 2.8 0.8" stroke="oklch(16% 0.02 280)" stroke-width="0.35" fill="none" stroke-linecap="round"/><ellipse cx="0" cy="1.2" rx="1.5" ry="2.7" fill="oklch(16% 0.02 280)"/><circle cx="0" cy="-1.9" r="1.25" fill="oklch(16% 0.02 280)"/><circle cx="-0.6" cy="-2.1" r="0.45" fill="oklch(55% 0.17 25)"/><circle cx="0.6" cy="-2.1" r="0.45" fill="oklch(55% 0.17 25)"/></g></svg>`;
    const WING = '<path d="M63 27C72 14 92 8 117 13c-6 4-8 10-6 17-5-3-11-3-15 2-3-5-9-6-13-1-3-4-9-5-13 0-3-3-6-3-8-2z"/>';
    const BAT = `<svg class="hw__bat" viewBox="0 0 120 64"><g fill="oklch(12% 0.02 285)">
      <g class="hw__wing">${WING}</g><g transform="matrix(-1 0 0 1 120 0)"><g class="hw__wing">${WING}</g></g>
      <ellipse cx="60" cy="33" rx="6.5" ry="11"/><circle cx="60" cy="21" r="6"/>
      <path d="M54.5 19 55 9l4.5 7zM65.5 19 65 9l-4.5 7z"/></g>
      <circle cx="57.6" cy="20.5" r="1.1" fill="oklch(75% 0.18 30)"/><circle cx="62.4" cy="20.5" r="1.1" fill="oklch(75% 0.18 30)"/></svg>`;
    const SPIDER = (cls, len) => `<div class="hw__spider ${cls}" data-len="${len}"><span class="hw__thread" style="height:${len}vh"></span>
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
    const FIELD = `<svg class="hw__field" viewBox="0 0 1000 150" preserveAspectRatio="xMidYMax slice"><g transform="translate(17.3 53.5) scale(0.284 0.300)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 49)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 49)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 55)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(76% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(90.3 60.2) scale(0.272 0.253)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 45)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 45)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 52)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(189.6 61.1) scale(0.260 0.260)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 50)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 50)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 60)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(76% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(276.6 52.2) scale(0.305 0.325)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 53)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 53)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 54)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(340.3 56.1) scale(0.332 0.274)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 46)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 46)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 57)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(76% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(447.6 55.5) scale(0.275 0.292)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 45)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 45)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 53)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(530.6 57.6) scale(0.310 0.274)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 49)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 49)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 54)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(76% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(619.1 59.5) scale(0.303 0.269)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 49)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 49)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 60)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(699.1 51.6) scale(0.313 0.325)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 48)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 48)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 59)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(76% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(759.6 60.1) scale(0.293 0.253)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 52)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 52)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 57)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(870.0 54.0) scale(0.344 0.303)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 50)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 50)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 56)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(76% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(952.6 58.9) scale(0.332 0.286)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(25% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 45)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(35% 0.122 45)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(40% 0.128 58)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(24% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(28.2 72.5) scale(0.487 0.476)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 48)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 48)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 58)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(103.7 79.0) scale(0.373 0.388)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 45)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 45)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 59)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(76% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(200.6 74.8) scale(0.515 0.418)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 45)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 45)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 55)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(317.4 71.9) scale(0.585 0.476)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 47)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 47)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 55)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(76% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(414.0 70.0) scale(0.482 0.494)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 46)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 46)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 53)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(509.6 73.2) scale(0.451 0.445)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 44)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 44)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 55)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(76% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(608.9 68.5) scale(0.576 0.494)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 49)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 49)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 57)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(723.8 66.7) scale(0.584 0.486)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 53)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 53)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 59)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(76% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(818.5 79.5) scale(0.435 0.379)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 45)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 45)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 52)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(912.3 75.1) scale(0.386 0.411)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(34% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 44)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(46% 0.156 44)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(53% 0.164 53)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(32% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(76% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><path d="M0 126 C120 116 200 136 320 126 S520 116 640 126 S860 136 1000 126" fill="none" stroke="oklch(40% 0.08 140)" stroke-width="2.4"/><path d="M70 126c-11-13-2-24 11-22 4 11-2 20-11 22z" fill="oklch(38% 0.08 140)"/><path d="M240 126c-11-13-2-24 11-22 4 11-2 20-11 22z" fill="oklch(38% 0.08 140)"/><path d="M430 126c-11-13-2-24 11-22 4 11-2 20-11 22z" fill="oklch(38% 0.08 140)"/><path d="M600 126c-11-13-2-24 11-22 4 11-2 20-11 22z" fill="oklch(38% 0.08 140)"/><path d="M770 126c-11-13-2-24 11-22 4 11-2 20-11 22z" fill="oklch(38% 0.08 140)"/><path d="M930 126c-11-13-2-24 11-22 4 11-2 20-11 22z" fill="oklch(38% 0.08 140)"/><g transform="translate(1.3 93.3) scale(0.694 0.563)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 50)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 50)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 52)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(90% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(159.9 85.7) scale(0.612 0.635)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 52)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 52)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 61)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(321.6 92.5) scale(0.551 0.576)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 47)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 47)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 54)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(90% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(480.9 92.3) scale(0.709 0.563)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 49)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 49)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 52)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(594.9 80.5) scale(0.851 0.669)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 53)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 53)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 58)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(90% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g><g transform="translate(726.1 90.2) scale(0.710 0.593)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 49)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 49)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 59)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/></g><g transform="translate(860.7 75.3) scale(0.928 0.729)"><path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(42% 0.08 130)"/><ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 53)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.190 53)"/><ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.200 59)"/><path d="M60 24v76M44 26c-6 20-6 52 0 72M76 26c6 20 6 52 0 72" stroke="oklch(40% 0.12 45 / 0.35)" stroke-width="2" fill="none"/><g class="hw__face" fill="oklch(90% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/><path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></g></svg>`;
    /* Acker darunter (ohne Leuchten): Furchen, Erdklumpen, Steine, Stroh, Kürbis-Schatten.
       Generiert – gleiche viewBox wie FIELD, damit alles deckungsgleich liegt. */
    const SOIL = `<svg class="hw__soil" viewBox="0 0 1000 150" preserveAspectRatio="xMidYMax slice"><defs><linearGradient id="hwSoil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="oklch(19% 0.03 45)"/><stop offset="0.45" stop-color="oklch(27% 0.05 48)"/><stop offset="1" stop-color="oklch(34% 0.06 52)"/></linearGradient></defs><filter id="hwFog" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="4"/></filter><path d="M-20 78.4 Q62.5 76.3 125 81.5 Q187.5 83 250 81.2 Q312.5 80.9 375 78.9 Q437.5 80.1 500 80 Q562.5 77.8 625 79.8 Q687.5 79.5 750 80.7 Q812.5 81.6 875 81.3 Q937.5 80.1 1000 78.2 L1020 78.2 V150 H-20Z" fill="url(#hwSoil)"/><path d="M-20 78.4 Q62.5 76.3 125 81.5 Q187.5 83 250 81.2 Q312.5 80.9 375 78.9 Q437.5 80.1 500 80 Q562.5 77.8 625 79.8 Q687.5 79.5 750 80.7 Q812.5 81.6 875 81.3 Q937.5 80.1 1000 78.2 L1020 78.2" fill="none" stroke="oklch(34% 0.04 55 / 0.55)" stroke-width="0.8"/><path d="M-20 86.2 Q32.7 85.9 85.3 85.5" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1" stroke-linecap="round"/><path d="M-20 85.3 Q32.7 85.1 85.3 84.7" fill="none" stroke="oklch(46% 0.06 58 / 0.51)" stroke-width="0.5" stroke-linecap="round"/><path d="M78.1 85.9 Q143.7 85 209.2 85.5" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="0.9" stroke-linecap="round"/><path d="M78.1 85.1 Q143.7 84.2 209.2 84.7" fill="none" stroke="oklch(46% 0.06 58 / 0.53)" stroke-width="0.5" stroke-linecap="round"/><path d="M212.8 86.1 Q251.4 86.5 290.1 86.5" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.1" stroke-linecap="round"/><path d="M212.8 85.3 Q251.4 85.6 290.1 85.6" fill="none" stroke="oklch(46% 0.06 58 / 0.52)" stroke-width="0.5" stroke-linecap="round"/><path d="M295.8 85.8 Q329 85 362.3 85.6" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.5" stroke-linecap="round"/><path d="M295.8 84.5 Q329 83.7 362.3 84.3" fill="none" stroke="oklch(46% 0.06 58 / 0.49)" stroke-width="0.8" stroke-linecap="round"/><path d="M365.7 86.2 Q408.4 86.1 451 85.9" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.3" stroke-linecap="round"/><path d="M365.7 85 Q408.4 85 451 84.7" fill="none" stroke="oklch(46% 0.06 58 / 0.42)" stroke-width="0.7" stroke-linecap="round"/><path d="M443.8 85.9 Q488.3 86 532.7 85.8" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.4" stroke-linecap="round"/><path d="M443.8 84.7 Q488.3 84.8 532.7 84.6" fill="none" stroke="oklch(46% 0.06 58 / 0.54)" stroke-width="0.7" stroke-linecap="round"/><path d="M528.9 85.7 Q614.5 85.9 700.1 86.1" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.4" stroke-linecap="round"/><path d="M528.9 84.5 Q614.5 84.7 700.1 84.9" fill="none" stroke="oklch(46% 0.06 58 / 0.66)" stroke-width="0.7" stroke-linecap="round"/><path d="M702.3 85.6 Q752.5 86.2 802.6 85.9" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.6" stroke-linecap="round"/><path d="M702.3 84.2 Q752.5 84.8 802.6 84.5" fill="none" stroke="oklch(46% 0.06 58 / 0.45)" stroke-width="0.8" stroke-linecap="round"/><path d="M801.5 86.3 Q834.2 86.9 867 86.1" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.4" stroke-linecap="round"/><path d="M801.5 85.1 Q834.2 85.7 867 84.9" fill="none" stroke="oklch(46% 0.06 58 / 0.49)" stroke-width="0.7" stroke-linecap="round"/><path d="M868.7 85.9 Q940.3 87 1011.9 86.4" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.3" stroke-linecap="round"/><path d="M868.7 84.8 Q940.3 85.8 1011.9 85.3" fill="none" stroke="oklch(46% 0.06 58 / 0.54)" stroke-width="0.7" stroke-linecap="round"/><path d="M1013.2 86.2 Q1047.4 86.9 1081.7 86.6" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.4" stroke-linecap="round"/><path d="M1013.2 85 Q1047.4 85.7 1081.7 85.4" fill="none" stroke="oklch(46% 0.06 58 / 0.49)" stroke-width="0.7" stroke-linecap="round"/><path d="M-20 91.9 Q56.8 91 133.6 91.6" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.2" stroke-linecap="round"/><path d="M-20 91 Q56.8 90 133.6 90.6" fill="none" stroke="oklch(46% 0.06 58 / 0.42)" stroke-width="0.6" stroke-linecap="round"/><path d="M136.4 91.9 Q175.4 91.3 214.5 92.5" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.4" stroke-linecap="round"/><path d="M136.4 90.7 Q175.4 90.2 214.5 91.3" fill="none" stroke="oklch(46% 0.06 58 / 0.53)" stroke-width="0.7" stroke-linecap="round"/><path d="M214.2 92.5 Q306 91.9 397.8 91.7" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.9" stroke-linecap="round"/><path d="M214.2 90.8 Q306 90.3 397.8 90.1" fill="none" stroke="oklch(46% 0.06 58 / 0.51)" stroke-width="1" stroke-linecap="round"/><path d="M402.2 91.6 Q499.3 91.1 596.3 91.6" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.3" stroke-linecap="round"/><path d="M402.2 90.5 Q499.3 90 596.3 90.6" fill="none" stroke="oklch(46% 0.06 58 / 0.55)" stroke-width="0.6" stroke-linecap="round"/><path d="M596.5 91.9 Q644.9 92 693.3 91.8" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.1" stroke-linecap="round"/><path d="M596.5 90.9 Q644.9 91 693.3 90.9" fill="none" stroke="oklch(46% 0.06 58 / 0.69)" stroke-width="0.6" stroke-linecap="round"/><path d="M695 92.2 Q761.1 92.6 827.2 91.4" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.7" stroke-linecap="round"/><path d="M695 90.8 Q761.1 91.1 827.2 89.9" fill="none" stroke="oklch(46% 0.06 58 / 0.63)" stroke-width="0.9" stroke-linecap="round"/><path d="M831.4 91.9 Q917.3 91.9 1003.1 91.5" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.5" stroke-linecap="round"/><path d="M831.4 90.6 Q917.3 90.6 1003.1 90.2" fill="none" stroke="oklch(46% 0.06 58 / 0.42)" stroke-width="0.8" stroke-linecap="round"/><path d="M996.1 91.8 Q1040.7 90.6 1085.3 91.4" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.3" stroke-linecap="round"/><path d="M996.1 90.7 Q1040.7 89.5 1085.3 90.3" fill="none" stroke="oklch(46% 0.06 58 / 0.45)" stroke-width="0.6" stroke-linecap="round"/><path d="M-20 100.1 Q35.5 99.1 90.9 99.7" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.5" stroke-linecap="round"/><path d="M-20 98.8 Q35.5 97.8 90.9 98.4" fill="none" stroke="oklch(46% 0.06 58 / 0.48)" stroke-width="0.7" stroke-linecap="round"/><path d="M87.8 100 Q143.3 100.1 198.8 100.3" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.6" stroke-linecap="round"/><path d="M87.8 98.7 Q143.3 98.7 198.8 98.9" fill="none" stroke="oklch(46% 0.06 58 / 0.55)" stroke-width="0.8" stroke-linecap="round"/><path d="M192 99.1 Q229.1 98.8 266.3 100" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.9" stroke-linecap="round"/><path d="M192 97.5 Q229.1 97.2 266.3 98.4" fill="none" stroke="oklch(46% 0.06 58 / 0.41)" stroke-width="0.9" stroke-linecap="round"/><path d="M271.6 99.6 Q338.6 99.2 405.5 98.8" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.6" stroke-linecap="round"/><path d="M271.6 98.2 Q338.6 97.8 405.5 97.4" fill="none" stroke="oklch(46% 0.06 58 / 0.69)" stroke-width="0.8" stroke-linecap="round"/><path d="M409.6 99.3 Q488.4 99.8 567.1 99" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.8" stroke-linecap="round"/><path d="M409.6 97.8 Q488.4 98.3 567.1 97.5" fill="none" stroke="oklch(46% 0.06 58 / 0.56)" stroke-width="0.9" stroke-linecap="round"/><path d="M570 100 Q623.1 100.9 676.1 100.3" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.7" stroke-linecap="round"/><path d="M570 98.5 Q623.1 99.5 676.1 98.8" fill="none" stroke="oklch(46% 0.06 58 / 0.64)" stroke-width="0.9" stroke-linecap="round"/><path d="M679.6 99.5 Q761.4 98.3 843.2 99.3" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.7" stroke-linecap="round"/><path d="M679.6 98.1 Q761.4 96.8 843.2 97.8" fill="none" stroke="oklch(46% 0.06 58 / 0.41)" stroke-width="0.9" stroke-linecap="round"/><path d="M839.1 100.2 Q887.2 100.8 935.4 99.4" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="2.3" stroke-linecap="round"/><path d="M839.1 98.2 Q887.2 98.9 935.4 97.5" fill="none" stroke="oklch(46% 0.06 58 / 0.70)" stroke-width="1.2" stroke-linecap="round"/><path d="M940.7 99.1 Q996.3 98.4 1051.8 99" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="1.7" stroke-linecap="round"/><path d="M940.7 97.6 Q996.3 96.9 1051.8 97.6" fill="none" stroke="oklch(46% 0.06 58 / 0.59)" stroke-width="0.9" stroke-linecap="round"/><path d="M-20 108.8 Q68.8 107.8 157.7 109" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="2.6" stroke-linecap="round"/><path d="M-20 106.6 Q68.8 105.6 157.7 106.9" fill="none" stroke="oklch(46% 0.06 58 / 0.60)" stroke-width="1.3" stroke-linecap="round"/><path d="M162.4 108.5 Q247.2 109 331.9 107.9" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3" stroke-linecap="round"/><path d="M162.4 105.9 Q247.2 106.4 331.9 105.4" fill="none" stroke="oklch(46% 0.06 58 / 0.50)" stroke-width="1.5" stroke-linecap="round"/><path d="M335.1 108.3 Q433.1 109.4 531.2 109.3" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="2.4" stroke-linecap="round"/><path d="M335.1 106.2 Q433.1 107.3 531.2 107.2" fill="none" stroke="oklch(46% 0.06 58 / 0.45)" stroke-width="1.2" stroke-linecap="round"/><path d="M524.9 109.1 Q565.5 109.3 606.1 107.9" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3.2" stroke-linecap="round"/><path d="M524.9 106.3 Q565.5 106.6 606.1 105.1" fill="none" stroke="oklch(46% 0.06 58 / 0.69)" stroke-width="1.6" stroke-linecap="round"/><path d="M607.3 107.8 Q661.8 109 716.4 107.6" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="2.7" stroke-linecap="round"/><path d="M607.3 105.5 Q661.8 106.7 716.4 105.3" fill="none" stroke="oklch(46% 0.06 58 / 0.59)" stroke-width="1.3" stroke-linecap="round"/><path d="M715.7 109.2 Q811.1 108.3 906.4 109.1" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="2.5" stroke-linecap="round"/><path d="M715.7 107 Q811.1 106.2 906.4 107" fill="none" stroke="oklch(46% 0.06 58 / 0.48)" stroke-width="1.3" stroke-linecap="round"/><path d="M902.5 108.1 Q949.4 107.2 996.2 108.4" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="2.7" stroke-linecap="round"/><path d="M902.5 105.7 Q949.4 104.9 996.2 106" fill="none" stroke="oklch(46% 0.06 58 / 0.67)" stroke-width="1.4" stroke-linecap="round"/><path d="M993.2 109.2 Q1055.2 109.9 1117.3 108.4" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="2.7" stroke-linecap="round"/><path d="M993.2 106.9 Q1055.2 107.6 1117.3 106" fill="none" stroke="oklch(46% 0.06 58 / 0.55)" stroke-width="1.4" stroke-linecap="round"/><path d="M-20 118.9 Q46.6 117 113.3 118.3" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="2.3" stroke-linecap="round"/><path d="M-20 116.9 Q46.6 115.1 113.3 116.4" fill="none" stroke="oklch(46% 0.06 58 / 0.64)" stroke-width="1.2" stroke-linecap="round"/><path d="M107.7 119.1 Q170.8 118.9 234 118.6" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3.7" stroke-linecap="round"/><path d="M107.7 116 Q170.8 115.8 234 115.5" fill="none" stroke="oklch(46% 0.06 58 / 0.57)" stroke-width="1.8" stroke-linecap="round"/><path d="M237 118.5 Q274.4 119.4 311.8 118.5" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3.4" stroke-linecap="round"/><path d="M237 115.6 Q274.4 116.5 311.8 115.7" fill="none" stroke="oklch(46% 0.06 58 / 0.55)" stroke-width="1.7" stroke-linecap="round"/><path d="M311.7 118.9 Q394.9 119.1 478.1 119.2" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="4" stroke-linecap="round"/><path d="M311.7 115.4 Q394.9 115.6 478.1 115.8" fill="none" stroke="oklch(46% 0.06 58 / 0.55)" stroke-width="2" stroke-linecap="round"/><path d="M479.8 119 Q541.5 120.1 603.1 119.9" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3.3" stroke-linecap="round"/><path d="M479.8 116.1 Q541.5 117.3 603.1 117.1" fill="none" stroke="oklch(46% 0.06 58 / 0.66)" stroke-width="1.7" stroke-linecap="round"/><path d="M608.3 119.9 Q656.5 118.7 704.7 119.7" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3.4" stroke-linecap="round"/><path d="M608.3 117.1 Q656.5 115.8 704.7 116.9" fill="none" stroke="oklch(46% 0.06 58 / 0.44)" stroke-width="1.7" stroke-linecap="round"/><path d="M702.8 118.1 Q737.9 119.6 773 119.4" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="2.7" stroke-linecap="round"/><path d="M702.8 115.8 Q737.9 117.3 773 117" fill="none" stroke="oklch(46% 0.06 58 / 0.67)" stroke-width="1.4" stroke-linecap="round"/><path d="M767.2 118.2 Q847.3 120.5 927.4 119.8" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3.6" stroke-linecap="round"/><path d="M767.2 115.2 Q847.3 117.5 927.4 116.8" fill="none" stroke="oklch(46% 0.06 58 / 0.47)" stroke-width="1.8" stroke-linecap="round"/><path d="M932.8 120 Q990.6 118.8 1048.5 119.7" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3.2" stroke-linecap="round"/><path d="M932.8 117.3 Q990.6 116.1 1048.5 117" fill="none" stroke="oklch(46% 0.06 58 / 0.53)" stroke-width="1.6" stroke-linecap="round"/><path d="M-20 130.6 Q33.7 129.3 87.5 131.5" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3.2" stroke-linecap="round"/><path d="M-20 127.8 Q33.7 126.5 87.5 128.8" fill="none" stroke="oklch(46% 0.06 58 / 0.57)" stroke-width="1.6" stroke-linecap="round"/><path d="M85.6 131.3 Q116.9 129.6 148.2 131" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3.6" stroke-linecap="round"/><path d="M85.6 128.3 Q116.9 126.5 148.2 128" fill="none" stroke="oklch(46% 0.06 58 / 0.70)" stroke-width="1.8" stroke-linecap="round"/><path d="M151.2 130.4 Q249.2 131.2 347.2 129.9" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3" stroke-linecap="round"/><path d="M151.2 127.9 Q249.2 128.6 347.2 127.3" fill="none" stroke="oklch(46% 0.06 58 / 0.48)" stroke-width="1.5" stroke-linecap="round"/><path d="M341.1 131.8 Q400.6 129.8 460.2 130.4" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="4.9" stroke-linecap="round"/><path d="M341.1 127.6 Q400.6 125.6 460.2 126.2" fill="none" stroke="oklch(46% 0.06 58 / 0.68)" stroke-width="2.5" stroke-linecap="round"/><path d="M460.2 129.9 Q539.2 130.4 618.2 131.5" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3" stroke-linecap="round"/><path d="M460.2 127.4 Q539.2 127.9 618.2 128.9" fill="none" stroke="oklch(46% 0.06 58 / 0.42)" stroke-width="1.5" stroke-linecap="round"/><path d="M623.4 130 Q697.8 129.3 772.2 131.9" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="4.7" stroke-linecap="round"/><path d="M623.4 126 Q697.8 125.4 772.2 127.9" fill="none" stroke="oklch(46% 0.06 58 / 0.66)" stroke-width="2.3" stroke-linecap="round"/><path d="M770.5 132 Q824.3 129.9 878 130.4" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="4.1" stroke-linecap="round"/><path d="M770.5 128.6 Q824.3 126.4 878 127" fill="none" stroke="oklch(46% 0.06 58 / 0.56)" stroke-width="2" stroke-linecap="round"/><path d="M873.4 129.9 Q911 129.4 948.7 130.3" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3.2" stroke-linecap="round"/><path d="M873.4 127.2 Q911 126.7 948.7 127.6" fill="none" stroke="oklch(46% 0.06 58 / 0.49)" stroke-width="1.6" stroke-linecap="round"/><path d="M951.3 130.2 Q1001.6 128.6 1051.9 130.6" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="4" stroke-linecap="round"/><path d="M951.3 126.8 Q1001.6 125.3 1051.9 127.3" fill="none" stroke="oklch(46% 0.06 58 / 0.48)" stroke-width="2" stroke-linecap="round"/><path d="M-20 143.1 Q61.3 145.4 142.6 143.9" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="4.9" stroke-linecap="round"/><path d="M-20 139 Q61.3 141.2 142.6 139.8" fill="none" stroke="oklch(46% 0.06 58 / 0.43)" stroke-width="2.4" stroke-linecap="round"/><path d="M146.1 144.9 Q206.3 144.4 266.6 143.7" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="4.7" stroke-linecap="round"/><path d="M146.1 140.9 Q206.3 140.3 266.6 139.7" fill="none" stroke="oklch(46% 0.06 58 / 0.61)" stroke-width="2.4" stroke-linecap="round"/><path d="M272.4 144.6 Q326.3 144.1 380.3 144.4" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="5.7" stroke-linecap="round"/><path d="M272.4 139.8 Q326.3 139.2 380.3 139.6" fill="none" stroke="oklch(46% 0.06 58 / 0.50)" stroke-width="2.8" stroke-linecap="round"/><path d="M373.1 144.7 Q412.2 142.6 451.3 143.3" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3.5" stroke-linecap="round"/><path d="M373.1 141.7 Q412.2 139.6 451.3 140.3" fill="none" stroke="oklch(46% 0.06 58 / 0.43)" stroke-width="1.8" stroke-linecap="round"/><path d="M455 143.4 Q546 142.4 636.9 143.3" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="5.2" stroke-linecap="round"/><path d="M455 138.9 Q546 138 636.9 138.8" fill="none" stroke="oklch(46% 0.06 58 / 0.54)" stroke-width="2.6" stroke-linecap="round"/><path d="M631.1 145.3 Q692.3 145.5 753.5 145.3" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="4.1" stroke-linecap="round"/><path d="M631.1 141.8 Q692.3 142.1 753.5 141.9" fill="none" stroke="oklch(46% 0.06 58 / 0.47)" stroke-width="2" stroke-linecap="round"/><path d="M759.1 142.6 Q810.7 143 862.4 143.7" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="4.3" stroke-linecap="round"/><path d="M759.1 138.9 Q810.7 139.3 862.4 140" fill="none" stroke="oklch(46% 0.06 58 / 0.55)" stroke-width="2.2" stroke-linecap="round"/><path d="M857.2 143.3 Q922.5 142.7 987.9 142.8" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="3.3" stroke-linecap="round"/><path d="M857.2 140.5 Q922.5 139.8 987.9 140" fill="none" stroke="oklch(46% 0.06 58 / 0.41)" stroke-width="1.7" stroke-linecap="round"/><path d="M980.2 144.2 Q1031.5 145.2 1082.8 144.1" fill="none" stroke="oklch(12% 0.025 40 / 0.9)" stroke-width="4" stroke-linecap="round"/><path d="M980.2 140.9 Q1031.5 141.8 1082.8 140.7" fill="none" stroke="oklch(46% 0.06 58 / 0.60)" stroke-width="2" stroke-linecap="round"/><ellipse cx="34.3" cy="83.5" rx="15.9" ry="3.1" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="106.6" cy="85.5" rx="15.2" ry="2.8" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="205.2" cy="87.1" rx="14.6" ry="2.8" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="294.9" cy="84.7" rx="17.1" ry="3.3" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="360.2" cy="83.5" rx="18.6" ry="2.9" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="464.1" cy="84.7" rx="15.4" ry="3" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="549.2" cy="85" rx="17.4" ry="2.9" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="637.3" cy="86.4" rx="17" ry="2.9" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="717.9" cy="84.1" rx="17.5" ry="3.3" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="777.2" cy="85.4" rx="16.4" ry="2.8" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="890.6" cy="84.3" rx="19.3" ry="3.1" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="972.5" cy="87.5" rx="18.6" ry="3" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="57.4" cy="120.1" rx="27.3" ry="4.3" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="126.1" cy="117.8" rx="20.9" ry="3.7" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="231.5" cy="116.6" rx="28.8" ry="3.9" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="352.5" cy="119.5" rx="32.8" ry="4.3" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="442.9" cy="119.4" rx="27" ry="4.5" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="536.7" cy="117.7" rx="25.3" ry="4.1" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="643.5" cy="117.9" rx="32.3" ry="4.5" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="758.8" cy="115.3" rx="32.7" ry="4.4" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="844.6" cy="117.4" rx="24.4" ry="3.7" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="935.5" cy="116.2" rx="21.6" ry="3.9" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="42.9" cy="149.6" rx="38.9" ry="4.9" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="196.6" cy="149.2" rx="34.3" ry="5.4" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="354.7" cy="150.1" rx="30.9" ry="5" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="523.4" cy="148.6" rx="39.7" ry="4.9" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="646" cy="147.4" rx="47.7" ry="5.7" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="768.7" cy="149.5" rx="39.8" ry="5.2" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="916.4" cy="148.2" rx="52" ry="6.1" fill="oklch(7% 0.02 40 / 0.75)"/><ellipse cx="104.6" cy="85.1" rx="0.6" ry="0.3" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="104.7" cy="99.1" rx="0.9" ry="0.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="745.5" cy="99.8" rx="1.3" ry="0.7" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="737" cy="106.4" rx="1.4" ry="0.8" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="85" cy="149.8" rx="1.8" ry="1" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="200" cy="114.1" rx="1.5" ry="0.8" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="211.3" cy="104.8" rx="1.4" ry="0.8" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="845.5" cy="147.8" rx="2.5" ry="1.4" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="802" cy="99.8" rx="1.1" ry="0.6" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="875.7" cy="136.8" rx="2.7" ry="1.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="431" cy="104.6" rx="1.2" ry="0.7" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="213.6" cy="131.8" rx="1.4" ry="0.8" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="573.3" cy="110.8" rx="1.5" ry="0.8" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="986" cy="148.1" rx="4" ry="2.2" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="561.1" cy="145" rx="3.7" ry="2" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="186.6" cy="94.9" rx="1.4" ry="0.7" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="87.6" cy="134.7" rx="2.2" ry="1.2" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="1001.5" cy="132.3" rx="1.7" ry="1" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="330.6" cy="104.2" rx="1.2" ry="0.7" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="110.4" cy="127.4" rx="1.4" ry="0.8" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="195.1" cy="148.1" rx="2.1" ry="1.1" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="498.1" cy="122.4" rx="2.4" ry="1.3" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="991.1" cy="143.2" rx="2.6" ry="1.5" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="485.1" cy="142.9" rx="3.3" ry="1.8" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="772.9" cy="148.7" rx="2.3" ry="1.3" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="1.4" cy="114.5" rx="1.5" ry="0.8" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="1003" cy="120.6" rx="1.3" ry="0.7" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="894.6" cy="146.3" rx="3.4" ry="1.9" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="555.6" cy="134.4" rx="2.5" ry="1.4" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="188.5" cy="106.1" rx="1.5" ry="0.8" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="466.2" cy="135.9" rx="1.7" ry="0.9" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="343.8" cy="125.2" rx="1.5" ry="0.8" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="581.3" cy="134.5" rx="1.7" ry="1" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="201.8" cy="136.7" rx="1.9" ry="1.1" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="898.1" cy="104.4" rx="1.1" ry="0.6" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="264.8" cy="146.1" rx="3.7" ry="2.1" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="617" cy="88.2" rx="1" ry="0.6" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="433.6" cy="126" rx="2.4" ry="1.3" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="824" cy="117.9" rx="1.6" ry="0.9" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="318.4" cy="107" rx="1.2" ry="0.7" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="210.3" cy="96.7" rx="1.5" ry="0.8" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="451" cy="144.6" rx="3" ry="1.7" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="59.4" cy="118.9" rx="1.3" ry="0.7" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="990.8" cy="141.8" rx="2.2" ry="1.2" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="296.5" cy="138" rx="3.3" ry="1.8" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="782.7" cy="118" rx="1.4" ry="0.8" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="541.7" cy="142.5" rx="2.3" ry="1.2" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="712" cy="133.4" rx="1.4" ry="0.8" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="676.8" cy="147.2" rx="2.8" ry="1.6" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="385.4" cy="111.9" rx="1.8" ry="1" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="39.2" cy="138.5" rx="2.6" ry="1.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="963.7" cy="90.1" rx="1" ry="0.5" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="100.1" cy="109.4" rx="1.6" ry="0.9" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="491.5" cy="107.6" rx="2" ry="1.1" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="305.2" cy="138.4" rx="3.1" ry="1.7" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="868.7" cy="106" rx="1.4" ry="0.8" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="808.9" cy="86.9" rx="0.7" ry="0.4" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="670.5" cy="138" rx="1.5" ry="0.8" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="1002.9" cy="106.7" rx="1.4" ry="0.8" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="570.6" cy="91.1" rx="1.2" ry="0.6" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="196.2" cy="130.6" rx="1.7" ry="1" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="845.6" cy="134.1" rx="1.5" ry="0.8" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="399.5" cy="120.9" rx="2.4" ry="1.3" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="557.2" cy="119.5" rx="2.3" ry="1.3" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="878.5" cy="91" rx="0.7" ry="0.4" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="378.7" cy="97.9" rx="0.9" ry="0.5" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="927.5" cy="114" rx="2" ry="1.1" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="827.2" cy="129.4" rx="2.1" ry="1.1" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="220.6" cy="103" rx="1" ry="0.6" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="858.5" cy="97.1" rx="1.3" ry="0.7" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="785.2" cy="108.9" rx="1.4" ry="0.8" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="330.4" cy="124.4" rx="2.7" ry="1.5" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="136.1" cy="122.5" rx="1.9" ry="1" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="603" cy="91.7" rx="0.8" ry="0.4" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="779.3" cy="126.7" rx="1.5" ry="0.8" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="593.9" cy="126.8" rx="2.6" ry="1.4" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="300.3" cy="99.2" rx="1.1" ry="0.6" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="862.9" cy="126.3" rx="2.9" ry="1.6" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="649.1" cy="137.5" rx="1.8" ry="1" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="534.8" cy="122.4" rx="2.4" ry="1.3" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="975.9" cy="119.4" rx="1.4" ry="0.8" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="586.2" cy="134" rx="2.9" ry="1.6" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="829.8" cy="145" rx="2.4" ry="1.3" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="767.7" cy="116" rx="2" ry="1.1" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="155.3" cy="143.1" rx="3.1" ry="1.7" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="342.7" cy="129.1" rx="2.8" ry="1.5" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="914.8" cy="137.8" rx="2.7" ry="1.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="9.2" cy="92" rx="0.6" ry="0.3" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="232.7" cy="127.7" rx="1.9" ry="1.1" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="43" cy="111.1" rx="1.3" ry="0.7" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="402.1" cy="92" rx="0.9" ry="0.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="341" cy="132.3" rx="2.4" ry="1.3" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="869.1" cy="148.8" rx="3.3" ry="1.8" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="244.4" cy="113" rx="2.1" ry="1.2" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="356.2" cy="146.3" rx="2.6" ry="1.4" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="715.4" cy="148.9" rx="3.2" ry="1.7" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="569.2" cy="146.3" rx="2" ry="1.1" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="276.4" cy="145" rx="2" ry="1.1" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="153.7" cy="114.2" rx="1.6" ry="0.9" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="273" cy="147.1" rx="2.5" ry="1.4" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="465.3" cy="148.5" rx="3.3" ry="1.8" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="413.3" cy="104.1" rx="1.4" ry="0.8" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="534.3" cy="85.8" rx="0.7" ry="0.4" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="510.9" cy="119.2" rx="2.1" ry="1.2" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="525.5" cy="123.3" rx="2.1" ry="1.1" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="691.4" cy="107" rx="2" ry="1.1" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="394.9" cy="137.8" rx="1.7" ry="0.9" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="604.7" cy="100.8" rx="1.1" ry="0.6" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="120.3" cy="147.9" rx="3.2" ry="1.8" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="255.6" cy="114.1" rx="1.4" ry="0.8" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="394.1" cy="87.2" rx="0.5" ry="0.3" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="962.6" cy="120.6" rx="1.8" ry="1" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="941.5" cy="138.8" rx="1.9" ry="1" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="155.4" cy="116" rx="1.4" ry="0.8" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="111.1" cy="144.2" rx="2.2" ry="1.2" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="210.5" cy="92.4" rx="0.6" ry="0.3" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="93.9" cy="105.4" rx="0.9" ry="0.5" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="47.8" cy="125.2" rx="1.3" ry="0.7" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="109.8" cy="100.3" rx="1.3" ry="0.7" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="846.5" cy="92" rx="0.8" ry="0.4" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="827.9" cy="113" rx="1.5" ry="0.8" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="884.9" cy="143.6" rx="3.4" ry="1.9" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="470.1" cy="105.9" rx="1.6" ry="0.9" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="647.7" cy="127.5" rx="1.3" ry="0.7" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="835.4" cy="134.8" rx="3.3" ry="1.8" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="141.1" cy="130.9" rx="2.2" ry="1.2" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="604.9" cy="128" rx="2.8" ry="1.5" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="370.5" cy="131" rx="2.7" ry="1.5" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="800.5" cy="114.2" rx="1.9" ry="1" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="89" cy="124.2" rx="2.1" ry="1.2" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="917.5" cy="115.3" rx="2.1" ry="1.2" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="126.5" cy="97" rx="1.3" ry="0.7" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="808.3" cy="142.2" rx="3.1" ry="1.7" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="888.6" cy="86.2" rx="0.8" ry="0.4" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="816.2" cy="116.5" rx="1.8" ry="1" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="313.7" cy="104.8" rx="0.9" ry="0.5" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="869.7" cy="128.3" rx="2.4" ry="1.3" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="659.8" cy="147.1" rx="3.4" ry="1.9" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="721.6" cy="127.2" rx="2.7" ry="1.5" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="862.3" cy="125.1" rx="2.4" ry="1.3" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="246" cy="129.3" rx="1.9" ry="1.1" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="-1.5" cy="128.5" rx="2.3" ry="1.3" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="933.7" cy="149.8" rx="2.5" ry="1.4" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="322.7" cy="144.3" rx="2.5" ry="1.4" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="391" cy="136.1" rx="2.8" ry="1.5" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="597.5" cy="149.3" rx="3.4" ry="1.9" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="709.3" cy="118.2" rx="1.8" ry="1" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="842.2" cy="137.2" rx="1.7" ry="0.9" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="75.7" cy="106.1" rx="1.1" ry="0.6" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="516.4" cy="119.9" rx="2.2" ry="1.2" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="686.6" cy="125.8" rx="1.4" ry="0.8" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="355.9" cy="119.6" rx="2.1" ry="1.2" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="248.7" cy="124.5" rx="1.5" ry="0.8" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="874.6" cy="136.7" rx="2.6" ry="1.4" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="400.3" cy="142.3" rx="2.7" ry="1.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="360.2" cy="131.9" rx="1.7" ry="1" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="647.7" cy="131.9" rx="2.1" ry="1.2" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="736.2" cy="120.3" rx="2" ry="1.1" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="68.7" cy="104.3" rx="1.7" ry="0.9" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="922" cy="124.5" rx="1.5" ry="0.8" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="97.4" cy="124.1" rx="1.4" ry="0.8" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="682" cy="141" rx="3.5" ry="1.9" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="493.7" cy="90" rx="1.2" ry="0.6" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="132.5" cy="110.3" rx="1" ry="0.6" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="472.7" cy="86.9" rx="1" ry="0.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="838.5" cy="132.6" rx="3.1" ry="1.7" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="135.5" cy="116.3" rx="1.5" ry="0.8" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="533.5" cy="98.8" rx="1.1" ry="0.6" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="722.5" cy="107.5" rx="1.7" ry="1" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="715.9" cy="139.9" rx="2.6" ry="1.4" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="43.1" cy="125.7" rx="1.7" ry="0.9" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="199.2" cy="129.6" rx="2.7" ry="1.5" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="38.2" cy="140.4" rx="3.1" ry="1.7" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="201.5" cy="143.2" rx="3.7" ry="2" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="44" cy="143.9" rx="2.5" ry="1.3" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="457.1" cy="102.2" rx="1" ry="0.6" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="355.1" cy="129.1" rx="2.7" ry="1.5" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="128.6" cy="129.4" rx="1.5" ry="0.9" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="0.4" cy="130.4" rx="3.1" ry="1.7" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="532.7" cy="143.9" rx="2.8" ry="1.6" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="510.6" cy="114.6" rx="1.1" ry="0.6" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="65.8" cy="132.3" rx="3.2" ry="1.7" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="455.8" cy="137" rx="1.7" ry="0.9" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="980.3" cy="145.2" rx="2.5" ry="1.4" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="669.7" cy="90.5" rx="1.1" ry="0.6" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="972.8" cy="145.3" rx="3" ry="1.7" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="194" cy="146.8" rx="3.9" ry="2.1" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="440.5" cy="149" rx="2.8" ry="1.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="410.5" cy="89.7" rx="0.9" ry="0.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="86.6" cy="102.6" rx="1.2" ry="0.6" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="181.2" cy="98.7" rx="1" ry="0.5" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="268.4" cy="86.4" rx="0.6" ry="0.3" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="542.5" cy="141.5" rx="3.4" ry="1.9" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="611.6" cy="143.2" rx="2.7" ry="1.5" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="986.8" cy="115.3" rx="1.8" ry="1" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="540.3" cy="94.9" rx="0.9" ry="0.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="385.7" cy="143.2" rx="1.8" ry="1" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="832.6" cy="104.5" rx="1.4" ry="0.8" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="93.2" cy="103" rx="0.8" ry="0.4" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="1000.3" cy="133.9" rx="2.4" ry="1.3" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="931" cy="125" rx="1.5" ry="0.8" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="18.6" cy="134.3" rx="1.8" ry="1" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="951" cy="139.4" rx="1.8" ry="1" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="857.9" cy="138.1" rx="2" ry="1.1" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="12" cy="148.4" rx="3" ry="1.6" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="245.6" cy="144" rx="3.3" ry="1.8" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="834.3" cy="93.6" rx="1.3" ry="0.7" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="705.2" cy="102.8" rx="1.8" ry="1" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="432.7" cy="142.8" rx="3.6" ry="2" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="372.4" cy="119.1" rx="1.6" ry="0.9" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="-3.4" cy="109.4" rx="1.7" ry="0.9" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="293" cy="141.5" rx="3.3" ry="1.8" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="718.1" cy="149.8" rx="3.4" ry="1.9" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="233.5" cy="96.6" rx="1.2" ry="0.6" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="204.9" cy="106.4" rx="1.3" ry="0.7" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="874.5" cy="94.7" rx="1" ry="0.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="452.3" cy="113" rx="2.3" ry="1.2" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="143.9" cy="148.3" rx="2.2" ry="1.2" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="649.3" cy="86.4" rx="0.7" ry="0.4" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="350.2" cy="144.5" rx="2.3" ry="1.3" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="442.7" cy="130.5" rx="1.6" ry="0.9" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="236.1" cy="132.5" rx="3.1" ry="1.7" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="200.2" cy="97.3" rx="0.7" ry="0.4" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="493.4" cy="123.5" rx="1.3" ry="0.7" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="4.3" cy="148.6" rx="4" ry="2.2" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="639.7" cy="134" rx="1.8" ry="1" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="876.4" cy="118.4" rx="1.1" ry="0.6" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="180.1" cy="100.7" rx="1.1" ry="0.6" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="397.4" cy="138.9" rx="2.9" ry="1.6" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="430.4" cy="140.8" rx="2.2" ry="1.2" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="460.6" cy="93.5" rx="0.9" ry="0.5" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="364.1" cy="86.8" rx="0.9" ry="0.5" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="252.9" cy="122.8" rx="1.4" ry="0.8" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="235.3" cy="134.8" rx="2.7" ry="1.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="387.8" cy="145.5" rx="1.7" ry="0.9" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="428.2" cy="131.7" rx="1.8" ry="1" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="522.3" cy="84.7" rx="0.8" ry="0.4" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="947.9" cy="98.8" rx="0.9" ry="0.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="303.8" cy="130.3" rx="2.7" ry="1.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="803.4" cy="140" rx="2.7" ry="1.5" fill="oklch(30% 0.05 50 / 0.9)"/><ellipse cx="44.5" cy="113.1" rx="2.3" ry="1.2" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="662.9" cy="117.3" rx="2.3" ry="1.3" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="510" cy="104" rx="1" ry="0.5" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="706.2" cy="86.2" rx="0.9" ry="0.5" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="25.6" cy="114.1" rx="1.2" ry="0.7" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="698.8" cy="93.3" rx="0.7" ry="0.4" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="122.5" cy="96.8" rx="0.8" ry="0.4" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="476.8" cy="86" rx="0.9" ry="0.5" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="666.3" cy="85.7" rx="0.6" ry="0.3" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="63.2" cy="131.8" rx="2.4" ry="1.3" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="907.6" cy="137.9" rx="2.8" ry="1.5" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="48.5" cy="131.4" rx="2.6" ry="1.4" fill="oklch(13% 0.02 40 / 0.85)"/><ellipse cx="619.8" cy="137.3" rx="2.9" ry="1.6" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="424" cy="135.2" rx="2" ry="1.1" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="696" cy="98.6" rx="1.1" ry="0.6" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="556.8" cy="102.6" rx="1.4" ry="0.8" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="827.5" cy="142.8" rx="2.1" ry="1.2" fill="oklch(48% 0.06 60 / 0.6)"/><ellipse cx="990.7" cy="111.6" rx="2.1" ry="1.1" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="1007.2" cy="147.6" rx="3.4" ry="1.9" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="710.9" cy="137.5" rx="2.4" ry="1.3" fill="oklch(40% 0.055 55 / 0.8)"/><ellipse cx="494.3" cy="137.4" rx="3.1" ry="1.9" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="493.5" cy="136.8" rx="1.4" ry="0.7" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="885.6" cy="117" rx="2.4" ry="1.4" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="885" cy="116.6" rx="1.1" ry="0.5" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="298.2" cy="139.1" rx="3.2" ry="1.9" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="297.4" cy="138.4" rx="1.4" ry="0.7" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="991.5" cy="138.5" rx="3.2" ry="1.9" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="990.7" cy="137.9" rx="1.4" ry="0.7" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="220.7" cy="130.5" rx="2.9" ry="1.7" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="220" cy="130" rx="1.3" ry="0.6" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="560.3" cy="122.7" rx="2.6" ry="1.6" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="559.7" cy="122.2" rx="1.2" ry="0.6" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="743.6" cy="109.8" rx="2.1" ry="1.3" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="743.1" cy="109.4" rx="0.9" ry="0.5" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="169.9" cy="101.2" rx="1.8" ry="1.1" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="169.5" cy="100.8" rx="0.8" ry="0.4" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="338.5" cy="144.4" rx="3.4" ry="2" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="337.7" cy="143.7" rx="1.5" ry="0.7" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="782" cy="102.7" rx="1.8" ry="1.1" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="781.5" cy="102.3" rx="0.8" ry="0.4" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="440.8" cy="136.7" rx="3.1" ry="1.9" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="440" cy="136.1" rx="1.4" ry="0.7" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="9.3" cy="120.4" rx="2.5" ry="1.5" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="8.7" cy="119.9" rx="1.1" ry="0.5" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="903.3" cy="95.8" rx="1.6" ry="1" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="902.9" cy="95.5" rx="0.7" ry="0.3" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="717.9" cy="144.5" rx="3.4" ry="2" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="717" cy="143.8" rx="1.5" ry="0.7" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="404.2" cy="130.7" rx="2.9" ry="1.7" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="403.4" cy="130.2" rx="1.3" ry="0.6" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="728.8" cy="110.8" rx="2.1" ry="1.3" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="728.3" cy="110.3" rx="1" ry="0.5" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="82.6" cy="136.1" rx="3.1" ry="1.9" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="81.9" cy="135.5" rx="1.4" ry="0.7" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="69.2" cy="101.1" rx="1.8" ry="1.1" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="68.8" cy="100.7" rx="0.8" ry="0.4" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="482.7" cy="131.7" rx="2.9" ry="1.8" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="482" cy="131.1" rx="1.3" ry="0.6" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="502" cy="98.9" rx="1.7" ry="1" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="501.5" cy="98.6" rx="0.8" ry="0.4" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="768.2" cy="143.7" rx="3.4" ry="2" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="767.4" cy="143.1" rx="1.5" ry="0.7" fill="oklch(62% 0.01 80 / 0.5)"/><ellipse cx="639.6" cy="133" rx="3" ry="1.8" fill="oklch(42% 0.01 80 / 0.7)"/><ellipse cx="638.8" cy="132.4" rx="1.3" ry="0.7" fill="oklch(62% 0.01 80 / 0.5)"/><path d="M544.7 99.9l2.2 -1.8 M24 89.5l-1.1 -0.9 M639.4 107l2.2 -2.6 M415.4 92.9l-0.8 -1.6 M172.4 104.3l-2.1 -1.8 M722.9 147.9l-6.5 -5.2 M653.1 94.8l-0.6 -2.2 M397.4 106.8l-1.2 -1.4 M144.4 96.9l1 -2.3 M424.5 137.9l-1.4 -3.6 M790.1 115.9l-2.8 -2.9 M654 103.9l0.2 -2 M286.5 90.8l1.6 -1.4 M87.5 146.4l-3.2 -3.6 M598.9 112.8l0.7 -2.8 M591.3 125.3l-2 -2.2 M72.5 117.6l0.8 -2.4 M974.7 140.4l-3.9 -3.8 M680.2 122.3l2.1 -2.2 M646.7 99.5l2.4 -2.4 M292.4 133.3l3.4 -3.1 M203.6 117.4l-2.8 -2.3 M378.5 145.4l-4.7 -3.7 M156 125.5l1.8 -2.3 M557.8 117l-2.6 -2.1 M383.6 108l1.7 -2.8 M551.1 115.5l2 -2.9 M285.5 133.5l-1.9 -3 M824.9 110.6l-2.9 -2.2 M340.5 132.2l4.4 -3.7 M562.4 142.2l2.7 -2.4 M521.7 90.9l-1.2 -1 M680.5 139.5l-3.5 -3.8 M301.7 102.8l-1.8 -2.4 M852.7 123.1l-0.5 -2 M585.7 102.9l2.3 -1.7 M861.7 107.8l-0 -2 M729 132.9l-2.8 -3.6 M75.1 115.2l-0.2 -2 M866.7 141.4l1.9 -3 M686.7 147.1l-0.7 -4.9 M612.4 136.2l-0.4 -3.5 M508.1 123.2l-3.9 -3 M184.2 131l2.6 -2.3 M801.1 137.7l-3.3 -3.3 M126.3 110.5l-1.6 -2.2 M899.6 113.8l-3.2 -3.2 M861.3 123.8l0.5 -3.9 M114.7 133.1l1.8 -2.8 M133 140.7l4.5 -4.5 M626.6 93.4l1.2 -1.3 M897.6 111l-1.8 -2.7 M563.1 117.5l2.4 -2.4 M886.3 95.9l-1.2 -2.2 M631.1 128.7l-3.8 -4 M749.4 139.3l-0.2 -4.2 M15.2 120.5l1 -2 M771.5 141.9l-1.4 -2.7 M475 122.2l1.8 -3.5 M868.9 141.6l3.6 -4.4 M204.8 145l4.2 -3.6 M347.9 108l0.7 -1.5 M184.5 140.1l-2.8 -2.9 M209.6 138.2l5.7 -4.5 M937.7 127.1l-0 -3.8 M139.5 123.2l4.5 -3.7 M211 94.2l0.6 -1.1 M0.3 102.6l-1.9 -2.7 M718.3 121.1l-5 -3.6 M349.7 94.6l1.6 -1.7" fill="none" stroke="oklch(58% 0.07 85 / 0.45)" stroke-width="0.7" stroke-linecap="round"/><g filter="url(#hwFog)"><ellipse cx="887.2" cy="83.8" rx="142" ry="3.6" fill="oklch(80% 0.02 280 / 0.13)"/><ellipse cx="877.8" cy="83.3" rx="123.9" ry="3.7" fill="oklch(80% 0.02 280 / 0.13)"/><ellipse cx="269.7" cy="82.8" rx="145.6" ry="4.2" fill="oklch(80% 0.02 280 / 0.13)"/><ellipse cx="244.5" cy="80.1" rx="90.3" ry="4.9" fill="oklch(80% 0.02 280 / 0.13)"/><ellipse cx="607" cy="81.1" rx="97.8" ry="4.4" fill="oklch(80% 0.02 280 / 0.13)"/><ellipse cx="336.8" cy="85.8" rx="137.2" ry="4" fill="oklch(80% 0.02 280 / 0.13)"/><ellipse cx="795.1" cy="86" rx="101.8" ry="3.8" fill="oklch(80% 0.02 280 / 0.13)"/><ellipse cx="730.2" cy="85.8" rx="120" ry="3.4" fill="oklch(80% 0.02 280 / 0.13)"/><ellipse cx="255.3" cy="84.7" rx="113.3" ry="4.7" fill="oklch(80% 0.02 280 / 0.13)"/></g></svg>`;
    const hw = document.createElement('div');
    hw.className = 'hw';
    hw.setAttribute('aria-hidden', 'true');
    hw.innerHTML = WEB_L + WEB_R + SPIDER('', 24) + SPIDER('hw__spider--r', 52)
      + SOIL + FIELD + BAT + BAT;
    document.body.appendChild(hw);
    /* Hintergrund-Ebene HINTER den Kacheln: Mond am Treffpunkt der drei oberen
       Kacheln + Hexe auf dem Besen, die hin und her fliegt. */
    const WITCH = `<svg class="hwb__witch" viewBox="-14 -24 214 132">
      <defs>
        <linearGradient id="wtStick" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="oklch(64% 0.08 60)"/><stop offset="1" stop-color="oklch(40% 0.07 50)"/></linearGradient>
        <linearGradient id="wtBristle" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="oklch(70% 0.12 70)"/><stop offset="1" stop-color="oklch(86% 0.13 88)"/></linearGradient>
        <linearGradient id="wtCape" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="oklch(46% 0.2 305)"/><stop offset="1" stop-color="oklch(28% 0.14 300)"/></linearGradient>
        <linearGradient id="wtDress" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="oklch(34% 0.12 300)"/><stop offset="1" stop-color="oklch(20% 0.07 300)"/></linearGradient>
        <linearGradient id="wtHat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="oklch(42% 0.17 300)"/><stop offset="1" stop-color="oklch(24% 0.1 300)"/></linearGradient>
        <radialGradient id="wtSkin" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="oklch(80% 0.16 140)"/><stop offset="1" stop-color="oklch(58% 0.15 145)"/></radialGradient>
        <linearGradient id="wtHair" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="oklch(70% 0.18 45)"/><stop offset="1" stop-color="oklch(50% 0.18 30)"/></linearGradient>
      </defs>
      <!-- Glitzerspur -->
      <g class="hwb__sparks" fill="oklch(92% 0.12 90)">
        <path d="M-6 66l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z"/><circle cx="-12" cy="80" r="1.3"/>
        <path d="M2 88l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z"/><circle cx="-2" cy="56" r="1"/><circle cx="8" cy="98" r="1.1"/>
      </g>
      <!-- Besen -->
      <path d="M36 74 C24 66 10 62 -2 63 C6 69 7 73 1 79 C9 81 7 88 -1 95 C12 94 25 88 38 80 Z" fill="url(#wtBristle)"/>
      <path d="M34 73C22 68 12 66 2 66M35 76C22 74 10 76 3 79M35 78C24 81 12 86 3 92M33 75C20 77 10 84 6 88" stroke="oklch(60% 0.11 65)" stroke-width=".8" fill="none"/>
      <path d="M33 71l6 10M37 70l6 10" stroke="oklch(45% 0.12 30)" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M38 75 L182 57" stroke="url(#wtStick)" stroke-width="4.6" stroke-linecap="round"/>
      <path d="M44 73.4 L180 56.4" stroke="oklch(80% 0.06 70 / .45)" stroke-width="1" stroke-linecap="round"/>
      <!-- Katze -->
      <g fill="oklch(14% 0.02 285)" stroke="oklch(62% 0.16 305 / .7)" stroke-width=".8">
        <path d="M58 70c-5-12 0-22 8-22 7 0 10 9 8 18z"/>
        <circle cx="70" cy="47" r="6.5"/>
        <path d="M64.5 44l1-9 5 6zM71 41l5-7 1.5 9z"/>
        <path d="M58 68c-9 1-13-6-10-13 2-4 6-3 5 1" fill="none" stroke="oklch(14% 0.02 285)" stroke-width="3" stroke-linecap="round"/>
      </g>
      <ellipse cx="68" cy="46.5" rx="1.4" ry="1.9" fill="oklch(88% 0.18 100)"/><ellipse cx="73" cy="46.5" rx="1.4" ry="1.9" fill="oklch(88% 0.18 100)"/>
      <!-- Umhang -->
      <path d="M126 46 C108 38 90 42 72 60 C84 58 92 62 96 72 C106 64 116 62 128 68 Z" fill="url(#wtCape)"/>
      <path d="M118 46 C104 46 92 54 84 62M122 52 C110 54 102 60 98 68" stroke="oklch(58% 0.2 310 / .55)" stroke-width="1.1" fill="none"/>
      <!-- Haare -->
      <path d="M136 26 C124 28 116 38 108 52 C118 46 124 44 128 46 C122 52 118 58 116 66 C126 58 132 50 136 40 Z" fill="url(#wtHair)"/>
      <path d="M132 30C124 36 118 46 113 56M134 36C128 44 124 52 121 60" stroke="oklch(80% 0.15 55 / .6)" stroke-width=".9" fill="none"/>
      <!-- Kleid / Körper -->
      <path d="M116 72 C114 54 122 40 136 40 C146 40 150 52 148 72 Z" fill="url(#wtDress)"/>
      <path d="M124 70 C124 58 128 48 136 44" stroke="oklch(52% 0.16 305 / .5)" stroke-width="1.1" fill="none"/>
      <!-- Bein mit Ringelstrumpf + Stiefel -->
      <path d="M132 70 L142 88 L148 86 L140 68 Z" fill="oklch(92% 0.02 280)"/>
      <path d="M134 74l8-3M136 78l8-3M138 82l8-3M140 86l7-2.6" stroke="oklch(30% 0.12 300)" stroke-width="2.2"/>
      <path d="M140 86 L156 88 C160 88 164 84 166 80 C166 86 162 92 156 93 L139 93 Z" fill="oklch(16% 0.02 285)" stroke="oklch(62% 0.16 305 / .7)" stroke-width=".8"/>
      <path d="M143 88h11" stroke="oklch(60% 0.03 285 / .6)" stroke-width=".8"/>
      <!-- Arm mit Ärmel + Hand am Besen -->
      <path d="M138 46 C146 48 154 52 160 58 L156 63 C150 58 144 55 136 54 Z" fill="url(#wtDress)"/>
      <path d="M156 56l6 7-4 2-5-6z" fill="oklch(40% 0.17 305)"/>
      <circle cx="162.5" cy="59.5" r="3.4" fill="url(#wtSkin)"/>
      <!-- Kopf -->
      <circle cx="141" cy="30" r="8.5" fill="url(#wtSkin)"/>
      <path d="M148 29 C154 30 158 33 160 37 C156 36 152 35 148 34 Z" fill="oklch(66% 0.16 142)"/>
      <circle cx="157" cy="35.5" r="1" fill="oklch(50% 0.13 145)"/>
      <path d="M142 35.5 q3 2 6 0" stroke="oklch(30% 0.08 20)" stroke-width="1" fill="none" stroke-linecap="round"/>
      <ellipse cx="145" cy="28" rx="1.4" ry="1.8" fill="oklch(18% 0.03 285)"/><circle cx="145.5" cy="27.3" r=".5" fill="#fff"/>
      <path d="M142.5 24.8l4.5-1" stroke="oklch(25% 0.05 30)" stroke-width="1" stroke-linecap="round"/>
      <!-- Hut: Krempe, geknickte Spitze, Band mit Schnalle -->
      <ellipse cx="140" cy="22" rx="21" ry="4.4" transform="rotate(-8 140 22)" fill="url(#wtHat)"/>
      <path d="M127 22 C130 8 136 -6 146 -14 C146 -7 150 -2 158 0 C150 3 150 10 152 20 Z" fill="url(#wtHat)"/>
      <path d="M129 17.5 L152 14.5 L152.6 19.6 L129.6 22.6 Z" fill="oklch(66% 0.18 50)"/>
      <rect x="138" y="14.6" width="5.6" height="5.6" rx="1" transform="rotate(-8 141 17.4)" fill="none" stroke="oklch(86% 0.14 88)" stroke-width="1.3"/>
      <path d="M131 8 C134 0 139 -7 145 -12" stroke="oklch(62% 0.2 310 / .5)" stroke-width="1" fill="none"/>
    </svg>`;
    /* Mond mit Meeren, Kratern, Körnung und Randabdunklung (einmal gerastert, statisch) */
    const MOON = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="mBase" cx="42%" cy="40%" r="62%"><stop offset="0" stop-color="oklch(97% 0.02 92)"/><stop offset="0.7" stop-color="oklch(88% 0.03 85)"/><stop offset="1" stop-color="oklch(70% 0.04 75)"/></radialGradient><radialGradient id="mCr"><stop offset="0" stop-color="oklch(70% 0.03 80 / 0.55)"/><stop offset="0.75" stop-color="oklch(74% 0.03 80 / 0.35)"/><stop offset="1" stop-color="oklch(98% 0.02 90 / 0)"/></radialGradient><radialGradient id="mLimb" cx="50%" cy="50%" r="50%"><stop offset="0.72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="oklch(30% 0.03 70)" stop-opacity="0.45"/></radialGradient><filter id="mBlur"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="mNoise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.33  0 0 0 0 0.28  0 0 0 0.28 0"/></filter><clipPath id="mClip"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#mClip)"><circle cx="50" cy="50" r="50" fill="url(#mBase)"/><g fill="oklch(62% 0.025 80)" opacity="0.55" filter="url(#mBlur)"><path d="M30 30c6-8 18-9 24-3 5 5 2 12-5 13-6 1-8 6-14 6-7 0-11-9-5-16z"/><path d="M55 22c7-3 15 0 16 6 1 5-5 7-10 6-6-1-11-8-6-12z"/><path d="M58 44c8-2 17 3 17 10s-8 10-14 8c-7-2-11-6-11-10 0-4 3-7 8-8z"/><path d="M36 56c6-1 10 3 9 8-1 6-8 8-12 5-5-3-3-12 3-13z"/><path d="M24 46c3-2 7 0 7 3s-4 5-7 4-3-5 0-7z"/></g><circle cx="18.3" cy="37.5" r="3.1" fill="url(#mCr)"/><circle cx="17.5" cy="36.7" r="2.9" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.38"/><circle cx="28.4" cy="48.9" r="3.2" fill="url(#mCr)"/><circle cx="27.6" cy="48.1" r="2.9" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.38"/><circle cx="26.1" cy="48.2" r="2.0" fill="url(#mCr)"/><circle cx="25.6" cy="47.7" r="1.8" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.25"/><circle cx="58.9" cy="56.0" r="4.6" fill="url(#mCr)"/><circle cx="57.8" cy="54.8" r="4.2" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.55"/><circle cx="59.7" cy="25.2" r="1.6" fill="url(#mCr)"/><circle cx="59.4" cy="24.8" r="1.5" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.25"/><circle cx="87.0" cy="45.8" r="1.4" fill="url(#mCr)"/><circle cx="86.7" cy="45.5" r="1.3" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.25"/><circle cx="45.8" cy="46.2" r="4.0" fill="url(#mCr)"/><circle cx="44.8" cy="45.2" r="3.7" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.48"/><circle cx="47.7" cy="49.6" r="1.3" fill="url(#mCr)"/><circle cx="47.4" cy="49.3" r="1.2" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.25"/><circle cx="50.1" cy="51.1" r="2.0" fill="url(#mCr)"/><circle cx="49.6" cy="50.6" r="1.9" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.25"/><circle cx="21.1" cy="61.3" r="3.2" fill="url(#mCr)"/><circle cx="20.3" cy="60.5" r="2.9" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.38"/><circle cx="38.4" cy="35.9" r="3.4" fill="url(#mCr)"/><circle cx="37.5" cy="35.0" r="3.2" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.41"/><circle cx="40.4" cy="52.6" r="4.0" fill="url(#mCr)"/><circle cx="39.3" cy="51.6" r="3.7" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.49"/><circle cx="79.0" cy="49.2" r="5.5" fill="url(#mCr)"/><circle cx="77.6" cy="47.8" r="5.1" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.66"/><circle cx="46.7" cy="57.5" r="4.2" fill="url(#mCr)"/><circle cx="45.7" cy="56.5" r="3.9" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.51"/><circle cx="76.0" cy="62.3" r="2.4" fill="url(#mCr)"/><circle cx="75.4" cy="61.7" r="2.2" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.29"/><circle cx="58.2" cy="38.2" r="2.9" fill="url(#mCr)"/><circle cx="57.4" cy="37.5" r="2.7" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.35"/><circle cx="50.0" cy="50.0" r="5.3" fill="url(#mCr)"/><circle cx="48.7" cy="48.7" r="4.9" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.64"/><circle cx="65.1" cy="40.5" r="2.1" fill="url(#mCr)"/><circle cx="64.5" cy="40.0" r="1.9" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.25"/><circle cx="48.0" cy="51.5" r="5.4" fill="url(#mCr)"/><circle cx="46.6" cy="50.2" r="5.0" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.65"/><circle cx="51.7" cy="40.4" r="3.9" fill="url(#mCr)"/><circle cx="50.8" cy="39.4" r="3.6" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.47"/><circle cx="31.6" cy="82.2" r="1.6" fill="url(#mCr)"/><circle cx="31.2" cy="81.8" r="1.4" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.25"/><circle cx="56.5" cy="55.9" r="4.5" fill="url(#mCr)"/><circle cx="55.3" cy="54.8" r="4.1" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.54"/><circle cx="78.4" cy="61.2" r="1.6" fill="url(#mCr)"/><circle cx="78.0" cy="60.8" r="1.5" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.25"/><circle cx="34.1" cy="43.8" r="2.0" fill="url(#mCr)"/><circle cx="33.7" cy="43.3" r="1.8" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.25"/><circle cx="49.4" cy="45.1" r="2.0" fill="url(#mCr)"/><circle cx="48.9" cy="44.6" r="1.9" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.25"/><circle cx="61.3" cy="60.1" r="4.0" fill="url(#mCr)"/><circle cx="60.3" cy="59.1" r="3.7" fill="none" stroke="oklch(98% 0.02 90 / 0.35)" stroke-width="0.48"/><rect width="100" height="100" filter="url(#mNoise)"/><circle cx="50" cy="50" r="50" fill="url(#mLimb)"/></g></svg>`;
    const hwb = document.createElement('div');
    hwb.className = 'hwb';
    hwb.setAttribute('aria-hidden', 'true');
    hwb.innerHTML = '<div class="hwb__moon">' + MOON + '</div>';
    document.body.appendChild(hwb);
    /* Eigene Ebene für die Hexe: meist hinter den Kacheln, ab und zu davor */
    const hwf = document.createElement('div');
    hwf.className = 'hwf';
    hwf.setAttribute('aria-hidden', 'true');
    hwf.innerHTML = '<div class="hwb__flyer">' + WITCH + '</div>';
    document.body.appendChild(hwf);

    /* Mond genau an den Punkt setzen, wo Uhr-, Wetter- und rechte Kachel zusammentreffen */
    const placeMoon = () => {
      const c = document.querySelector('.tile--clock'), w = document.querySelector('.tile--weather');
      if (!c || !w) return;
      const cr = c.getBoundingClientRect(), wr = w.getBoundingClientRect();
      const m = hwb.querySelector('.hwb__moon');
      m.style.left = `${wr.right + (cr.right - wr.right) * 0 + 6}px`;
      m.style.top = `${cr.bottom + (wr.top - cr.bottom) / 2}px`;
    };
    placeMoon();
    window.addEventListener('resize', placeMoon);

    if (!reduced) {
      /* Hexe: fliegt nach rechts, wendet, fliegt zurück (andere Höhe) */
      const flyer = hwf.querySelector('.hwb__flyer');
      /* Hexe – jeder Flug komplett zufällig:
         · abwechselnd vorne (über den Kacheln) und hinten (in Lücken/Rändern sichtbar)
         · manchmal Ebenenwechsel mitten im Flug (taucht ab / kommt hervor)
         · 3–6 zufällige Wegpunkte über die ganze Höhe → schräg, steigend, fallend
         · zufällige Wellen, gelegentlich ein Looping, Neigung folgt der Flugrichtung
         · vorne grösser, hinten kleiner (Tiefe); Tempo und Pausen zufällig */
      const rnd = (a, b) => a + Math.random() * (b - a);
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      let pass = 0;
      /* Mittelpunkt einer Kachel in vw/vh (für «taucht vor der Wetter-Kachel auf») */
      const tileCenter = (sel) => {
        const r = document.querySelector(sel)?.getBoundingClientRect();
        return r ? [((r.left + r.width / 2) / innerWidth) * 100 - 12, ((r.top + r.height / 2) / innerHeight) * 100 - 4] : [30, 20];
      };
      const fly = () => {
        let front = pass++ % 2 === 0;
        const dir = Math.random() < 0.5 ? 1 : -1;               /* 1 = Ausflug nach rechts */
        const xA = dir === 1 ? -30 : 106, xB = dir === 1 ? 106 : -30;
        /* Szenario: quer (meist), von unten auf (taucht vor der Wetter-Kachel auf), Sturz von oben */
        const r = Math.random();
        const scenario = r < 0.55 ? 'cross' : r < 0.8 ? 'rise' : 'dive';
        let switchAt = Math.random() < 0.35 ? rnd(0.3, 0.7) : -1;

        const wp = [];
        if (scenario === 'cross') {
          const m = 3 + Math.floor(Math.random() * 4);
          for (let i = 0; i < m; i++) {
            const t = i / (m - 1);
            wp.push([xA + (xB - xA) * t + (i && i < m - 1 ? rnd(-8, 8) : 0), rnd(-4, 88)]);
          }
        } else if (scenario === 'rise') {
          /* von unten hinter den News hoch, vor der Wetter-Kachel auftauchen, dann zur Seite raus */
          const [cx, cy] = tileCenter('.tile--weather');
          wp.push([rnd(10, 70), 108], [cx + rnd(-10, 10), rnd(55, 70)], [cx + rnd(-6, 6), cy + rnd(-6, 6)],
                  [cx + dir * rnd(15, 30), cy - rnd(5, 15)], [xB, rnd(-4, 30)]);
          front = false;
          switchAt = rnd(0.4, 0.5);
        } else {
          /* Sturzflug von oben schräg nach unten, unten oder seitlich raus */
          wp.push([rnd(10, 80), -20], [rnd(15, 75), rnd(20, 40)], [rnd(15, 75), rnd(50, 80)],
                  Math.random() < 0.5 ? [xB, rnd(60, 90)] : [rnd(10, 80), 110]);
        }
        const m = wp.length;
        hwf.classList.toggle('is-front', front);
        /* Catmull-Rom durch die Wegpunkte, dazu Wellen */
        const N = 36, pts = [];
        const waveA = Math.random() < 0.6 ? rnd(1, 5) : 0, waveF = rnd(1, 4), waveP = rnd(0, 6);
        for (let k = 0; k <= N; k++) {
          const u = (k / N) * (m - 1), i = Math.min(Math.floor(u), m - 2), f = u - i;
          const p0 = wp[i - 1] || wp[i], p1 = wp[i], p2 = wp[i + 1], p3 = wp[i + 2] || p2;
          const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
          const x = cr(p0[0], p1[0], p2[0], p3[0]);
          const y = cr(p0[1], p1[1], p2[1], p3[1]) + Math.sin((k / N) * Math.PI * 2 * waveF + waveP) * waveA;
          pts.push([x, clamp(y, -25, 112)]);
        }
        const size = front ? rnd(0.9, 1.25) : rnd(0.6, 0.9);
        const loopAt = Math.random() < 0.3 ? Math.floor(rnd(8, N - 12)) : -1;
        const frames = pts.map(([x, y], k) => {
          const [nx, ny] = pts[Math.min(k + 1, N)], [px, py] = pts[Math.max(k - 1, 0)];
          /* Bildschirm-Seitenverhältnis 9:16 → vh in vw-Einheiten umrechnen für den Winkel */
          const dy = (ny - py) * 1.78, dx = Math.abs(nx - px) || 1;
          let rot = clamp(dir * Math.atan2(dy, dx) * 57.3, -28, 28);
          if (loopAt >= 0 && k > loopAt) rot -= dir * 360 * Math.min(1, (k - loopAt) / 6);
          return { transform: `translate(${x}vw, ${y}vh) rotate(${rot}deg) scale(${dir * size}, ${size})` };
        });
        const dur = rnd(13000, 26000);
        const anim = flyer.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' });

        /* Ebenenwechsel mitten im Flug (bei «rise» immer: von hinten nach vorne) */
        if (switchAt > 0) setTimeout(() => hwf.classList.toggle('is-front'), dur * switchAt);

        anim.onfinish = () => setTimeout(fly, rnd(4000, 14000));
      };
      flyer.style.transform = 'translate(-40vw, 0)';
      fly();
      flyer.querySelectorAll('.hwb__sparks > *').forEach((sp, i) => sp.animate(
        [{ opacity: 0.2, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.2)' }, { opacity: 0.2, transform: 'scale(.6)' }],
        { duration: 900 + i * 230, iterations: Infinity, easing: 'ease-in-out' }));
      flyer.querySelector('svg').animate(
        [{ transform: 'translateY(0) rotate(-3deg)' }, { transform: 'translateY(-1.4vh) rotate(3deg)' },
         { transform: 'translateY(0) rotate(-3deg)' }],
        { duration: 2600, iterations: Infinity, easing: 'ease-in-out' });
    }

    document.documentElement.dataset.halloween = 'on';   /* News rückt hoch → Platz für den Kürbis */

    if (!reduced) {
      /* Spinne seilt sich ab: Faden bleibt oben fest und wird nur länger/kürzer,
         der Körper bewegt sich mit dem Fadenende (gleiche Keyframes/Timing). */
      hw.querySelectorAll('.hw__spider').forEach((sp, i) => {
        const len = +sp.dataset.len, d = i ? 4 : 6;
        const steps = [0, d, d * 0.85, 0];
        const opts = { duration: 10000 + i * 3000, delay: -i * 4000, iterations: Infinity, easing: 'ease-in-out' };
        sp.querySelector('.hw__thread').animate(steps.map((v) => ({ transform: `scaleY(${(len + v) / len})` })), opts);
        sp.querySelector('svg').animate(steps.map((v) => ({ transform: `translateY(${v}vh)` })), opts);
      });
      /* Gesichter glimmen reihum auf (versetzt), dazwischen nur schwach */
      const faces = hw.querySelectorAll('.hw__face');
      faces.forEach((f, i) => f.animate(
        [{ opacity: 0.35 }, { opacity: 1, offset: 0.12 }, { opacity: 0.8, offset: 0.2 },
         { opacity: 1, offset: 0.28 }, { opacity: 0.35, offset: 0.45 }, { opacity: 0.35 }],
        { duration: faces.length * 700, delay: -((i * 7) % faces.length) * 700, iterations: Infinity }));
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
