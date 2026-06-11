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

/* ── Texte aus der Config setzen ── */
const phaseEl = $('phase');
if (phaseEl) {
  phaseEl.textContent = cfg.project.phase;
  if (!cfg.project.phase) phaseEl.remove();
}
if ($('caption')) $('caption').innerHTML = cfg.collab.caption.replace(
  /»(.+?)«/, '<strong>$1</strong>');

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

function setCount(ms) {
  $('cd').textContent = String(Math.floor(ms / 86_400_000));
  $('ch').textContent = String(Math.floor(ms / 3_600_000) % 24).padStart(2, '0');
  $('cm').textContent = String(Math.floor(ms / 60_000) % 60).padStart(2, '0');
  $('cs').textContent = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
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
tick();
setInterval(tick, 1000);

/* ════════════════════════════════════════════════════════════════
 * 2 · IQ-STAND
 * ════════════════════════════════════════════════════════════════ */

/* IQ: Zahl, Balken und Punkt zählen beim Laden gemeinsam hoch */
function showIQ(value, animate = true) {
  const el = $('iqValue');
  const frac = Math.min(Math.max((value - cfg.iq.start) / (cfg.iq.target - cfg.iq.start), 0), 1);
  const paint = (v, f) => {
    el.textContent = String(Math.round(v));
    $('iqFill').style.transform = `scaleX(${f})`;
    $('iqDot').style.left = `${f * 100}%`;
  };

  /* 0 = noch keine Daten: »--«, leerer Balken, kein Hochzählen */
  if (!value) {
    el.textContent = '--';
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

$('iqStart').textContent = String(cfg.iq.start);
$('iqTarget').textContent = String(cfg.iq.target);

setTimeout(() => showIQ(cfg.iq.current), 600);

/* Öffentliche API — wird unten (Video-Abschnitt) noch erweitert. */
window.britney = {
  setIQ: (v) => { cfg.iq.current = v; showIQ(v); },
};

/* ════════════════════════════════════════════════════════════════
 * 3 · BRITNEY-VIDEOS (Mitte) + BEWEGUNGS-TRIGGER
 *
 * Ablauf:  britney_1 läuft im Loop  →  Bewegung  →  transition_1 spielt
 * einmal  →  britney_2 läuft im Loop  →  Bewegung  →  transition_2 …
 * Nach der letzten Stufe (transition_N) geht es zurück auf britney_1.
 *
 * Ausgelöst wird eine Stufe durch (alle über dieselbe Funktion triggerMotion):
 *   • den PIR-Sensor  → serve.py zählt /motion hoch, die Seite pollt;
 *   • die Leertaste   (lokaler Test ohne Sensor);
 *   • britney.advance() (in der Browser-Konsole).
 *
 * Technik bewusst SIMPEL & hängsicher: zwei gestapelte <video>, beim Wechsel
 * wird auf der versteckten Ebene src gesetzt + play() + die Opacity-Klasse
 * getauscht (CSS-Crossfade). Das Ende des Übergangs wird über 'ended',
 * 'timeupdate' UND einen Timeout erkannt — die Umschaltung kann nie hängen.
 * ════════════════════════════════════════════════════════════════ */

const V = cfg.video;
const clip = (name) => `${V.dir}/${name}.mp4`;
const layers = [$('vidA'), $('vidB')];
const hasVideo = !!layers[0];

let frontIdx = 0;                  /* welche Ebene gerade sichtbar ist */
let stage = V.startStage || 1;     /* aktueller Stand-Loop: britney_<stage> */
let switching = false;             /* true, während ein Übergang läuft (entprellt) */

if (hasVideo) {
  layers.forEach((v) => { v.muted = V.muted !== false; v.playsInline = true; v.preload = 'auto'; });
  document.documentElement.style.setProperty('--britney-fade', `${V.crossfadeMs || 160}ms`);
}

/* Einen Clip auf die versteckte Ebene legen, abspielen und per Crossfade nach
   vorn holen. Bewusst simpel: src setzen, play(), Opacity-Klasse tauschen — den
   Crossfade macht das CSS (.britney__vid / .is-front, transition: opacity). */
function show(name, loop) {
  if (!hasVideo) return null;
  const cur = layers[frontIdx];
  const nxt = layers[frontIdx ^ 1];
  nxt.loop = loop;
  nxt.onended = null;
  nxt.ontimeupdate = null;
  nxt.src = clip(name);
  nxt.play().catch(() => {});        /* Autoplay-Reject harmlos schlucken */
  nxt.classList.add('is-front');     /* einblenden */
  cur.classList.remove('is-front');  /* ausblenden */
  frontIdx ^= 1;
  return nxt;
}

/* Eine Stufe weiter: transition_<stage> einmal spielen, dann britney_<next>
   loopen. Robust gegen den Pi: das Ende des Übergangs wird über 'ended',
   'timeupdate' UND einen Timeout erkannt — kann also NIE hängen bleiben. */
function advance() {
  if (!hasVideo || switching) return;
  switching = true;

  const t = show(`transition_${stage}`, false);
  let done = false;
  const goNext = () => {
    if (done) return;
    done = true;
    t.onended = null;
    t.ontimeupdate = null;
    clearTimeout(timer);
    stage = (stage % V.stages) + 1;
    show(`britney_${stage}`, true);
    switching = false;
  };
  t.onended = goNext;
  t.ontimeupdate = () => { if (t.duration && t.currentTime >= t.duration - 0.2) goNext(); };
  const timer = setTimeout(goNext, 12000);   /* Notbremse, falls kein End-Event feuert */
}

/* Eine Bewegungs-Auslösung — Sensor UND Leertaste laufen über genau diese Funktion */
function triggerMotion() { advance(); }

/* Test-Auslöser ohne Sensor: Leertaste (auch der Weg, den die Pi-Shell nutzt) */
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); triggerMotion(); }
});

/* Start: ersten Stand-Loop zeigen + restliche Clips im Hintergrund vorwärmen */
if (hasVideo) {
  show(`britney_${stage}`, true);
  setTimeout(() => {
    for (let i = 1; i <= V.stages; i++) {
      fetch(clip(`britney_${i}`)).catch(() => {});
      fetch(clip(`transition_${i}`)).catch(() => {});
    }
  }, 1500);
}

/* Öffentliche API erweitern */
window.britney.motion  = triggerMotion;                       /* eine Bewegung (PIR/Shell/Test) */
window.britney.advance = advance;                             /* sofort eine Stufe weiter */
window.britney.stage   = () => stage;                         /* aktuelle Stufe abfragen */
window.britney.reset   = () => {                              /* zurück auf britney_1 */
  switching = false;
  stage = V.startStage || 1;
  show(`britney_${stage}`, true);
};

/* Echte Sensor-Anbindung: serve.py liest den PIR-Sensor und zählt unter
   /motion hoch. Steigt der Zähler, kam eine neue Bewegung → weiterschalten.
   Gleicher Origin wie die Seite → kein CORS, kein xdotool. Fehler (z. B. lokal
   ohne serve.py) werden still verschluckt — die Leertaste funktioniert weiter. */
if (cfg.motion && cfg.motion.url) {
  let lastSeen = null;
  const pollMotion = async () => {
    try {
      const res = await fetch(cfg.motion.url, { cache: 'no-store' });
      const { count } = await res.json();
      if (lastSeen === null) lastSeen = count;       /* beim Start nur synchronisieren */
      else if (count > lastSeen) { lastSeen = count; triggerMotion(); }
    } catch { /* Endpunkt nicht erreichbar → ignorieren */ }
  };
  setInterval(pollMotion, cfg.motion.pollMs || 300);
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
