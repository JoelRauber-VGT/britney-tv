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

## Britney-Videos (Mitte)

Die Videos liegen direkt in `vidoes/` und sind paarweise benannt:

| Datei | Rolle |
| --- | --- |
| `britney_1.mp4` … `britney_4.mp4` | Stand-Loops — laufen endlos, bis Bewegung kommt |
| `transition_1.mp4` … `transition_4.mp4` | Übergang von `britney_N` zu `britney_(N+1)` |

**Ablauf:** `britney_1` läuft im Loop → Bewegung → `transition_1` spielt einmal
→ `britney_2` läuft im Loop → Bewegung → `transition_2` … Nach `transition_4`
geht es zurück auf `britney_1`. Die Anzahl der Stufen steuert
`video.stages` in `config.js`.

Möchtet ihr mehr/weniger Stufen, einfach Dateien `britney_N` / `transition_N`
ergänzen bzw. entfernen und `video.stages` anpassen.

## Bewegungssensor & Steuerung über die Shell

Eine Stufe wird auf zwei Wegen ausgelöst — beide laufen über denselben Pfad
(`window.britney.motion()`):

- **PIR-Sensor (BS412):** `serve.py` liest GPIO4 selbst und zählt jede Bewegung
  unter `/motion` hoch; die Seite pollt das und schaltet weiter. Kein xdotool,
  kein separater Prozess, **funktioniert auch unter Wayland**. Pin/Pegel mit
  `sensor/bs412_test.py` prüfen; die Werte stehen in `serve.py`
  (`MOTION_PIN`, `MOTION_PULL_UP`). Details: `sensor/README.md`.

- **Browser-Konsole / lokaler Test:** Leertaste drücken oder

  ```js
  britney.motion();    // eine Stufe weiter (entprellt, wie der Sensor)
  britney.advance();   // sofort weiter (ohne Entprellung)
  britney.reset();     // zurück auf britney_1
  britney.stage();     // aktuelle Stufe abfragen
  ```

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
zuerst dort nachsehen. Der **PIR-Sensor läuft im Server mit** (`serve.py`
liest GPIO4 und stellt ihn unter `/motion` bereit) — kein xdotool, kein
separater Sensor-Prozess, funktioniert auch unter Wayland.

Täglicher Auto-Reload um 4 Uhr (`kiosk.dailyReloadHour`) gegen Memory-Drift im
Dauerbetrieb.

## Dateien

| Datei | Zweck |
| --- | --- |
| `config.js` | **Die einzige Datei für den Alltag** — IQ, Daten, Texte, Videos |
| `serve.py` | Lokaler Webserver (`http://localhost:8000`) + PIR-Sensor → `/motion` |
| `start-kiosk.sh` | Autostart-Skript: startet Server + Chromium-Kiosk |
| `index.html` | Seitengerüst (HUD + Video- und Logo-Bühne) |
| `app.js` | Countdown, IQ-Anzeige, Video-Steuerung, `britney`-API, Auto-Reload |
| `tokens.css` / `style.css` | Design-Tokens und Layout |
| `vgt.png` / `fhnw.jpg` | Logos der Forschungskooperation |
| `vidoes/` | Die Video-Clips (`britney_N.mp4`, `transition_N.mp4`) |
| `sensor/bs412_test.py` | PIR-Schnelltest: zeigt Pin-Pegel live an |
| `vendor/fonts/` | Schriften, lokal eingebunden (offline-fest) |
