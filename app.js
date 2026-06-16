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
 * Ausgelöst wird eine Stufe durch:
 *   • den PIR-Sensor am Pi  → serve.py zählt /motion hoch, die Seite pollt das
 *     und löst denselben Weg aus wie die Leertaste (s. Abschnitt unten);
 *   • die Leertaste          (lokaler Test ohne Sensor);
 *   • britney.advance()      (in der Browser-Konsole).
 *
 * Technik: zwei gestapelte <video>. Der JEWEILS NÄCHSTE Clip wird schon
 * gepuffert, während der aktuelle läuft — beim Umschalten ist er also bereits
 * fertig geladen. Das verhindert das Ruckeln/„Bugs" beim Übergang.
 * ════════════════════════════════════════════════════════════════ */

const V = cfg.video;
/* Beide Sätze (real | pixar) liegen als <V.dir>/<name>.<ext> (Standard: mp4 –
   opake H.264-Clips, vom Pi 4 in Hardware dekodierbar). Test-Satz
   (cfg.video.test.on) bleibt als manueller Override erhalten — wenn an, spielt er
   statt real/pixar einen festen Ordner: <dir>/<name><suffix>.<ext>. */
const T = V.test || {};
const EXT = (V.ext || 'mp4').toLowerCase();
const clip = (name) => T.on
  ? `${T.dir}/${name}${T.suffix || ''}.${T.ext || 'mp4'}`
  : `${V.dir}/${name}.${EXT}`;
/* Weiche Randmaske nur für OPAKE Clips (H.264-MP4 ohne Alpha-Rand): die harten
   Video-Kanten federn rundum aus und schmelzen in die Aurora. Transparente
   WebM-Sätze bringen ihre Alpha-Kanten selbst mit → keine Maske nötig. */
const activeExt = (T.on ? (T.ext || 'mp4') : EXT).toLowerCase();
const opaqueClips = activeExt !== 'webm';
document.documentElement.dataset.videoMask = opaqueClips ? 'on' : 'off';

/* ZWEI <video>-Ebenen (Doppel-Puffer): Die sichtbare Ebene (front) spielt den
   aktuellen Clip; in die verdeckte Ebene (back) wird der NÄCHSTE Clip schon vorab
   vollständig geladen, WÄHREND der aktuelle läuft. Beim Umschalten wird deshalb
   nichts neu geladen/gerendert — es wird nur HART auf die bereits laufende back-
   Ebene umgeschaltet. Kein Ruckler, auch beim Zurückspringen auf britney_1.
   Bewusst nur 2 Ebenen = nur 2 Decoder gleichzeitig: mehr (z. B. ein Element je
   Clip) überfordert den Browser/Pi → schwarzes Bild. */
const vid  = $('vidA');
let   vid2 = $('vidB');
const hasVideo = !!vid;
if (hasVideo && !vid2) {            /* Fallback: zweite Ebene anlegen, falls im HTML fehlend */
  vid2 = vid.cloneNode(false);
  vid2.removeAttribute('id');
  (vid.parentNode || document.body).appendChild(vid2);
}

let stage = V.startStage || 1;     /* aktueller Stand-Loop: britney_<stage> */
let busy = false;                  /* true, während ein Übergang läuft */
let cooldownUntil = 0;

/* Übergangsdauer: 0 = harter Schnitt (keine Überlappung). >0 würde per CSS-Opacity
   weich überblenden. */
const fadeMs = V.crossfadeMs >= 0 ? V.crossfadeMs : 0;
document.documentElement.style.setProperty('--britney-fade', fadeMs + 'ms');

let front = vid, back = vid2;      /* front = sichtbar/läuft · back = nächster Clip */
const layers = [vid, vid2];        /* nur fürs Debug-Overlay (liest layers[0]/[1]) */
let frontIdx = 0;

