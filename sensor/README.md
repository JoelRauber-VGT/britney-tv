# PIR-Sensor (BS412) → Britney-Videos

Bewegungs-Trigger für die Mitte des Dashboards. Bei jeder erkannten Bewegung
wird eine Stufe weitergeschaltet: `britney_N` (Loop) → `transition_N` (einmal)
→ `britney_(N+1)` (Loop). Nach der letzten Stufe geht es zurück auf `britney_1`.

**Technik:** `serve.py` liest GPIO4 selbst und zählt jede Bewegung unter
`http://localhost:8000/motion` hoch. Die Seite pollt diese Adresse (gleicher
Origin → kein CORS) und schaltet bei neuem Zählerstand weiter. Kein xdotool,
kein separater Sensor-Prozess, **funktioniert auch unter Wayland**.

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
Diese Werte stehen in `serve.py` (`MOTION_PIN`, `MOTION_PULL_UP`).

## 1. Hardware testen

```bash
python3 sensor/bs412_test.py
```
Hand quer vor der Linse bewegen → `GPIO4` wechselt 0 ↔ 1. Beenden mit Strg+C.

> Es kann nur **ein** Prozess den GPIO halten. Vor `serve.py` den Test mit
> Strg+C beenden (und umgekehrt).

## 2. Betrieb

`serve.py` macht alles in einem Prozess — Seite servieren, Videos ausliefern
und den Sensor lesen:

```bash
python3 serve.py          # http://localhost:8000  +  /motion
```
Beim Start meldet es `PIR-Sensor aktiv: GPIO4 -> /motion`. Bei Bewegung
erscheint `Bewegung #1`, `#2` … und das Video schaltet weiter.

Läuft `serve.py` auf einem Rechner ohne GPIO (Entwicklung), wird der Sensor
still übersprungen — die Leertaste schaltet dann manuell weiter.

## 3. Autostart

Siehe Haupt-`README.md` → „Aufsetzen auf dem Raspberry Pi". Der Autostart ruft
`start-kiosk.sh` auf (Server + Chromium); der Sensor läuft im Server mit.
