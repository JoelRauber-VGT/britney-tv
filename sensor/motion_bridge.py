#!/usr/bin/env python3
"""BS412 -> Dashboard Bridge.

Liest den PIR-Sensor an GPIO4 und stellt einen Bewegungs-Zaehler ueber
einen winzigen lokalen HTTP-Server bereit. Das Dashboard (file://) pollt
http://127.0.0.1:8765/motion und blendet bei jedem neuen Zaehlerstand
das Symbol ein.

Nur Standardbibliothek + gpiozero, keine Extra-Pakete.

Manuell starten:   python3 sensor/motion_bridge.py
Autostart:         als systemd-Service (siehe sensor/README.md)

Wichtig: Es kann immer nur EIN Prozess den GPIO halten. Vorher den
Hardware-Test (bs412_test.py) beenden, sonst belegt er den Pin.
"""
from gpiozero import DigitalInputDevice
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import threading

# ── Einstellungen ─────────────────────────────────────────────────
PIN = 4                       # BCM-Pin, an dem OUT (Sensor-Pin 4) haengt
HOST, PORT = "127.0.0.1", 8765
# ──────────────────────────────────────────────────────────────────

count = 0
lock = threading.Lock()


def on_motion():
    """Callback bei jeder steigenden Flanke (Bewegung erkannt)."""
    global count
    with lock:
        count += 1
        current = count
    print(f"Bewegung #{current}", flush=True)


# pull_up=False -> interner Pull-down, aktiv = High (wie im Hardware-Test bestaetigt)
sensor = DigitalInputDevice(PIN, pull_up=False)
sensor.when_activated = on_motion


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        # file:// (Origin "null") und Chromiums Private-Network-Access erlauben
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Allow-Methods", "GET")
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/motion"):
            with lock:
                body = json.dumps({"count": count}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *args):
        pass  # HTTP-Zugriffe nicht ins Log spammen


if __name__ == "__main__":
    print(f"PIR-Bridge laeuft: GPIO{PIN} -> http://{HOST}:{PORT}/motion  (Strg+C beendet)", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
