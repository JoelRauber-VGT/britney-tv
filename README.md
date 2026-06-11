# Britney Dashboard

75″-Hochformat-Dashboard fürs Forschungsprojekt Britney. Läuft auf einem
Raspberry Pi 4 im Chromium-Kiosk-Modus. Oben Countdown bis Projektende, in der
Mitte ein **Roboterarm, der live per Reinforcement Learning lernt**, ein
leuchtendes Ziel zu greifen, unten der aktuelle IQ — gekoppelt an die
Lern-Leistung des Arms.

## Was hier passiert

Ein kleiner 3-Gelenk-Roboterarm (rein kinematisch, keine Physik-Engine) soll
seine Fingerspitze an ein zufällig platziertes Ziel führen. Eine winzige
neuronale Policy (MLP 13→24→3) wird per **Evolution Strategies** trainiert —
das Training läuft in einem **Web Worker**, damit das Rendering auf dem Pi
flüssig bleibt. Je besser der Arm trifft, desto höher steigt Britneys IQ.

Damit die angezeigte Leistung **nie abrutscht** (24/7-Betrieb), wird nur eine
auf einem festen Validierungs-Satz nachgewiesene Verbesserung übernommen
(High-Water-Mark). Der IQ steigt dadurch monoton — passend zur „Britney wird
schlauer“-Erzählung.

## Bedienung im Alltag

Alles in **`config.js`** (einzige Datei für den Alltag), Abschnitt `robot`:

| Stellschraube | Wirkung |
| --- | --- |
| `enabled` | Roboter an/aus (aus → nur Countdown + IQ) |
| `startTrained` | `true` = startet mit eingebackenen Gewichten sofort kompetent (Hybrid). `false` = lernt sichtbar von Null |
| `driveIQ` | `true` = IQ folgt live der Lern-Leistung. `false` = IQ manuell (`iq.current`) |
| `showStatus` | Live-Status (Generation / Ø Treffer) unter dem Arm einblenden |
| `pretrained` | Eigene Gewichte; leer = eingebackene aus `rl/pretrained.js` |

Seite neu laden: am Pi `F5` oder Strom aus/an (startet von selbst).

**Bei `driveIQ: false`** den IQ wie gehabt setzen: `iq.current` in `config.js`
oder ohne Reload in der Browser-Konsole `britney.setIQ(85)`.

## Eigene Gewichte einfrieren

Den Arm eine Weile lernen lassen, dann in der Browser-Konsole:

```js
britney.robot.dumpWeights();   // 411 Zahlen → in rl/pretrained.js (PRETRAINED) ersetzen
```

So wird der aktuelle Lernstand zum neuen kompetenten Startpunkt.

## Aufsetzen auf dem Raspberry Pi

Die Seite braucht einen Webserver (ES-Module + Web Worker laufen nicht über
`file://`). Der eingebaute Python-Server reicht:

```bash
# 1. Projektordner auf den Pi kopieren, z. B. nach /home/pi/britney-dashboard

# 2. Bildschirm auf Hochformat drehen (Einstellungen → Screen Configuration)

# 3. Autostart einrichten:
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/britney.desktop <<'DESKTOP'
[Desktop Entry]
Type=Application
Name=Britney Dashboard
Exec=sh -c 'cd /home/pi/britney-dashboard && python3 -m http.server 8080 & sleep 3; chromium-browser --kiosk --noerrdialogs --disable-restore-session-state http://localhost:8080'
DESKTOP

# 4. Bildschirm-Blanking ausschalten:
sudo raspi-config   # → Display Options → Screen Blanking → Off
```

Alles läuft **lokal** (Three.js + Schriften im Projekt) — kein Internet nötig.

## Performance & Robustheit (eingebaut)

- Training im **Web Worker** → Rendering bleibt flüssig, moderate CPU/Thermik
- Pixel-Ratio auf 1,5 gedeckelt, kein MSAA, keine Schatten, kein Postprocessing
- Fällt der Web Worker aus, trainiert ein Main-Thread-Fallback (langsamer)
- Fällt 3D ganz aus, laufen Countdown und IQ trotzdem weiter
- Täglicher Auto-Reload um 4 Uhr (`kiosk.dailyReloadHour`) gegen Memory-Drift

## Dateien

| Datei | Zweck |
| --- | --- |
| `config.js` | **Die einzige Datei für den Alltag** — IQ, Daten, Roboter-Optionen |
| `index.html` | Seitengerüst (Canvas-Bühne + HUD) |
| `app.js` | Countdown, IQ-Anzeige, `britney`-API, Roboter-Start |
| `tokens.css` / `style.css` | Design-Tokens und Layout |
| `rl/reacher.js` | Roboterarm-Umgebung (Kinematik, Belohnung) |
| `rl/net.js` | Winziges MLP (Policy) |
| `rl/trainer.js` | Evolution Strategies + High-Water-Mark |
| `rl/worker.js` | Training-Thread |
| `rl/scene.js` | Three.js-Visualisierung |
| `rl/index.js` | Orchestrator + Render-Loop |
| `rl/pretrained.js` | Eingebackene, vortrainierte Gewichte |
| `vendor/` | Three.js + Schriften, lokal (offline-fest) |
