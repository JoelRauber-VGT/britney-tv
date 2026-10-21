/* ════════════════════════════════════════════════════════════════
 * BRITNEY DASHBOARD · DATEN
 *
 * Reines Daten-Dashboard für den 75″-Hochformat-Kiosk (1080×1920):
 *  - Oben   · Projekt-Countdown
 *  - Mitte  · Forschungskooperation VGT × FHNW (Logos, statisch)
 *  - Unten  · IQ-Stand (vom Team über die Laufzeit hochgesetzt)
 *
 * Live-Änderung ohne Reload möglich:  britney.setIQ(85)
 * (CONFIG kommt aus config.js — als klassisches Script davor geladen,
 *  damit die Seite ohne Webserver direkt über file:// läuft.)
 * ════════════════════════════════════════════════════════════════ */

const cfg = CONFIG;
const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Hintergrund-Modus (aurora | static | off) auf <html> setzen → steuert die CSS.
   Bei prefers-reduced-motion fällt 'aurora' automatisch auf 'static' zurück. */
(() => {
  let bg = cfg.background || 'aurora';
  if (bg === 'aurora' && reducedMotion) bg = 'static';
  document.documentElement.dataset.bg = bg;
})();

/* Jede Ziffer in einen eigenen, gleich breiten Slot (<span class="dig">) legen.
   Die Display-Serife (Fraunces) hat KEINE Tabellenziffern — ohne feste Slots
   würde der Countdown sekündlich in der Breite zappeln. Aktualisiert nur, was
   sich ändert (kein unnötiges DOM-Neubauen pro Sekunde). */
function setDigits(el, str) {
  str = String(str);
  const kids = el.children;
  if (kids.length !== str.length) {
    el.textContent = '';
    for (const ch of str) {
      const s = document.createElement('span');
      s.className = 'dig';
      s.textContent = ch;
      el.appendChild(s);
    }
    return;
  }
  for (let i = 0; i < str.length; i++) {
    if (kids[i].textContent !== str[i]) kids[i].textContent = str[i];
  }
}

/* ── Texte aus der Config setzen ── */
const phaseEl = $('phase');
if (phaseEl) {
  phaseEl.textContent = cfg.project.phase;
  if (!cfg.project.phase) phaseEl.remove();
}
if ($('caption')) $('caption').innerHTML = cfg.collab.caption.replace(
  /»(.+?)«/, '<strong>$1</strong>');

/* ════════════════════════════════════════════════════════════════
 * 0 · GRABSTEIN-MODUS (config: grave.show)
 * Ganzer Schirm = Grabstein. News + Video werden aus dem DOM genommen,
 * damit news.js gar nicht erst startet. Bewegung (Kerzen, Geist) läuft
 * über die Web Animations API, weil style.css CSS-Animationen global abschaltet.
 * ════════════════════════════════════════════════════════════════ */
const G = cfg.grave || {};
if (G.show) {
  document.documentElement.dataset.mode = 'grave';
  $('grave').hidden = false;
  for (const id of ['news', 'britney']) { const n = $(id); if (n) n.remove(); }
  const set = (id, v) => { const el = $(id); if (!el) return; if (v) el.textContent = v; else el.remove(); };
  set('graveKicker', G.kicker); set('graveName', G.name); set('graveSub', G.sub);
  set('graveDates', G.dates);   set('graveEpitaph', G.epitaph); set('graveNote', G.note);
  set('graveFooter', G.footer);

  if (G.animate !== false && !reducedMotion) {
    /* Kerzen: unregelmässiges Flackern, beide leicht versetzt */
    document.querySelectorAll('.grave__flame').forEach((f, i) => {
      f.animate([
        { transform: 'scale(1, 1) rotate(-2deg)',    opacity: 0.95 },
        { transform: 'scale(0.92, 1.08) rotate(2deg)', opacity: 1 },
        { transform: 'scale(1.04, 0.94) rotate(-1deg)', opacity: 0.85 },
        { transform: 'scale(0.96, 1.05) rotate(3deg)', opacity: 1 },
        { transform: 'scale(1, 1) rotate(-2deg)',    opacity: 0.95 },
      ], { duration: 1700 + i * 430, iterations: Infinity, easing: 'ease-in-out' });
    });
    /* Geist: schwebt gemächlich auf und ab und kippt leicht */
    $('graveGhost').animate([
      { transform: 'translate(0, 0) rotate(-4deg)' },
      { transform: 'translate(-1.5vw, -2.2vh) rotate(3deg)' },
      { transform: 'translate(0, 0) rotate(-4deg)' },
    ], { duration: 7000, iterations: Infinity, easing: 'ease-in-out' });

    if (G.halloween !== false) {
      /* Fledermäuse: fliegen in Schleifen über den Himmel und flattern */
      document.querySelectorAll('.grave__bat').forEach((b, i) => {
        const dur = 16000 + i * 5000;
        b.animate([
          { transform: 'translate(-20vw, 6vh)' },
          { transform: 'translate(25vw, -2vh)' },
          { transform: 'translate(70vw, 8vh)' },
          { transform: 'translate(120vw, 0vh)' },
        ], { duration: dur, delay: -i * 6000, iterations: Infinity, easing: 'linear' });
        b.querySelectorAll('.grave__wing').forEach((w) => w.animate([
          { transform: 'rotate(18deg) scaleY(0.9)' },
          { transform: 'rotate(-28deg) scaleY(1)' },
          { transform: 'rotate(18deg) scaleY(0.9)' },
        ], { duration: 420 + i * 90, iterations: Infinity, easing: 'ease-in-out' }));
      });
      /* Spinne: seilt sich langsam ab und klettert wieder hoch */
      const sp = $('graveSpider');
      if (sp) sp.animate([
        { transform: 'translateY(0)' }, { transform: 'translateY(5vh)' },
        { transform: 'translateY(4.4vh)' }, { transform: 'translateY(0)' },
      ], { duration: 9000, iterations: Infinity, easing: 'ease-in-out' });
      /* Kürbis-Gesichter glimmen */
      document.querySelectorAll('.grave__pumpkin-face').forEach((f, i) => {
        f.animate([{ opacity: 1 }, { opacity: 0.72 }, { opacity: 0.95 }, { opacity: 0.8 }, { opacity: 1 }],
          { duration: 2300 + i * 700, iterations: Infinity });
      });
      /* Bodennebel driftet */
      document.querySelectorAll('.grave__fog').forEach((f) => {
        f.animate([{ transform: 'translateX(-10vw)' }, { transform: 'translateX(0)' }, { transform: 'translateX(-10vw)' }],
          { duration: 30000, iterations: Infinity, easing: 'ease-in-out' });
      });
    }
  }
  if (G.halloween === false) document.documentElement.dataset.halloween = 'off';
}

