#!/usr/bin/env python3
"""BS412 -> Britney-Dashboard (Produktion).

Bei jeder erkannten Bewegung wird im Chromium-Kiosk eine Stufe weiter-
geschaltet:  britney_N (Loop) -> transition_N -> britney_(N+1) (Loop).

Technik: Wir senden dem Kiosk-Browser einen Leertasten-Druck
(`xdotool key space`). Das Dashboard hoert auf die Leertaste und ruft
intern window.britney.motion() auf -- exakt derselbe Weg wie beim
manuellen Test. Kein Webserver, keine Browser-Aenderung noetig.

Voraussetzungen auf dem Pi:
    sudo apt install xdotool
    (gpiozero ist auf Raspberry Pi OS meist schon vorhanden)

VOR dem ersten Einsatz Pin/Pegel mit sensor/bs412_test.py pruefen und
unten ACTIVE_VALUE / PIN / PULL_UP entsprechend setzen.

Manuell ueber die Shell testen (ohne Sensor, ohne dieses Skript):
    DISPLAY=:0 xdotool key space

Starten:
    DISPLAY=:0 python3 sensor/bs412_motion.py
Beenden:  Strg+C
"""
import os
import subprocess
import time
from gpiozero import DigitalInputDevice

# -- Anpassen (Werte aus bs412_test.py uebernehmen) ----------------
PIN = 4              # BCM-Nummer, an der "Direct Link" haengt
PULL_UP = True      # BS412 ist open-drain -> interner Pull-up an
ACTIVE_VALUE = 0    # welcher Pegel "Bewegung" bedeutet (im Test ablesen)
DISPLAY = ":0"      # X-Display des Kiosk-Browsers
# ------------------------------------------------------------------


def advance_kiosk():
    """Eine Stufe im Dashboard weiterschalten (Leertaste an den Browser)."""
    env = dict(os.environ, DISPLAY=DISPLAY)
    subprocess.run(["xdotool", "key", "space"], env=env, check=False)


def main():
    sensor = DigitalInputDevice(PIN, pull_up=PULL_UP)
    print(f"BS412 auf GPIO{PIN} -> Kiosk (DISPLAY={DISPLAY}). Strg+C beendet.")

    last = sensor.value
    while True:
        v = sensor.value
        if v != last:
            last = v
            if v == ACTIVE_VALUE:          # Flanke in den "Bewegung"-Pegel
                print("Bewegung erkannt -> eine Stufe weiter")
                advance_kiosk()
        time.sleep(0.02)


if __name__ == "__main__":
    main()
