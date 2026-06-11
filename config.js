/* ════════════════════════════════════════════════════════════════
 * BRITNEY DASHBOARD · KONFIGURATION
 *
 * Das ist die einzige Datei, die ihr im Alltag anfasst.
 * IQ hochsetzen → iq.current ändern, Seite neu laden. Fertig.
 * ════════════════════════════════════════════════════════════════ */

export const CONFIG = {

  project: {
    label: 'VGT · Forschungsprojekt Britney',
    /* Phasen-Anzeige oben rechts. Leerer String '' blendet sie aus. */
    phase: 'Phase 1 · Grundtraining',

    /* ⚠ PLATZHALTER — bitte echte Daten eintragen (ISO-Format) */
    start: '2026-06-01T08:00:00',
    end:   '2026-12-31T17:00:00',
  },

  iq: {
    current: 62,   /* ⚠ PLATZHALTER — wird von euch über die Laufzeit hochgesetzt */
    start:   62,   /* Wo Britney begonnen hat */
    target:  130,  /* Das Projektziel */
  },

  /* Mittel-Visualisierung: Forschungskooperation VGT × FHNW.
   * Texte hier zentral änderbar. */
  collab: {
    eyebrow: 'Forschungskooperation',
    caption: 'Gemeinsames KI-Forschungsprojekt »Britney«',
  },

  /* Interaktive Visualisierung: ein Roboterarm, der per Reinforcement
   * Learning (Evolution Strategies) live lernt, ein Ziel zu greifen. */
  robot: {
    enabled: true,
    /* Koppelt die IQ-Anzeige an die Lern-Leistung des Arms:
     *   true  = IQ steigt live mit, je besser der Arm trifft (empfohlen)
     *   false = IQ bleibt manuell (britney.setIQ) */
    driveIQ: true,
    /* Live-Lernstatus (Generation/Treffer) in die Status-Zeile schreiben */
    showStatus: true,
    /* Hybrid (Standard): mit eingebackenen, vortrainierten Gewichten starten
     * → Arm ist sofort kompetent und lernt im Browser nur noch weiter.
     * false = von Null lernen (man sieht den ganzen Lernbogen). */
    startTrained: true,
    /* Eigene Gewichte überschreiben den Standard. Leer = eingebackene nutzen.
     * Erzeugen: in der Konsole  britney.robot.dumpWeights()  → nach rl/pretrained.js */
    pretrained: null,
  },

  kiosk: {
    /* Täglicher Auto-Reload (Stunde 0–23) gegen Browser-Memory-Drift
     * im Dauerbetrieb. -1 = aus. */
    dailyReloadHour: 4,
  },
};