/* Wetter-Modus: Seite umschalten (Inhalt baut weather.js) */
if (!G.show && cfg.weather && cfg.weather.show) {
  document.documentElement.dataset.mode = 'weather';
  $('wx').hidden = false;
  $('wxFoot').hidden = false;
}

/* ════════════════════════════════════════════════════════════════
 * 1 · COUNTDOWN
 * ════════════════════════════════════════════════════════════════ */

const fmtDate = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
const start = new Date(cfg.project.start).getTime();
const end = new Date(cfg.project.end).getTime();
const totalMs = end - start;

const startStr = `<strong>${fmtDate.format(start)}</strong>`;
const endStr = `<strong>${fmtDate.format(end)}</strong>`;

/* Die Datums-Zeile wechselt beim Projektstart von "Startet" → "Gestartet"
   (+ "Tag X von Y"). Nur bei Zustandswechsel neu schreiben. */
let started = null;
function renderDates(hasStarted) {
  $('dates').innerHTML = hasStarted
    ? `Gestartet am ${startStr} · endet am ${endStr}` +
      `<span class="meta__day" id="dayOf"></span>`
    : `Startet am ${startStr} · endet am ${endStr}`;
}

/* „Tage als Held": Nur noch die verbleibenden Tage als große Zahl (aufgerundet,
   damit der letzte Tag nicht vorzeitig auf 0 springt). Keine tickenden Sekunden
   mehr — passt zum mehrjährigen Projekt und wirkt ruhiger/edler. */
function setCount(ms) {
  setDigits($('cd'), String(Math.ceil(ms / 86_400_000)));
}

function tick() {
  const now = Date.now();
  const hasStarted = now >= start;
  if (hasStarted !== started) { started = hasStarted; renderDates(hasStarted); }

  if (!hasStarted) {
    /* Vorlauf: Countdown auf die volle Laufzeit (≈3 Jahre) eingefroren,
       Fortschrittsbalken leer. Schaltet am Startdatum automatisch um. */
    setCount(totalMs);
    $('projFill').style.transform = 'scaleX(0)';
    return;
  }

  setCount(Math.max(0, end - now));
  const elapsed = Math.min(Math.max(now - start, 0), totalMs);
  $('projFill').style.transform = `scaleX(${elapsed / totalMs})`;
  const totalDays = Math.ceil(totalMs / 86_400_000);
  const dayOf = Math.min(Math.ceil(Math.max(now - start, 0) / 86_400_000) || 1, totalDays);
  const dayEl = $('dayOf');
  if (dayEl) dayEl.textContent = `Tag ${dayOf} von ${totalDays}`;
}
/* Status „pruefung": Antrag liegt bei Innosuisse → kein Countdown, sondern ein
   ruhiger Status-Hinweis (Texte aus cfg.project.review). */
