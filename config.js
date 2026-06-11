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
    caption: 'Gemeinsames KI-Forschungsprojekt »Britney«',
  },

  kiosk: {
    /* Täglicher Auto-Reload (Stunde 0–23) gegen Browser-Memory-Drift
     * im Dauerbetrieb. -1 = aus. */
    dailyReloadHour: 4,
  },
};
