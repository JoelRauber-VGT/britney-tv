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

/* Öffentliche API — IQ live ändern, ohne Reload:  britney.setIQ(85) */
window.britney = {
  setIQ: (v) => { cfg.iq.current = v; showIQ(v); },
};

/* ════════════════════════════════════════════════════════════════
 * 3 · BEWEGUNGS-TRIGGER (PIR-Sensor)
 *
 * Platzhalter für die späteren Mitte-Videos: Bei erkannter Bewegung
 * wird kurz ein großes Symbol eingeblendet. Der Zähler läuft 1 → 4
 * und springt nach der 4. Auslösung wieder auf 0.
 *
 * Anbindung des echten Sensors später: Ein kleines GPIO-Skript auf dem
 * Pi ruft bei jeder Sensor-Flanke  window.britney.motion()  auf.
 * Testen ohne Sensor: Leertaste drücken (oder britney.motion() in der Konsole).
 * ════════════════════════════════════════════════════════════════ */

/* Zeiten aus der Config (mit Fallback), damit sie ohne Code-Änderung tunbar sind */
const MOTION_TOTAL       = (cfg.motion && cfg.motion.count)      || 4;     /* nach so vielen Auslösungen zurück auf 0 */
const MOTION_SHOW_MS     = (cfg.motion && cfg.motion.showMs)     || 2600;  /* wie lange das Symbol je Auslösung sichtbar bleibt */
const MOTION_COOLDOWN_MS = (cfg.motion && cfg.motion.cooldownMs) || 5000;  /* Mindestpause zwischen zwei Auslösungen */

const motionEl = $('motion');
const motionCountEl = $('motionCount');
let motionCount = 0;
let motionHideTimer = null;
let motionLocked = false;

function triggerMotion() {
  if (!motionEl || motionLocked) return;
  motionLocked = true;
  setTimeout(() => { motionLocked = false; }, MOTION_COOLDOWN_MS);

  /* 1 → 2 → 3 → 4, danach wieder von vorn */
  motionCount = motionCount >= MOTION_TOTAL ? 1 : motionCount + 1;
  motionCountEl.textContent = String(motionCount);

  motionEl.classList.add('is-active');
  clearTimeout(motionHideTimer);
  motionHideTimer = setTimeout(() => {
    motionEl.classList.remove('is-active');
    if (motionCount >= MOTION_TOTAL) motionCount = 0; /* Reset nach der 4. */
  }, MOTION_SHOW_MS);
}

/* Test-Auslöser ohne Sensor: Leertaste */
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); triggerMotion(); }
});

window.britney.motion = triggerMotion;

/* Echte Sensor-Anbindung: pollt die lokale PIR-Bridge auf dem Pi.
   Steigt der Zähler, kam eine neue Bewegung → Symbol einblenden.
   Fehler (Bridge aus) werden still verschluckt — Dashboard läuft weiter. */
if (cfg.motion && cfg.motion.url) {
  let lastSeen = null;
  const pollMotion = async () => {
    try {
      const res = await fetch(cfg.motion.url, { cache: 'no-store' });
      const { count } = await res.json();
      if (lastSeen === null) lastSeen = count;       /* beim Start nur synchronisieren */
      else if (count > lastSeen) { lastSeen = count; triggerMotion(); }
    } catch { /* Bridge nicht erreichbar → ignorieren */ }
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
