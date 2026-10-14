# Britney Dashboard

75″-Hochformat-Dashboard fürs Forschungsprojekt **Britney**. Läuft auf einem
Raspberry Pi 4 im Chromium-Kiosk-Modus.

- **Oben** · Countdown bis Projektende
- **Mitte** · Britney-Videos (Stand-Loop, per Bewegungssensor weitergeschaltet)
  über der Forschungskooperation **VGT × FHNW** (Logos)
- **Unten** · aktueller IQ-Stand, vom Team über die Laufzeit hochgesetzt

Bewusst schlicht und robust: reines HTML/CSS/JS, keine Frameworks, keine
externen Abhängigkeiten, kein Internet nötig.

## Bedienung im Alltag

Alles in **`config.js`** — das ist die einzige Datei, die ihr im Alltag anfasst.

| Stellschraube | Wirkung |
| --- | --- |
| `iq.current` | Aktueller IQ-Stand (Großzahl unten). Hochsetzen → Seite neu laden |
| `iq.start` / `iq.target` | Start- und Zielwert (bestimmen den Fortschrittsbalken) |
| `project.start` / `project.end` | Zeitraum für den Countdown (ISO-Format) |
| `project.phase` | Phasen-Text oben rechts (`''` = ausblenden) |
| `collab.caption` | Bildunterschrift unter den Logos |
| `kiosk.dailyReloadHour` | Stunde des täglichen Auto-Reloads (`-1` = aus) |
| `video.*` | Britney-Videos (Ordner, Anzahl Stufen, Crossfade, Entprellung) |

**IQ ohne Reload ändern** — in der Browser-Konsole:

```js
britney.setIQ(85);
```

Seite neu laden: am Pi `F5` oder Strom aus/an (startet von selbst).

## Mitte: News-Widget

Standardmässig zeigt die Mitte rotierende Karten mit kuratierten **KI- und
Energie-News** (`center: 'news'` in `config.js`). Jede Karte enthält ein generiertes
Bild, eine Kategorie, die Headline, eine kurze Zusammenfassung, die Quelle und
einen QR-Code zum Originalartikel.

- Die Daten liefert `news_pipeline/` (Python, per Cron alle 3 h) nach
  `data/news.json`. Setup, Cron und Kosten stehen in `news_pipeline/README.md`.
- Einstellungen in `config.js` → `news`: Anzeigedauer (`rotateSeconds`, 18 s),
  Reload-Intervall (`reloadMinutes`, 10 min), «Neu»-Badge (`newHours`, 6 h).
- Fehlt `news.json` oder ist sie kaputt, bleiben die letzten Daten stehen. Ganz
  ohne Daten zeigt das Widget einen ruhigen Platzhalter.
- Test in der Browser-Konsole: `britney.nextNews()`.

**Zurück zum Britney-Video:** `center: 'video'` in `config.js` → `britney_loop.mp4`
läuft wieder im Loop.

**PIR-Sensor:** trieb nur die früheren Video-Stufen und ist jetzt standardmässig
aus. Der Code in `serve.py` ist erhalten; einschalten mit
`BRITNEY_MOTION=1 python3 serve.py`. `/motion` antwortet immer (das Start-Skript
prüft damit, ob der Server läuft).

## Start über localhost

Die Seite läuft über einen winzigen lokalen Webserver (`serve.py`, nur
Python-Standardbibliothek — nichts zu installieren). Das ist nötig, damit die
Videos sauber per HTTP mit Range-Requests ausgeliefert werden; über `file://`
schränken manche Browser `<video>` ein.

```bash
python serve.py            # Windows
python3 serve.py           # Raspberry Pi / Linux
python serve.py --open     # zusätzlich den Standardbrowser öffnen
python serve.py 9000       # anderer Port (Standard: 8000)
```

Danach im Browser: **http://localhost:8000**

Alles läuft **lokal** (Server, Videos, Schriften liegen im Projekt) — kein
Internet nötig.

## Aufsetzen auf dem Raspberry Pi

```bash
# 1. Projektordner auf den Pi kopieren, z. B. nach /home/pi/britney-dashboard

# 2. Bildschirm auf Hochformat drehen (Einstellungen → Screen Configuration)

# 3. Autostart einrichten — ruft das Start-Skript auf (Server + Chromium).
#    Pfad an euren Repo-Ort anpassen (hier: /home/britney-tv/britney-tv).
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/britney.desktop <<'DESKTOP'
[Desktop Entry]
Type=Application
Name=Britney Dashboard
Exec=/home/britney-tv/britney-tv/start-kiosk.sh
DESKTOP

# 4. Bildschirm-Blanking ausschalten:
sudo raspi-config   # → Display Options → Screen Blanking → Off
```

`start-kiosk.sh` startet Webserver und Chromium-Kiosk und schreibt Logs nach
`/tmp/britney-serve.log` und `/tmp/britney-chromium.log` — bei Problemen
zuerst dort nachsehen.

Täglicher Auto-Reload um 4 Uhr (`kiosk.dailyReloadHour`) gegen Memory-Drift im
Dauerbetrieb.

## Dateien

| Datei | Zweck |
| --- | --- |
| `config.js` | **Die einzige Datei für den Alltag** — IQ, Daten, Texte, Mitte (News/Video) |
| `serve.py` | Lokaler Webserver (`http://localhost:8000`), optional PIR-Sensor → `/motion` |
| `start-kiosk.sh` | Autostart-Skript: startet Server + Chromium-Kiosk |
| `index.html` | Seitengerüst (HUD + News-/Video-Mitte + Logo-Bühne) |
| `app.js` | Countdown, IQ-Anzeige, Video (bei `center: 'video'`), `britney`-API, Auto-Reload |
| `news.js` | News-Widget: Rotation, Crossfade, Reload, Fallback |
| `news_pipeline/` | Python-Job: Feeds → LLM-Kuratierung → Bilder/QR → `data/news.json` |
| `data/` | Generierter News-Output (nicht im Git) |
| `tokens.css` / `style.css` | Design-Tokens und Layout |
| `vgt.png` / `fhnw.jpg` | Logos der Forschungskooperation |
| `britney_loop.mp4` | Der Britney-Loop (nur bei `center: 'video'`) |
| `sensor/bs412_test.py` | PIR-Schnelltest: zeigt Pin-Pegel live an |
| `vendor/fonts/` | Schriften, lokal eingebunden (offline-fest) |
