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
    current: 0,    /* 0 = noch keine Daten → zeigt »--«. Später hochsetzen (z. B. britney.setIQ(60)). */
    start:   20,   /* Wo Britney begonnen hat */
    target:  130,  /* Das Projektziel */
  },

  /* Mittel-Visualisierung: Forschungskooperation VGT × FHNW.
   * Texte hier zentral änderbar. Der von »…« umschlossene Teil wird fett
   * gesetzt — die Anführungszeichen selbst werden NICHT angezeigt. */
  collab: {
    caption: 'Gemeinsames KI-Forschungsprojekt »Britney«',
  },

  kiosk: {
    /* Täglicher Auto-Reload (Stunde 0–23) gegen Browser-Memory-Drift
     * im Dauerbetrieb. -1 = aus. */
    dailyReloadHour: 4,
  },

  /* Bewegungs-Trigger über den BS412-PIR-Sensor.
   * Das Bridge-Skript (sensor/motion_bridge.py) liest GPIO4 und stellt
   * einen Zähler unter dieser lokalen Adresse bereit. Das Dashboard pollt
   * sie; läuft die Bridge nicht, bleibt alles still (Leertaste geht weiter).
   * url: '' schaltet das Pollen komplett aus. */
  motion: {
    url: 'http://127.0.0.1:8765/motion',
    pollMs: 300,

    /* Verhalten des Symbols bei Bewegung: */
    count:      4,     /* nach so vielen Auslösungen springt der Zähler zurück auf 0 */
    showMs:     2600,  /* wie lange das Symbol je Auslösung sichtbar bleibt (ms) */
    cooldownMs: 5000,  /* Mindestpause zwischen zwei Auslösungen (ms) — verhindert zu schnelles Triggern */
  },
};