if (cfg.project.status === 'pruefung') {
  const r = cfg.project.review;
  const fig = $('cd');
  fig.textContent = r.title;
  fig.classList.add('countdown__figure--status');
  document.querySelector('.countdown__label').textContent = r.label;
  $('dates').innerHTML = r.note;
  $('dates').classList.add('meta__dates--status');
  const track = $('projFill').parentElement;
  if (track) track.remove();
} else {
  tick();
  setInterval(tick, 1000);
}

/* ════════════════════════════════════════════════════════════════
 * 2 · IQ-STAND
 * ════════════════════════════════════════════════════════════════ */

/* IQ: Zahl, Balken und Punkt zählen beim Laden gemeinsam hoch */
function showIQ(value, animate = true) {
  const el = $('iqValue');
  const frac = Math.min(Math.max((value - cfg.iq.start) / (cfg.iq.target - cfg.iq.start), 0), 1);
  const paint = (v, f) => {
    setDigits(el, String(Math.round(v)));
    $('iqFill').style.transform = `scaleX(${f})`;
    $('iqDot').style.left = `${f * 100}%`;
  };

  /* 0 = noch keine Daten: »--«, leerer Balken, kein Hochzählen */
  if (!value) {
    setDigits(el, '--');
    $('iqFill').style.transform = 'scaleX(0)';
    $('iqDot').style.left = '0%';
    return;
  }

  if (!animate || reducedMotion) { paint(value, frac); return; }
  const from = cfg.iq.start;
  const t0 = performance.now();
  (function step(now) {
    const p = Math.min((now - t0) / 1200, 1);
    const e = 1 - Math.pow(1 - p, 3);
    paint(from + (value - from) * e, frac * e);
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

/* IQ-Anzeige ausgeblendet → Footer ganz raus; die Logo-Bühne rückt nach unten */
const iqShown = cfg.iq.show !== false;
if (!iqShown) {
  document.querySelector('.hud--bottom').remove();
  document.documentElement.dataset.iq = 'off';
} else {
  $('iqStart').textContent = String(cfg.iq.start);
  $('iqTarget').textContent = String(cfg.iq.target);
  /* animate=false: kein Hochzaehlen — die Seite ist bewusst komplett statisch. */
  showIQ(cfg.iq.current, false);
}

/* Öffentliche API — wird unten (Video-Abschnitt) noch erweitert. */
window.britney = {
  setIQ: (v) => { cfg.iq.current = v; if (iqShown) showIQ(v, false); },
};

/* ════════════════════════════════════════════════════════════════
 * 3 · BRITNEY-VIDEO (Mitte)
 *
 * EIN Clip läuft dauerhaft im Loop — kein Sensor, kein Stufenwechsel,
 * keine Transitions. Quelle: cfg.video.src.
 *
 * Technik: EINE <video>-Ebene mit loop + autoplay (muted erlaubt den
 * Autostart). Der Pi 4 dekodiert ein einzelnes H.264-Video problemlos in
 * Hardware. Keine Quellwechsel → kein Schwarz-Blitz, kein Freeze-Frame nötig.
 * ════════════════════════════════════════════════════════════════ */

const V = cfg.video;
const videoMode = cfg.center === 'video';

/* Nicht genutzte Mitte komplett aus dem DOM nehmen (kein Dekodieren im Hintergrund). */
if (videoMode) { const n = $('news'); if (n) n.remove(); }
else { const b = $('britney'); if (b) b.remove(); }

/* Weiche Randmaske: die harten Video-Kanten federn rundum aus und schmelzen in den
   Hintergrund. */
if (videoMode) document.documentElement.dataset.videoMask = 'on';

const vid  = videoMode ? $('vidA') : null;
const vid2 = $('vidB');                 /* zweite Ebene wird nicht mehr gebraucht */
if (vid2) { try { vid2.pause(); } catch (_) {} vid2.removeAttribute('src'); vid2.remove(); }

if (vid) {
  vid.muted = V.muted !== false;
  vid.loop = true;
  vid.playsInline = true;
  vid.preload = 'auto';
  vid.style.opacity = '1';
  vid.style.zIndex = '1';
  vid.classList.add('is-front');
  vid.src = V.src;
  vid.load();
  /* play() kann auf dem Pi haengen (Promise settlet nie) bzw. vom Browser
     wegen Autoplay-Policy abgelehnt werden -> Fehler still schlucken. Mit muted
     ist Autostart erlaubt, der Loop läuft, sobald der erste Frame da ist. */
  const p = vid.play();
  if (p && p.catch) p.catch(() => {});
}

/* ════════════════════════════════════════════════════════════════
 * 4 · KIOSK-ROBUSTHEIT
 * ════════════════════════════════════════════════════════════════ */

/* Täglicher Auto-Reload gegen Browser-Memory-Drift im Dauerbetrieb */
if (cfg.kiosk.dailyReloadHour >= 0) {
  const next = new Date();
  next.setHours(cfg.kiosk.dailyReloadHour, 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  setTimeout(() => location.reload(), next - Date.now());
}