if (hasVideo) {
  for (const el of [vid, vid2]) {
    el.muted = V.muted !== false;
    el.preload = 'auto';
    el.playsInline = true;
    el.classList.remove('is-front');
    el.style.opacity = '0';
  }
  front.style.opacity = '1';  front.style.zIndex = '2';
  back.style.zIndex = '1';
}

/* Einen Clip in eine Ebene laden und vorpuffern (OHNE ihn abzuspielen). Setzt die
   Quelle nur, wenn sie sich ändert → kein unnötiges Neuladen. */
function arm(el, name, loop) {
  const src = clip(name);
  el.loop = loop;
  el.onended = null;
  if (el.dataset.clip !== src) { el.dataset.clip = src; el.src = src; el.load(); }
}

/* Wartet, bis ein Element flüssig durchspielbereit ist (mit Sicherheits-Timeout,
   falls canplaythrough mal nicht feuert). */
function whenReady(el) {
  return new Promise((resolve) => {
    if (el.readyState >= 4) { resolve(); return; }   /* HAVE_ENOUGH_DATA */
    let done = false;
    const ok = () => {
      if (done) return; done = true;
      el.removeEventListener('canplaythrough', ok);
      el.removeEventListener('canplay', ok);
      clearTimeout(timer);
      resolve();
    };
    el.addEventListener('canplaythrough', ok, { once: true });
    el.addEventListener('canplay', ok, { once: true });   /* Fallback */
    const timer = setTimeout(ok, 2500);                   /* Notbremse */
  });
}

/* Wartet, bis das Element WIRKLICH spielt: erster Frame präsentiert (rVFC) ODER
   die Wiedergabezeit läuft (currentTime > 0). Sonst würde auf dem Pi ein noch
   schwarzes, nicht dekodiertes Bild eingeblendet. Großzügige Notbremse (3 s),
   da der Decoder jetzt frei ist und der Frame normalerweise schnell kommt. */
function firstFrame(el) {
  return new Promise((resolve) => {
    let done = false;
    const ok = () => {
      if (done) return; done = true;
      clearTimeout(timer);
      el.removeEventListener('timeupdate', onTime);
      resolve();
    };
    const onTime = () => { if (el.currentTime > 0.04) ok(); };   /* echtes Abspielen erkannt */
    if (el.requestVideoFrameCallback) {
      el.requestVideoFrameCallback(() => ok());
    } else {
      requestAnimationFrame(() => requestAnimationFrame(ok));    /* Fallback */
    }
    el.addEventListener('timeupdate', onTime);
    const timer = setTimeout(ok, 3000);   /* Notbremse, falls gar kein Frame kommt */
  });
}

/* Ein Element von vorn starten und warten, bis es WIRKLICH spielt (erster Frame
   präsentiert / currentTime > 0). Jeder Schritt hat einen Timeout → kann nie
   hängen bleiben (Pi: play()-Promise settlet evtl. nie; Autoplay-Reject geschluckt). */
async function startPlaying(el) {
  await whenReady(el);
  try { el.currentTime = 0; } catch (_) {}
  const p = el.play();
  if (p && p.catch) p.catch(() => {});
  await Promise.race([Promise.resolve(p), new Promise((r) => setTimeout(r, 1500))]);
  await firstFrame(el);
}

/* Den vorbereiteten back-Clip einblenden: back starten (ist schon gepuffert), dann
   HART auf ihn umschalten (kein Schwarzblitz, da der erste Frame bereits steht) und
   front/back tauschen. Die alte front-Ebene wird pausiert und dient danach als
   Puffer für den übernächsten Clip. */
async function activate() {
  await startPlaying(back);                          /* back läuft + erster Frame steht */
  back.style.opacity = '1';  back.style.zIndex = '2';
  front.style.opacity = '0'; front.style.zIndex = '1';
  const prev = front;
  front = back;
  back = prev;
  frontIdx ^= 1;
  layers[0] = front;
  try { back.pause(); } catch (_) {}                 /* verdeckte Ebene anhalten (CPU) */
}

