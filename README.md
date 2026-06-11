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

Die Videos liegen im Ordner **`vidoes/`** und sind paarweise benannt:

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

Eine Stufe wird auf drei Wegen ausgelöst — alle laufen über denselben Pfad
(`window.britney.motion()`):

- **PIR-Sensor (BS412):** `sensor/bs412_motion.py` schaltet bei jeder Bewegung
  eine Stufe weiter. Vorher Pin/Pegel mit `sensor/bs412_test.py` prüfen und im
  Skript oben (`PIN`, `PULL_UP`, `ACTIVE_VALUE`) eintragen.

  ```bash
  sudo apt install xdotool          # einmalig
  DISPLAY=:0 python3 sensor/bs412_motion.py
  ```

- **Pi-Shell (Test ohne Sensor):** löst per Tastendruck genau eine Stufe aus —
  ideal zum Durchklicken aller Übergänge.

  ```bash
  DISPLAY=:0 xdotool key space
  ```

- **Browser-Konsole / lokaler Test:** Leertaste drücken oder

  ```js
  britney.motion();    // eine Stufe weiter (entprellt, wie der Sensor)
  britney.advance();   // sofort weiter (ohne Entprellung)
  britney.reset();     // zurück auf britney_1
  britney.stage();     // aktuelle Stufe abfragen
  ```

Der Sensor-Weg nutzt `xdotool key space`, weil das Dashboard ohne Webserver
direkt über `file://` läuft — so ist keine Browser-Anbindung (Server/CDP) nötig.

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

# 3. xdotool installieren (für den PIR-Sensor-Trigger):
sudo apt install xdotool

# 4. Autostart einrichten — Server, dann Chromium, dann Sensor-Trigger:
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/britney.desktop <<'DESKTOP'
[Desktop Entry]
Type=Application
Name=Britney Dashboard
Exec=sh -c "cd /home/pi/britney-dashboard && python3 serve.py & sleep 2 && chromium-browser --kiosk --noerrdialogs --disable-restore-session-state http://localhost:8000/ & sleep 5 && python3 sensor/bs412_motion.py"
DESKTOP

# 5. Bildschirm-Blanking ausschalten:
sudo raspi-config   # → Display Options → Screen Blanking → Off
```

Der Sensor läuft hier im selben X-Desktop wie Chromium, daher findet
`xdotool` das Kiosk-Fenster automatisch (kein `DISPLAY` nötig). Pfad
`/home/pi/britney-dashboard` an euren Repo-Pfad anpassen.

Täglicher Auto-Reload um 4 Uhr (`kiosk.dailyReloadHour`) gegen Memory-Drift im
Dauerbetrieb.

## Dateien

| Datei | Zweck |
| --- | --- |
| `config.js` | **Die einzige Datei für den Alltag** — IQ, Daten, Texte, Videos |
| `serve.py` | Lokaler Webserver (`http://localhost:8000`), nur Python-Stdlib |
| `index.html` | Seitengerüst (HUD + Video- und Logo-Bühne) |
| `app.js` | Countdown, IQ-Anzeige, Video-Steuerung, `britney`-API, Auto-Reload |
| `tokens.css` / `style.css` | Design-Tokens und Layout |
| `vgt.png` / `fhnw.jpg` | Logos der Forschungskooperation |
| `vidoes/` | Britney-Videos (`britney_N.mp4`, `transition_N.mp4`) |
| `sensor/bs412_test.py` | PIR-Schnelltest: zeigt Pin-Pegel live an |
| `sensor/bs412_motion.py` | PIR im Betrieb → schaltet bei Bewegung eine Stufe weiter |
| `vendor/fonts/` | Schriften, lokal eingebunden (offline-fest) |
