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

  /* Mitte-Video: Britney-Avatar. EIN Clip, läuft dauerhaft im Loop —
   * kein Sensor, kein Stufenwechsel, keine Transitions. */
  video: {
    src:   './britney_loop.mp4',  /* der Loop-Clip (opaker H.264-Clip, vom Pi 4 in Hardware dekodierbar) */
    muted: true,                  /* Kiosk läuft lautlos (muted erlaubt den Autostart) */
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
   * Performance immer am ECHTEN Pi gegenchecken; bei Rucklern hier auf 'static'
   * umschalten. */
  background: 'static',

  kiosk: {
    /* Täglicher Auto-Reload (Stunde 0–23) gegen Browser-Memory-Drift
     * im Dauerbetrieb. -1 = aus. */
    dailyReloadHour: 4,
  },

  debug: false,
};