/* Wartet aufs Ende eines (nicht loopenden) Clips — robust: 'ended', notfalls
   'timeupdate' nahe Schluss oder ein harter Timeout. So kann advance() auf dem
   Pi NIE hängen, falls 'ended' mal nicht feuert (häufiger Pi-/Wayland-Fall). */
function waitForEnd(el) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.onended = null;
      el.removeEventListener('timeupdate', onTime);
      clearTimeout(timer);
      resolve();
    };
    const onTime = () => { if (el.duration && el.currentTime >= el.duration - 0.25) finish(); };
    el.onended = finish;
    el.addEventListener('timeupdate', onTime);
    const timer = setTimeout(finish, 15000);   /* Notbremse */
  });
}

/* Eine Stufe weiterschalten: vorgepufferten Übergang einblenden, dann nächsten
   Stand-Loop. Der jeweils nächste Clip liegt schon fertig in der back-Ebene →
   nur play + hartes Umschalten, kein Neuladen → kein Ruckeln (auch beim
   Zurückspringen auf britney_1). */
async function advance() {
  if (!hasVideo || busy) return;
  busy = true;
  /* Watchdog: egal was schiefläuft – busy darf NIE dauerhaft hängen bleiben,
     sonst ignoriert triggerMotion ab da jede Bewegung. */
  const watchdog = setTimeout(() => { busy = false; }, 20000);
  try {
    /* back hält bereits transition_<stage> (beim Start/letzten Wechsel vorgeladen) */
    await activate();                                /* Übergang einblenden, spielt EINMAL */

    /* nächsten Stand-Loop in die jetzt freie back-Ebene vorladen, während Übergang läuft */
    stage = (stage % V.stages) + 1;
    arm(back, `britney_${stage}`, true);

    await waitForEnd(front);                         /* hängsicher: ended | timeupdate | Timeout */
    await activate();                                /* nächsten Stand-Loop einblenden */

    /* den darauf folgenden Übergang für die nächste Bewegung vorpuffern */
    arm(back, `transition_${stage}`, false);
  } finally {
    clearTimeout(watchdog);
    busy = false;
    cooldownUntil = Date.now() + (V.cooldownMs || 0);
  }
}

/* Eine Bewegungs-Auslösung — entprellt, ignoriert Pulse während eines Übergangs */
function triggerMotion() {
  if (busy || Date.now() < cooldownUntil) return;
  advance();
}

/* Test-Auslöser ohne Sensor: Leertaste (auch der Weg, den die Pi-Shell nutzt) */
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); triggerMotion(); }
});

/* Start: ersten Stand-Loop in die front-Ebene laden + abspielen, dann ersten
   Übergang schon in die back-Ebene vorpuffern (erste Bewegung schaltet flüssig). */
async function startBritney() {
  if (!hasVideo) return;
  arm(front, `britney_${stage}`, true);
  await startPlaying(front);
  front.style.opacity = '1';  front.style.zIndex = '2';
  arm(back, `transition_${stage}`, false);
}
/* ── Aktiver Video-Satz (real | pixar) ───────────────────────────────
   vidoes/active.txt bestimmt, welcher Ordner läuft; serve.py liefert ihn unter
   /videoset. Wir holen ihn VOR dem Start (setzt V.dir) und pollen danach: ändert
   ihn jemand per ./switch-videos.sh, lädt sich die Seite selbst neu (Wayland-
   sicher, kein xdotool). Ohne Server (lokal/file://) bleibt der Wert aus config. */
let activeSet = null;
async function fetchVideoSet() {
  const res = await fetch('/videoset', { cache: 'no-store' });
  const { set } = await res.json();
  return set;
}
(async function initVideoSet() {
  try {
    const set = await fetchVideoSet();
    if (set) { activeSet = set; V.dir = './vidoes/' + set; }
  } catch (_) { /* Endpunkt nicht erreichbar → V.dir aus config (Fallback) */ }
  startBritney();
  /* Auf Wechsel lauschen */
  setInterval(async () => {
    try {
      const set = await fetchVideoSet();
      if (activeSet && set && set !== activeSet) location.reload();
    } catch (_) { /* still ignorieren */ }
  }, 2000);
})();

