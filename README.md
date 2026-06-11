# Britney Dashboard

75″-Hochformat-Dashboard fürs Forschungsprojekt **Britney**. Läuft auf einem
Raspberry Pi 4 im Chromium-Kiosk-Modus.

- **Oben** · Countdown bis Projektende
- **Mitte** · Forschungskooperation **VGT × FHNW** (Logos)
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

**IQ ohne Reload ändern** — in der Browser-Konsole:

```js
britney.setIQ(85);
```

Seite neu laden: am Pi `F5` oder Strom aus/an (startet von selbst).

## Webserver? Nein.

Die Seite ist **reines statisches HTML** und läuft direkt über `file://` —
einfach `index.html` im Browser öffnen, kein `python3 -m http.server` o. Ä.
nötig. Das hält den Pi-Autostart minimal.

## Aufsetzen auf dem Raspberry Pi

```bash
# 1. Projektordner auf den Pi kopieren, z. B. nach /home/pi/britney-dashboard

# 2. Bildschirm auf Hochformat drehen (Einstellungen → Screen Configuration)

# 3. Autostart einrichten:
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/britney.desktop <<'DESKTOP'
[Desktop Entry]
Type=Application
Name=Britney Dashboard
Exec=chromium-browser --kiosk --noerrdialogs --disable-restore-session-state file:///home/pi/britney-dashboard/index.html
DESKTOP

# 4. Bildschirm-Blanking ausschalten:
sudo raspi-config   # → Display Options → Screen Blanking → Off
```

Alles läuft **lokal** (Schriften liegen im Projekt) — kein Internet nötig.
Täglicher Auto-Reload um 4 Uhr (`kiosk.dailyReloadHour`) gegen Memory-Drift im
Dauerbetrieb.

## Dateien

| Datei | Zweck |
| --- | --- |
| `config.js` | **Die einzige Datei für den Alltag** — IQ, Daten, Texte |
| `index.html` | Seitengerüst (HUD + Logo-Bühne) |
| `app.js` | Countdown, IQ-Anzeige, `britney`-API, Auto-Reload |
| `tokens.css` / `style.css` | Design-Tokens und Layout |
| `vgt.png` / `fhnw.jpg` | Logos der Forschungskooperation |
| `vendor/fonts/` | Schriften, lokal eingebunden (offline-fest) |
