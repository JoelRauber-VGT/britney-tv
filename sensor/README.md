# PIR-Sensor (BS412) → Dashboard

Bewegungs-Trigger für die Mitte des Dashboards. Bei erkannter Bewegung
blendet das Dashboard kurz ein Symbol ein (Platzhalter für den späteren
Video-Übergang), Zähler läuft 1 → 4 und springt danach auf 0.

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

## 1. Hardware testen

```bash
python3 sensor/bs412_test.py
```
Hand quer vor der Linse bewegen → `GPIO4` wechselt 0 ↔ 1. Beenden mit Strg+C.

## 2. Bridge starten (manuell)

```bash
python3 sensor/motion_bridge.py
```
Liest GPIO4 und stellt den Zähler unter `http://127.0.0.1:8765/motion`
bereit. Das Dashboard pollt diese Adresse automatisch (siehe `config.js`
→ `motion.url`).

> Es kann nur **ein** Prozess den GPIO halten — vor der Bridge den
> Hardware-Test beenden.

## 3. Autostart beim Booten (systemd)

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

Danach läuft die Bridge automatisch mit jedem Boot — nichts mehr von Hand
zu starten. Der Service-Pfad geht von `~/britney-tv/britney-tv` aus; liegt
das Repo woanders, `WorkingDirectory` und `ExecStart` in der `.service`-Datei
anpassen.
