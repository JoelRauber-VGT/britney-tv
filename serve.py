#!/usr/bin/env python3
"""Britney Dashboard - lokaler Webserver.

Serviert den Projektordner unter http://localhost:8000 (bzw. PORT). Noetig,
weil die Videos sauber per HTTP (mit Range-Requests) ausgeliefert werden und
manche Browser <video> ueber file:// einschraenken.

Nur Python-Standardbibliothek - keine Installation noetig.

Starten:
    python serve.py            # Windows
    python3 serve.py           # Raspberry Pi / Linux

Optionen:
    python serve.py 9000       # anderer Port
    python serve.py --open     # Standardbrowser automatisch oeffnen

Danach im Browser:  http://localhost:8000
Beenden:            Strg+C
"""
import json
import os
import shutil
import sys
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# ── PIR-Sensor (BS412 an GPIO4) ───────────────────────────────────
# serve.py liest den Sensor selbst und zaehlt jede Bewegung hoch. Die Seite
# pollt /motion (gleicher Origin -> kein CORS, kein xdotool/Wayland-Problem).
# Werte aus sensor/bs412_test.py: aktiv-high, interner Pull-down.
MOTION_PIN = 4
MOTION_PULL_UP = False
_motion_count = 0
_motion_lock = threading.Lock()
_sensor = None            # haelt das Sensor-Objekt am Leben (sonst GC)


def _bump_motion():
    global _motion_count
    with _motion_lock:
        _motion_count += 1
        n = _motion_count
    print(f"Bewegung #{n}", flush=True)


def start_motion_sensor():
    """Startet den PIR-Sensor, falls GPIO/gpiozero verfuegbar sind.
    Auf einem Entwicklungs-PC ohne GPIO wird still uebersprungen."""
    global _sensor
    try:
        from gpiozero import DigitalInputDevice
    except Exception:
        print("gpiozero nicht vorhanden -> PIR-Sensor aus (Dev-Modus).", flush=True)
        return
    try:
        _sensor = DigitalInputDevice(MOTION_PIN, pull_up=MOTION_PULL_UP)
    except Exception as e:
        print(f"PIR-Sensor an GPIO{MOTION_PIN} nicht verfuegbar: {e}", flush=True)
        return
    _sensor.when_activated = _bump_motion
    print(f"PIR-Sensor aktiv: GPIO{MOTION_PIN} -> /motion", flush=True)

# .woff2 / .mjs / .mp4 sauber ausliefern (aelteren Python-Versionen fehlt das teils)
EXTRA_TYPES = {
    ".mp4": "video/mp4",
    ".woff2": "font/woff2",
    ".mjs": "text/javascript",
}

# Grosse Mediendateien duerfen vom Browser gecacht werden (kein Re-Download beim
# Loopen/Reload); Code/Markup bleibt frisch, damit der Kiosk Aenderungen sieht.
CACHEABLE = (".mp4", ".woff2", ".png", ".jpg", ".jpeg", ".webp", ".gif")


class Handler(SimpleHTTPRequestHandler):
    """Statischer Handler mit Range-Support (Video-Seeking/Loop) und schnellem I/O.

    Ohne diese beiden Einstellungen schreibt Pythons http.server ungepuffert
    und mit Nagle-Algorithmus -> auf localhost nur ~1-2 MB/s, das Video laggt.
    """

    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **EXTRA_TYPES}
    wbufsize = 1024 * 1024            # gepufferte Writes statt Byte-fuer-Byte
    disable_nagle_algorithm = True    # TCP_NODELAY -> keine Sende-Verzoegerung

    def do_GET(self):
        # Bewegungs-Zaehler fuer die Seite (gleicher Origin)
        if self.path.split("?", 1)[0] == "/motion":
            with _motion_lock:
                body = json.dumps({"count": _motion_count}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def copyfile(self, source, outputfile):
        # 1-MB-Bloecke statt der Standard-64 KB -> deutlich weniger Syscalls
        shutil.copyfileobj(source, outputfile, length=1024 * 1024)

    def end_headers(self):
        path = self.path.split("?", 1)[0].lower()
        if path.endswith(CACHEABLE):
            self.send_header("Cache-Control", "public, max-age=86400")
        else:
            # Code/Markup: Kiosk soll bei F5 immer die frischen Dateien sehen
            self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def send_head(self):
        """Wie das Original, aber mit HTTP-Range (206 Partial Content)."""
        rng = self.headers.get("Range")
        if rng is None:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        try:
            size = os.fstat(f.fileno()).st_size
            start, end = self._parse_range(rng, size)
            if start is None:
                self.send_error(416, "Requested Range Not Satisfiable")
                self.send_header("Content-Range", f"bytes */{size}")
                f.close()
                return None

            self.send_response(206)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", str(end - start + 1))
            self.end_headers()
            f.seek(start)
            self._remaining = end - start + 1
            return _RangeReader(f, end - start + 1)
        except Exception:
            f.close()
            raise

    @staticmethod
    def _parse_range(header, size):
        if not header.startswith("bytes="):
            return None, None
        first, _, last = header[len("bytes="):].partition("-")
        try:
            if first == "":            # bytes=-N  (letzte N Bytes)
                n = int(last)
                if n == 0:
                    return None, None
                start = max(0, size - n)
                return start, size - 1
            start = int(first)
            end = int(last) if last else size - 1
        except ValueError:
            return None, None
        end = min(end, size - 1)
        if start > end:
            return None, None
        return start, end


class _RangeReader:
    """Liefert nur die angeforderten Bytes (copyfile liest bis EOF)."""

    def __init__(self, fileobj, length):
        self._f = fileobj
        self._left = length

    def read(self, n=-1):
        if self._left <= 0:
            return b""
        if n < 0 or n > self._left:
            n = self._left
        data = self._f.read(n)
        self._left -= len(data)
        return data

    def close(self):
        self._f.close()


def main():
    port = 8000
    do_open = False
    for arg in sys.argv[1:]:
        if arg in ("--open", "-o"):
            do_open = True
        elif arg.isdigit():
            port = int(arg)

    root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root)

    start_motion_sensor()   # PIR-Sensor lesen (falls vorhanden)

    server = ThreadingHTTPServer(("0.0.0.0", port), partial(Handler, directory=root))
    url = f"http://localhost:{port}/"
    print(f"Britney Dashboard laeuft auf {url}")
    print(f"Ordner: {root}")
    print("Strg+C beendet.")
    if do_open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer gestoppt.")
        server.shutdown()


if __name__ == "__main__":
    main()
