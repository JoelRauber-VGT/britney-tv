/* ════════════════════════════════════════════════════════════════
 * BRITNEY DASHBOARD · WETTER (oben, bei CONFIG.weather.show)
 *
 * Holt die Vorhersage von Open-Meteo (gratis, ohne Key) und zeigt:
 *  - Uhr + Datum
 *  - Jetzt: animiertes Wetter-Icon, Temperatur, Beschreibung, Fakten
 *  - Nächste 24 h: Temperaturkurve + Regenwahrscheinlichkeit
 *  - 7 Tage: Icon, Min/Max als Balken auf einer gemeinsamen Wochenskala
 *
 * Bewegung läuft über die Web Animations API (style.css schaltet CSS-
 * Animationen global ab). Nur transform/opacity → GPU, Pi-tauglich.
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
    + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,relative_humidity_2m'
    + '&hourly=temperature_2m,precipitation_probability,weather_code,is_day'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset'
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

  /* ── SVG-Helfer ── */
  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const loop = (node, frames, opts) => {
    if (reduced || !node) return;
    node.style.transformBox = 'fill-box';
    node.style.transformOrigin = 'center';
    node.animate(frames, { iterations: Infinity, easing: 'ease-in-out', ...opts });
  };

  const C = {
    sun: 'oklch(86% 0.16 85)', sunCore: 'oklch(93% 0.12 95)',
    cloud: 'oklch(93% 0.012 265)', cloudDark: 'oklch(72% 0.02 265)',
    rain: 'oklch(74% 0.13 235)', snow: 'oklch(97% 0.01 250)', bolt: 'oklch(88% 0.17 95)',
    moon: 'oklch(92% 0.04 95)',
  };

  function sun(svg, cx, cy, r, animate) {
    const g = el('g', {}, svg);
    const rays = el('g', { stroke: C.sun, 'stroke-width': r * 0.16, 'stroke-linecap': 'round' }, g);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      el('line', {
        x1: cx + Math.cos(a) * r * 1.45, y1: cy + Math.sin(a) * r * 1.45,
        x2: cx + Math.cos(a) * r * 1.95, y2: cy + Math.sin(a) * r * 1.95,
      }, rays);
    }
    el('circle', { cx, cy, r, fill: C.sunCore, stroke: C.sun, 'stroke-width': r * 0.14 }, g);
    if (animate) {
      loop(rays, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        { duration: 40000, easing: 'linear' });
      loop(g, [{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }],
        { duration: 5000 });
    }
    return g;
  }
  function moon(svg, animate) {
    const g = el('g', {}, svg);
    el('path', { d: 'M58 18a30 30 0 1 0 24 46 26 26 0 1 1-24-46z', fill: C.moon }, g);
    for (const [x, y, r] of [[22, 22, 2.2], [80, 30, 1.6], [30, 82, 1.8]]) {
      const s = el('circle', { cx: x, cy: y, r, fill: C.snow }, svg);
      if (animate) loop(s, [{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }],
        { duration: 2200 + x * 30 });
    }
    return g;
  }
  function cloud(svg, x, y, s, fill, animate) {
    const g = el('g', { transform: `translate(${x} ${y}) scale(${s})`, fill }, svg);
    const inner = el('g', {}, g);
    el('circle', { cx: 34, cy: 56, r: 15 }, inner);
    el('circle', { cx: 52, cy: 44, r: 20 }, inner);
    el('circle', { cx: 70, cy: 56, r: 14 }, inner);
    el('rect', { x: 20, y: 54, width: 64, height: 17, rx: 8.5 }, inner);
    if (animate) loop(inner, [{ transform: 'translateX(-2.5px)' }, { transform: 'translateX(2.5px)' },
      { transform: 'translateX(-2.5px)' }], { duration: 6000 });
    return g;
  }
  function drops(svg, n, color, len, animate, snowy) {
    for (let i = 0; i < n; i++) {
      const x = 32 + i * (40 / Math.max(n - 1, 1));
      const d = snowy
        ? el('circle', { cx: x, cy: 80, r: 3.2, fill: color }, svg)
        : el('line', { x1: x, y1: 76, x2: x - 3, y2: 76 + len, stroke: color,
            'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
      if (animate) {
        d.animate([
          { transform: 'translate(0, -6px)', opacity: 0 },
          { transform: 'translate(0, 0)', opacity: 1, offset: 0.25 },
          { transform: `translate(${snowy ? 3 : -2}px, 14px)`, opacity: 0 },
        ], { duration: snowy ? 2600 : 1000, delay: i * (snowy ? 650 : 260), iterations: Infinity });
      }
    }
  }

  /* Komplettes Icon als <svg>. animate = nur für das grosse Jetzt-Icon. */
  function icon(code, isDay, animate = false) {
    const svg = el('svg', { viewBox: '0 0 100 100', class: 'wx-ico', 'aria-hidden': 'true' });
    const k = kindOf(code);
    const day = isDay !== 0;
    if (k === 'clear') { day ? sun(svg, 50, 50, 19, animate) : moon(svg, animate); return svg; }
    if (k === 'partly') {
      if (day) sun(svg, 36, 36, 14, animate); else el('path', { d: 'M40 12a20 20 0 1 0 16 31 17 17 0 1 1-16-31z', fill: C.moon }, svg);
      cloud(svg, 8, 10, 0.95, C.cloud, animate);
      return svg;
    }
    if (k === 'fog') {
      cloud(svg, 0, -6, 1, C.cloudDark, false);
      for (let i = 0; i < 3; i++) {
        const l = el('line', { x1: 18 + i * 4, y1: 74 + i * 9, x2: 82 - i * 6, y2: 74 + i * 9,
          stroke: C.cloud, 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.8 }, svg);
        if (animate) loop(l, [{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' },
          { transform: 'translateX(-4px)' }], { duration: 4000 + i * 900 });
      }
      return svg;
    }
    const dark = k === 'cloud' ? C.cloud : C.cloudDark;
    if (k !== 'cloud') {
      drops(svg, k === 'drizzle' ? 3 : 4, k === 'snow' ? C.snow : C.rain,
        k === 'drizzle' ? 7 : 12, animate, k === 'snow');
    }
    if (k === 'cloud') cloud(svg, 12, 8, 0.85, C.cloudDark, false);
    cloud(svg, 0, k === 'cloud' ? 14 : -4, 1, dark, animate);
    if (k === 'thunder') {
      const b = el('path', { d: 'M54 62 42 82h10l-6 16 18-24H54l6-12z', fill: C.bolt }, svg);
      if (animate) b.animate([{ opacity: 0 }, { opacity: 0, offset: 0.7 }, { opacity: 1, offset: 0.72 },
        { opacity: 0.2, offset: 0.76 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }],
        { duration: 4200, iterations: Infinity });
    }
    return svg;
  }

  /* ── Halloween-Bausteine ── */
  const WING = '<path d="M63 27C72 14 92 8 117 13c-6 4-8 10-6 17-5-3-11-3-15 2-3-5-9-6-13-1-3-4-9-5-13 0-3-3-6-3-8-2z"/>';
  const BAT = `<svg class="wx-bat" viewBox="0 0 120 64"><g fill="oklch(10% 0.02 285)">
    <g class="wx-bat__wing">${WING}</g>
    <g transform="matrix(-1 0 0 1 120 0)"><g class="wx-bat__wing">${WING}</g></g>
    <ellipse cx="60" cy="33" rx="6.5" ry="11"/><circle cx="60" cy="21" r="6"/>
    <path d="M54.5 19 55 9l4.5 7zM65.5 19 65 9l-4.5 7z"/></g>
    <circle cx="57.6" cy="20.5" r="1.1" fill="oklch(75% 0.18 30)"/><circle cx="62.4" cy="20.5" r="1.1" fill="oklch(75% 0.18 30)"/></svg>`;
  const SPIDER = `<div class="wx-spider" aria-hidden="true"><span class="wx-spider__thread"></span>
    <svg viewBox="0 0 60 50"><g stroke="oklch(12% 0.02 280)" stroke-width="2.5" fill="none" stroke-linecap="round">
    <path d="M22 22 6 10M22 26 2 24M22 30 6 40M24 33 12 48M38 22 54 10M38 26 58 24M38 30 54 40M36 33 48 48"/></g>
    <ellipse cx="30" cy="28" rx="11" ry="13" fill="oklch(12% 0.02 280)"/><circle cx="30" cy="13" r="7" fill="oklch(12% 0.02 280)"/>
    <circle cx="27" cy="12" r="1.6" fill="oklch(70% 0.2 25)"/><circle cx="33" cy="12" r="1.6" fill="oklch(70% 0.2 25)"/></svg></div>`;
  const PUMPKIN = `<svg class="wx-pumpkin" viewBox="0 0 120 104" aria-hidden="true">
    <path d="M58 18c0-8 4-14 10-16l4 4c-5 2-7 6-7 12z" fill="oklch(45% 0.09 130)"/>
    <ellipse cx="34" cy="62" rx="28" ry="38" fill="oklch(58% 0.17 50)"/><ellipse cx="86" cy="62" rx="28" ry="38" fill="oklch(58% 0.17 50)"/>
    <ellipse cx="60" cy="62" rx="30" ry="41" fill="oklch(66% 0.18 55)"/>
    <g class="wx-pumpkin__face" fill="oklch(90% 0.16 90)"><path d="M34 50l12-14 10 14z"/><path d="M64 50l10-14 12 14z"/>
    <path d="M54 62l6-9 6 9z"/><path d="M28 72c10 14 54 14 64 0l-8 3-4 7-6-6-8 7-8-7-6 6-4-7z"/></g></svg>`;

  /* ── Formatierung ── */
  const fmtTime = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  const fmtDate = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  const fmtDay  = new Intl.DateTimeFormat('de-CH', { weekday: 'short', timeZone: TZ });
  const deg = (t) => `${Math.round(t)}°`;

  /* Temperatur → Farbe (kalt blau … warm orange/rot) */
  function tColor(t) {
    const stops = [[-10, 250], [0, 230], [8, 195], [15, 140], [22, 80], [28, 50], [35, 25]];
    let h = stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      const [t0, h0] = stops[i - 1], [t1, h1] = stops[i];
      if (t <= t1) { h = h0 + (h1 - h0) * Math.max(0, (t - t0) / (t1 - t0)); break; }
      h = h1;
    }
    return `oklch(76% 0.14 ${h.toFixed(0)})`;
  }

  /* ── Uhr ── */
  function tickClock() {
    const now = new Date();
    $('wxClock').textContent = fmtTime.format(now);
    $('wxDate').textContent = fmtDate.format(now);
  }
  $('wxCity').textContent = W.city;
  tickClock();
  setInterval(tickClock, 5000);

  /* ── Rendern ── */
  function fadeIn(node, i, extra = {}) {
    if (reduced) return;
    node.animate([{ opacity: 0, transform: 'translateY(1.2vh)' }, { opacity: 1, transform: 'none' }],
      { duration: 700, delay: 120 + i * 90, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards', ...extra });
  }

  let lastKey = '';
  function render(d, animateIn) {
    const cur = d.current;
    const iconBox = $('wxIcon');
    const key = `${cur.weather_code}-${cur.is_day}`;
    if (key !== lastKey) {                   /* Icon nur neu bauen, wenn sich das Wetter ändert */
      iconBox.replaceChildren(icon(cur.weather_code, cur.is_day, true));
      lastKey = key;
    }
    $('wxTemp').textContent = deg(cur.temperature_2m);
    $('wxDesc').textContent = TEXT[cur.weather_code] || '';
    const today = 0;
    $('wxFacts').innerHTML =
      `Gefühlt <b>${deg(cur.apparent_temperature)}</b> · Wind <b>${Math.round(cur.wind_speed_10m)} km/h</b>`
      + ` · Feuchte <b>${cur.relative_humidity_2m}%</b>`;
    $('wxSun').innerHTML = `Sonne <b>${d.daily.sunrise[today].slice(11)}</b> – <b>${d.daily.sunset[today].slice(11)}</b>`;

    renderDays(d, animateIn);    /* zuerst: bestimmt die Höhe der Zeile */
    renderHours(d, animateIn);
    $('wxStamp').textContent = `Open-Meteo · ${fmtTime.format(new Date())}`;
  }

  /* Nächste 24 h: glatte Kurve (Catmull-Rom → Bézier) + Regenbalken */
  function renderHours(d, animateIn) {
    const box = $('wxHours');
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const nowIso = d.current.time.slice(0, 13);
    let start = d.hourly.time.findIndex((t) => t.slice(0, 13) === nowIso);
    if (start < 0) start = 0;
    const N = 24;
    const T = d.hourly.temperature_2m.slice(start, start + N + 1);
    const P = d.hourly.precipitation_probability.slice(start, start + N + 1);
    const H = d.hourly.time.slice(start, start + N + 1);
    if (T.length < 2) return;

    const padX = w * 0.035, top = h * 0.2, bottom = h * 0.56, rainTop = h * 0.64, rainH = h * 0.18;
    const lo = Math.min(...T) - 1, hi = Math.max(...T) + 1;
    const X = (i) => padX + (i * (w - 2 * padX)) / (T.length - 1);
    const Y = (t) => bottom - ((t - lo) / (hi - lo)) * (bottom - top);
    const pts = T.map((t, i) => [X(i), Y(t)]);

    let path = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      path += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6},`
        + `${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6},${p2[0]} ${p2[1]}`;
    }

    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'wx-chart' });
    const defs = el('defs', {}, svg);
    const gl = el('linearGradient', { id: 'wxLine', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    T.forEach((t, i) => el('stop', { offset: i / (T.length - 1), 'stop-color': tColor(t) }, gl));
    const ga = el('linearGradient', { id: 'wxArea', x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': 'oklch(80% 0.1 220)', 'stop-opacity': 0.28 }, ga);
    el('stop', { offset: 1, 'stop-color': 'oklch(80% 0.1 220)', 'stop-opacity': 0 }, ga);

    /* Regenbalken ganz unten */
    const bw = ((w - 2 * padX) / (T.length - 1)) * 0.38;
    const rain = el('g', { fill: 'oklch(72% 0.13 235)' }, svg);
    P.forEach((p, i) => {
      if (!p) return;
      const bh = Math.max((p / 100) * rainH, 2);
      el('rect', { x: X(i) - bw / 2, y: rainTop + rainH - bh, width: bw, height: bh,
        rx: Math.min(bw / 2, 3), opacity: 0.3 + (p / 100) * 0.6 }, rain);
    });

    const area = el('path', { d: `${path} L${X(T.length - 1)} ${rainTop - h * 0.02} L${X(0)} ${rainTop - h * 0.02} Z`,
      fill: 'url(#wxArea)' }, svg);
    const line = el('path', { d: path, fill: 'none', stroke: 'url(#wxLine)', 'stroke-width': h * 0.035,
      'stroke-linecap': 'round' }, svg);

    /* Beschriftung alle 3 h */
    const labels = el('g', { class: 'wx-chart__labels' }, svg);
    for (let i = 0; i < T.length; i += 3) {
      el('circle', { cx: X(i), cy: Y(T[i]), r: h * 0.025, fill: tColor(T[i]) }, labels);
      const tt = el('text', { x: X(i), y: Y(T[i]) - h * 0.08, 'text-anchor': 'middle', class: 'wx-chart__t' }, labels);
      tt.textContent = deg(T[i]);
      const hh = el('text', { x: X(i), y: h - h * 0.01, 'text-anchor': i === 0 ? 'start' : 'middle',
        class: 'wx-chart__h' }, labels);
      if (i === 0) hh.setAttribute('x', X(0) - padX * 0.6);
      hh.textContent = i === 0 ? 'Jetzt' : H[i].slice(11, 13);
    }
    /* Jetzt-Punkt pulsiert */
    const pulse = el('circle', { cx: X(0), cy: Y(T[0]), r: h * 0.05, fill: tColor(T[0]), opacity: 0.4 }, svg);
    loop(pulse, [{ transform: 'scale(0.6)', opacity: 0.6 }, { transform: 'scale(1.6)', opacity: 0 }],
      { duration: 2400, easing: 'ease-out' });

    box.replaceChildren(svg);

    if (animateIn && !reduced) {
      const len = line.getTotalLength();
      line.style.strokeDasharray = len;
      line.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        { duration: 1800, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards', delay: 300 });
      area.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1200, delay: 900, fill: 'backwards' });
      labels.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 1400, fill: 'backwards' });
      rain.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
        { duration: 900, delay: 1100, fill: 'backwards' });
    }
  }

  /* 7 Tage: senkrechte Min/Max-Balken auf gemeinsamer Wochenskala */
  function renderDays(d, animateIn) {
    const box = $('wxDays');
    const dl = d.daily;
    const lo = Math.min(...dl.temperature_2m_min), hi = Math.max(...dl.temperature_2m_max);
    const span = Math.max(hi - lo, 1);
    box.querySelectorAll('.wx__day').forEach((n) => n.remove());
    dl.time.forEach((day, i) => {
      const col = document.createElement('div');
      col.className = 'wx__day' + (i === 0 ? ' is-today' : '');
      const name = i === 0 ? 'Heute' : fmtDay.format(new Date(`${day}T12:00:00`)).replace('.', '');
      const mx = dl.temperature_2m_max[i], mn = dl.temperature_2m_min[i];
      const topPct = ((hi - mx) / span) * 100, botPct = ((mn - lo) / span) * 100;
      const rain = dl.precipitation_probability_max[i];
      col.innerHTML = `
        <p class="wx__dname">${name}</p>
        <div class="wx__dicon"></div>
        <p class="wx__dmax">${deg(mx)}</p>
        <div class="wx__drange"><span class="wx__dbar" style="top:${topPct}%;bottom:${botPct}%;
          background:linear-gradient(to top, ${tColor(mn)}, ${tColor(mx)})"></span></div>
        <p class="wx__dmin">${deg(mn)}</p>
        <p class="wx__drain${rain >= 50 ? ' is-wet' : ''}">
          <svg viewBox="0 0 10 14" aria-hidden="true"><path d="M5 0C3 4 0 6.5 0 9a5 5 0 0 0 10 0C10 6.5 7 4 5 0z"/></svg>${rain ?? 0}%</p>`;
      col.querySelector('.wx__dicon').appendChild(icon(dl.weather_code[i], 1, false));
      box.appendChild(col);
      if (animateIn) {
        fadeIn(col, i);
        if (!reduced) col.querySelector('.wx__dbar').animate(
          [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
          { duration: 900, delay: 500 + i * 90, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
      }
    });
  }

  /* ── Laden ── */
  let data = null;
  try { data = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (_) {}
  let first = true;
  if (data) { render(data, true); first = false; }

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
  window.addEventListener('resize', () => { if (data) renderHours(data, false); });

  /* Einblenden des Kopfbereichs */
  document.querySelectorAll('.wx-tile').forEach((n, i) => fadeIn(n, i));

  /* ── Halloween (weather.halloween: 'auto' | true | false) ── */
  const today = new Date();
  const hwOn = W.halloween === true
    || (W.halloween === 'auto' && today.getMonth() === 9);   /* Oktober */
  if (hwOn) halloween();

  function halloween() {
    document.documentElement.dataset.halloween = 'on';
    /* Countdown in der Fusszeile */
    const hw = $('wxHalloween');
    const target = new Date(today.getFullYear(), 9, 31);
    const days = Math.round((target - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000);
    hw.innerHTML = PUMPKIN + '<span>' + (days > 1 ? `Noch <b>${days} Tage</b> bis Halloween`
      : days === 1 ? 'Morgen ist <b>Halloween</b>' : '<b>Happy Halloween!</b>') + '</span>';
    hw.hidden = false;

    /* Fledermäuse über dem Himmel */
    const sky = document.createElement('div');
    sky.className = 'wx-bats';
    sky.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) sky.insertAdjacentHTML('beforeend', BAT);
    document.body.appendChild(sky);
    sky.querySelectorAll('.wx-bat').forEach((b, i) => {
      if (reduced) return;
      b.animate([
        { transform: 'translate(-15vw, 0)' }, { transform: 'translate(35vw, -2vh)' },
        { transform: 'translate(70vw, 3vh)' }, { transform: 'translate(115vw, -1vh)' },
      ], { duration: 22000 + i * 7000, delay: -i * 9000, iterations: Infinity });
      b.querySelectorAll('.wx-bat__wing').forEach((w) => w.animate([
        { transform: 'rotate(18deg) scaleY(0.9)' }, { transform: 'rotate(-28deg)' },
        { transform: 'rotate(18deg) scaleY(0.9)' },
      ], { duration: 420 + i * 90, iterations: Infinity, easing: 'ease-in-out' }));
    });

    /* Spinne hängt an der Uhr-Kachel */
    const tile = $('wxDays');   /* Container bleibt bestehen; Spinne hängt unter der letzten Tageskachel */
    tile.insertAdjacentHTML('beforeend', SPIDER);
    const sp = tile.querySelector('.wx-spider');
    if (!reduced) sp.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(3.5vh)' },
      { transform: 'translateY(3vh)' }, { transform: 'translateY(0)' }],
      { duration: 9000, iterations: Infinity, easing: 'ease-in-out' });

    /* Kürbis-Gesicht glimmt */
    hw.querySelectorAll('.wx-pumpkin__face').forEach((f) => {
      if (!reduced) f.animate([{ opacity: 1 }, { opacity: 0.65 }, { opacity: 0.95 }, { opacity: 0.75 }, { opacity: 1 }],
        { duration: 2400, iterations: Infinity });
    });
  }
})();
