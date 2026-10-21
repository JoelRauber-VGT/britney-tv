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

    /* Projektstatus oben:
     *   'pruefung' – Antrag liegt bei Innosuisse: statt Countdown ein Status-Hinweis (»In Vorbereitung«)
     *   'laufend'  – Projekt offiziell gestartet: Countdown + Datumszeile wie gewohnt */
    status: 'pruefung',
    review: {
      title: 'In Vorbereitung',                                   /* grosse Chrom-Zeile */
      label: 'Projektstart nach Innosuisse-Zusage',                 /* darunter, klein */
      note:  'Die Vorarbeiten laufen bereits – der offizielle Start folgt, sobald der Förderentscheid von <strong>Innosuisse</strong> vorliegt.',
    },
  },

  /* Grabstein-Modus: Projekt wurde von Innosuisse abgelehnt.
   * show: true  → ganzer Bildschirm = Grabstein (keine News, kein Countdown)
   * show: false → normales Dashboard */
  grave: {
    show:    true,
    kicker:  'In Gedenken an',
    name:    'Britney',
    sub:     'KI-Forschungsprojekt · VGT × FHNW',
    dates:   '2026 – 2026',
    epitaph: 'Oops!… Innosuisse did it again.',
    note:    'Sie hätte einen IQ von 180 erreicht. Ganz bestimmt.',
    footer:  'Statt Blumen: Förderanträge werden weiterhin gerne entgegengenommen.',
    animate: true,   /* Kerzen flackern, Geist schwebt. false = komplett still */
  },

  iq: {
    show:    false,  /* IQ-Anzeige unten ein-/ausblenden */
    current: 20,   /* 0 = noch keine Daten → zeigt »--«. Später hochsetzen (z. B. britney.setIQ(60)). */
    start:   0,    /* Linkes Ende der Skala / des Balkens */
    target:  180,  /* Rechtes Ende der Skala (Ziel) */
  },

  /* Was steht in der Mitte?
   *   'news'  – rotierende KI-/Energie-News (Daten aus news_pipeline/)
   *   'video' – der Britney-Loop (siehe video unten) */
  center: 'news',

  /* News-Widget (nur bei center: 'news') */
  news: {
    src: './data/news.json',  /* von news_pipeline geschrieben; Bilder/QR relativ dazu */
    rotateSeconds: 18,        /* Anzeigedauer pro Karte */
    fadeMs: 1200,             /* weicher Crossfade zwischen Karten */
    reloadMinutes: 10,        /* news.json neu laden (übernommen beim nächsten Wechsel) */
    newHours: 6,              /* «Neu»-Badge für Meldungen jünger als X Stunden */
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

  /* Galaxie-Hintergrund (Sternenfeld + Milchstraßenband + Nebel, rein CSS):
   *   'aurora' – Nebelschleier ziehen langsam durchs Sternenfeld
   *   'static' – Nebel stehen fest, keine Bewegung (falls der Pi ruckelt)
   *   'off'    – nur Sternenfeld auf flachem Weltraum-Schwarz (stromsparend)
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
