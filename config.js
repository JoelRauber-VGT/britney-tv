/* ════════════════════════════════════════════════════════════════
 * BRITNEY DASHBOARD · KONFIGURATION
 *
 * Das ist die einzige Datei, die ihr im Alltag anfasst.
 * IQ hochsetzen → iq.current ändern, Seite neu laden. Fertig.
 * ════════════════════════════════════════════════════════════════ */

const CONFIG = {

  project: {
    label: 'VGT · Forschungsprojekt Britney',
    /* Phasen-Anzeige oben rechts. Leerer String '' blendet sie aus. */
    phase: 'Phase 1 · Britney Core Platform',

    /* Projektstart. Vor diesem Zeitpunkt zeigt das Dashboard den
     * Vorlauf ("Startet am …"), danach läuft der Countdown. (ISO-Format) */
    start: '2026-07-01T08:00:00',
    end:   '2029-07-01T17:00:00',   /* Projektlaufzeit 3 Jahre */
  },

  iq: {
    current: 20,   /* 0 = noch keine Daten → zeigt »--«. Später hochsetzen (z. B. britney.setIQ(60)). */
    start:   0,    /* Linkes Ende der Skala / des Balkens */
    target:  180,  /* Rechtes Ende der Skala (Ziel) */
  },

  /* Mitte-Videos: Britney-Avatar.
   * Stand-Loop  britney_N  läuft endlos. Bei Bewegung spielt  transition_N
   * einmal und blendet zu  britney_(N+1). Nach der letzten Stufe geht es
   * zurück auf britney_1. Eine Stufe wird ausgelöst durch PIR-Sensor,
   * Leertaste (lokaler Test) oder britney.advance() in der Konsole. */
  video: {
    /* Standard-Ordner (Fallback). Welcher Satz WIRKLICH läuft, bestimmt
     * vidoes/active.txt (real | pixar) – per ./switch-videos.sh umschaltbar.
     * Die Seite fragt das beim Start vom Server ab und lädt sich bei einem
     * Wechsel selbst neu. */
    dir: './vidoes/real',   /* Ordner mit britney_1..N.mp4 und transition_1..N.mp4 */
    ext: 'mp4',             /* Dateiformat der real/pixar-Sätze (opake H.264-Clips) */

    /* TEST-SATZ: überschreibt den realen/pixar-Satz und lässt STATTDESSEN einen
     * festen Ordner mit voller Stufen-Logik laufen (Stand-Loops + Transitions
     * schalten normal durch). Dateinamen: <dir>/<name><suffix>.<ext>.
     * on: false = aus = normaler Betrieb (real | pixar). */
    test: {
      on:     false,
      dir:    '.',
      suffix: '',
      ext:    'mp4',
    },
    stages: 4,           /* Anzahl Stand-Loops (britney_1 … britney_4) */
    startStage: 1,       /* womit gestartet wird */
    muted: true,         /* Kiosk läuft lautlos (muted erlaubt den Autostart) */
    crossfadeMs: 0,      /* 0 = harter Schnitt (kein Überblenden, keine Überlappung).
                            >0 würde beide Clips kurz per Opacity ineinanderblenden.
                            Dank Vorpufferung blitzt auch der harte Schnitt nicht. */
    cooldownMs: 5000,    /* Sperre nach einem Auslöser: 5 s lang werden weitere
                            Bewegungen ignoriert (jemand laeuft durch + wackelt
                            gleich nochmal -> nur EIN Wechsel). 0 = keine Sperre */
  },

  /* Mittel-Visualisierung: Forschungskooperation VGT × FHNW.
   * Texte hier zentral änderbar. Der von »…« umschlossene Teil wird fett
   * gesetzt — die Anführungszeichen selbst werden NICHT angezeigt. */
  collab: {
    caption: 'Gemeinsames KI-Forschungsprojekt »Britney«',
  },

  /* Bewegter Hintergrund (Aceternity-„Aurora"-Look, rein CSS auf der GPU):
   *   'aurora' – langsam fließende Farbschleier (Standard, edel & lebendig)
   *   'static' – fester Glow ohne Animation (falls der Pi doch ruckelt)
   *   'off'    – flaches Violett-Schwarz (maximal stromsparend)
   * Performance immer am ECHTEN Pi gegenchecken; bei Rucklern hier umschalten.
   * Pi 4 + VP9-Alpha-Video im Hochformat: 'aurora' (animiert) kostet zu viel GPU,
   * daher Default 'static' (einmal gezeichnet, dann gecacht). Auf starkem Rechner
   * gern wieder 'aurora'. */
  background: 'static',

  kiosk: {
    /* Täglicher Auto-Reload (Stunde 0–23) gegen Browser-Memory-Drift
     * im Dauerbetrieb. -1 = aus. */
    dailyReloadHour: 4,
  },

  debug: false,

  /* PIR-Sensor (BS412): serve.py liest GPIO4 und zählt unter /motion hoch.
   * Die Seite pollt diese Adresse (gleicher Origin wie die Seite → kein CORS).
   * Bei jedem neuen Zählerstand wird eine Video-Stufe weitergeschaltet.
   * url: '' schaltet das Pollen aus (dann nur Leertaste). */
  motion: {
    url: '/motion',
    pollMs: 300,
  },
};