/* Öffentliche API erweitern */
window.britney.motion  = triggerMotion;                       /* eine Bewegung (PIR/Shell/Test) */
window.britney.advance = advance;                             /* sofort eine Stufe weiter */
window.britney.stage   = () => stage;                         /* aktuelle Stufe abfragen */
window.britney.reset   = async () => {                        /* zurück auf britney_1 */
  stage = V.startStage || 1;
  busy = false;
  cooldownUntil = 0;
  arm(front, `britney_${stage}`, true);
  await startPlaying(front);
  front.style.opacity = '1';  front.style.zIndex = '2';
  arm(back, `transition_${stage}`, false);
};

/* Echte Sensor-Anbindung: serve.py liest den PIR-Sensor und zählt unter
   /motion hoch. Steigt der Zähler, kam eine neue Bewegung → weiterschalten.
   Gleicher Origin wie die Seite → kein CORS, kein xdotool. Fehler (z. B. lokal
   ohne serve.py) werden still verschluckt — die Leertaste funktioniert weiter. */
if (cfg.motion && cfg.motion.url) {
  let lastSeen = null;
  let dbgCount = -1;          /* zuletzt vom Server gelesener Zaehler (nur Debug) */
  let dbgErr = '';            /* letzter fetch-Fehler (nur Debug) */
  const pollMotion = async () => {
    try {
      const res = await fetch(cfg.motion.url, { cache: 'no-store' });
      const { count } = await res.json();
      dbgCount = count;
      dbgErr = `ok(${res.status})`;
      if (lastSeen === null) lastSeen = count;       /* beim Start nur synchronisieren */
      else if (count > lastSeen) { lastSeen = count; triggerMotion(); }
      else if (count < lastSeen) lastSeen = count;   /* Server neu gestartet (Zaehler bei 0) → resyncen, nicht blockieren */
    } catch (e) { dbgErr = String(e && e.message || e); /* Endpunkt nicht erreichbar → ignorieren */ }
  };
  setInterval(pollMotion, cfg.motion.pollMs || 300);

  /* ── TEMPORÄRES DEBUG-OVERLAY (oben links) ──────────────────────────
     Zeigt live, ob die Bewegung im Frontend ankommt und warum ein Übergang
     evtl. blockiert. Mit cfg.debug = false (config.js) wieder ausschalten. */
  if (cfg.debug !== false) {
    const dbg = document.createElement('div');
    dbg.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999;' +
      'font:14px/1.4 monospace;color:#0f0;background:rgba(0,0,0,.8);' +
      'padding:8px 10px;white-space:pre;pointer-events:none;border-radius:6px';
    document.body.appendChild(dbg);
    const clipName = (el) => (el && el.dataset.clip ? el.dataset.clip.split('/').pop() : '-');
    const vidLine = (el, tag) => {
      if (!el) return `${tag}: -`;
      const ct = el.currentTime ? el.currentTime.toFixed(1) : '0.0';
      const dur = el.duration && isFinite(el.duration) ? el.duration.toFixed(1) : '?';
      const err = el.error ? `ERR${el.error.code}` : 'ok';
      return `${tag} ${clipName(el)} rs=${el.readyState} ${el.paused ? 'PAUSE' : 'play'} ` +
             `t=${ct}/${dur} ${err}`;
    };
    setInterval(() => {
      dbg.textContent =
        `origin : ${location.origin}\n` +
        `motion : ${cfg.motion.url}  -> ${dbgErr}\n` +
        `server count : ${dbgCount}\n` +
        `lastSeen     : ${lastSeen}\n` +
        `stage        : ${stage}   busy=${busy}   front=${frontIdx}\n` +
        vidLine(layers[0], 'A') + '\n' +
        vidLine(layers[1], 'B');
    }, 150);
  }
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
