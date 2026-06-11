#!/usr/bin/env python3
"""BS412 - Hardware-Schnelltest.

Zeigt live, was am GPIO-Pin passiert, wenn du die Hand vor den Sensor
bewegst. Damit prufen wir VOR der Dashboard-Anbindung:
  1. richtiger Pin / Verkabelung,
  2. ob ein interner Pull-up gebraucht wird,
  3. welcher Pegel "Bewegung" bedeutet.

Auf dem Pi ausfuhren:   python3 sensor/bs412_test.py
Beenden:                Strg+C
"""
from gpiozero import DigitalInputDevice
import time

# ── Anpassen ──────────────────────────────────────────────────────
PIN = 4           # BCM-Nummer, an der OUT (Sensor-Pin 4) haengt = GPIO4
PULL_UP = False   # BS412-OUT geht bei Bewegung aktiv auf 3,3 V high
                  # -> interner Pull-down (pull_up=False), aktiv = High.
# ──────────────────────────────────────────────────────────────────

sensor = DigitalInputDevice(PIN, pull_up=PULL_UP)

print(f"Lese GPIO{PIN} (pull_up={PULL_UP}).")
print("Bewege die Hand vor den Sensor - die Zeile aendert sich bei jeder Flanke.")
print("Strg+C beendet.\n")

last = None
changes = 0
while True:
    v = sensor.value
    if v != last:
        if last is not None:
            changes += 1
        print(f"  GPIO{PIN} = {v}   (Wechsel: {changes})")
        last = v
    time.sleep(0.02)
