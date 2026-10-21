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
    const WEB = (side) => `<svg class="hw__web %s" viewBox="0 0 100 100"> <g fill="none" stroke="oklch(94% 0.01 280 / 0.6)" stroke-linecap="round" vector-effect="non-scaling-stroke"> <path d="M0 16Q34 38 84 100" stroke-width="1.1"/> <path d="M0 100L14.2 26.4 M0 100L29.8 40.0 M0 100L46.6 56.8 M0 100L64.6 76.8" stroke-width="0.8"/> <path d="M0.0 81.5Q1.4 84.7 3.1 83.8Q4.3 87.1 6.5 86.8Q7.4 90.0 10.2 90.5Q10.8 93.6 14.2 94.9Q14.4 97.8 18.5 100.0 M0.0 66.4Q2.5 72.3 5.7 70.6Q7.7 76.5 11.9 76.0Q13.4 81.8 18.6 82.7Q19.6 88.3 25.9 90.7Q26.2 95.9 33.6 100.0 M0.0 51.3Q3.6 59.8 8.3 57.3Q11.2 65.9 17.3 65.2Q19.5 73.7 27.0 74.9Q28.4 83.1 37.5 86.5Q37.9 94.1 48.7 100.0 M0.0 36.2Q4.8 47.3 10.8 44.1Q14.7 55.3 22.6 54.4Q25.5 65.5 35.4 67.2Q37.2 77.8 49.1 82.4Q49.7 92.2 63.8 100.0 M0.0 22.7Q5.8 36.2 13.1 32.3Q17.8 45.9 27.4 44.8Q30.9 58.2 42.8 60.3Q45.0 73.1 59.5 78.7Q60.2 90.6 77.3 100.0" stroke-width="0.6"/> </g> </svg>`.replace('%s', `hw__web--${side}`);
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

    const hw = document.createElement('div');
    hw.className = 'hw';
    hw.setAttribute('aria-hidden', 'true');
    hw.innerHTML = WEB('l') + WEB('r') + SPIDER('', '24vh') + SPIDER('hw__spider--r', '52vh')
      + PUMPKIN('hw__pumpkin--c') + BAT + BAT;
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
