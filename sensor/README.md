# PIR-Sensor (BS412) → Britney-Videos

Bewegungs-Trigger für die Mitte des Dashboards. Bei jeder erkannten Bewegung
wird eine Stufe weitergeschaltet: `britney_N` (Loop) → `transition_N` (einmal)
→ `britney_(N+1)` (Loop). Nach der letzten Stufe geht es zurück auf `britney_1`.

Technik: `bs412_motion.py` liest GPIO4 und sendet bei Bewegung einen
**Leertasten-Druck** an den Kiosk-Browser (`xdotool key space`) — exakt der
Weg, den auch der manuelle Test nutzt. Kein zusätzlicher Webserver für den
Sensor, keine Browser-Änderung nötig.

## Hardware

BS412 (Senba), digitaler PIR, **3,3 V** (max. 3,6 V — **nie 5 V!**),
Reichweite ~5 m / 120°. Pinbelegung laut Datenblatt: `1=GND · 2=ONTIME ·
3=VDD · 4=OUT`. Der **weiße Punkt** am Gehäuse markiert **Pin 1 (GND)**.

| Sensor-Pin | Funktion | Raspberry Pi 4 |
|---|---|---|
| 1 (weißer Punkt) | GND | Pin 6 (GND) |
| 3 (gegenüber Punkt) | VDD | **Pin 1 (3,3 V)** |
| 4 (Seite) | OUT | Pin 7 (GPIO4) |
| 2 (Seite) | ONTIME | Pin 9 (GND) → 2 s Haltezeit |

Bestätigte Pegel: `PULL_UP = False`, **Bewegung = 1** (aktiv-high).

## 1. Hardware testen

```bash
python3 sensor/bs412_test.py
```
Hand quer vor der Linse bewegen → `GPIO4` wechselt 0 ↔ 1. Beenden mit Strg+C.

## 2. Dashboard starten (Videos brauchen HTTP)

```bash
python3 serve.py            # serviert http://localhost:8000
```
Chromium im Kiosk auf `http://localhost:8000` zeigen lassen. Die Leertaste
schaltet das Video manuell weiter (Test ohne Sensor).

## 3. Sensor-Trigger starten

Voraussetzung einmalig:
```bash
sudo apt install xdotool
```
Dann (Test vorher mit Strg+C beenden — nur ein Prozess darf den GPIO halten):
```bash
DISPLAY=:0 python3 sensor/bs412_motion.py
```
Bewegung vor dem Sensor → Video schaltet eine Stufe weiter.

## 4. Autostart beim Booten (systemd)

```bash
sudo cp sensor/britney-motion.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now britney-motion.service
```

Status / Logs:
```bash
systemctl status britney-motion.service
journalctl -u britney-motion.service -f
```

Der Service geht von `~/britney-tv/britney-tv` und Benutzer `britney-tv` aus
und braucht das X-Display des Kiosks (`DISPLAY=:0`). Liegt das Repo woanders
oder heißt der Benutzer anders, die `.service`-Datei anpassen.
