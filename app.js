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
const start = new Date(cfg.project.start);
const end = new Date(cfg.project.end);

$('dates').innerHTML =
  `Gestartet am <strong>${fmtDate.format(start)}</strong> · ` +
  `endet am <strong>${fmtDate.format(end)}</strong>` +
  `<span class="meta__day" id="dayOf"></span>`;

function tick() {
  const now = Date.now();
  const left = Math.max(0, end - now);

  const dd = Math.floor(left / 86_400_000);
  const hh = Math.floor(left / 3_600_000) % 24;
  const mm = Math.floor(left / 60_000) % 60;
  const ss = Math.floor(left / 1000) % 60;

  $('cd').textContent = String(dd);
  $('ch').textContent = String(hh).padStart(2, '0');
  $('cm').textContent = String(mm).padStart(2, '0');
  $('cs').textContent = String(ss).padStart(2, '0');

  const total = end - start;
  const elapsed = Math.min(Math.max(now - start, 0), total);
  $('projFill').style.transform = `scaleX(${elapsed / total})`;
  const totalDays = Math.ceil(total / 86_400_000);
  const dayOf = Math.min(Math.ceil(Math.max(now - start, 0) / 86_400_000) || 1, totalDays);
  $('dayOf').textContent = `Tag ${dayOf} von ${totalDays}`;
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
 * 3 · KIOSK-ROBUSTHEIT
 * ════════════════════════════════════════════════════════════════ */

/* Täglicher Auto-Reload gegen Browser-Memory-Drift im Dauerbetrieb */
if (cfg.kiosk.dailyReloadHour >= 0) {
  const next = new Date();
  next.setHours(cfg.kiosk.dailyReloadHour, 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  setTimeout(() => location.reload(), next - Date.now());
}
