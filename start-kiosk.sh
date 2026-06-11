#!/usr/bin/env bash
# Britney-Kiosk-Start: Webserver -> Chromium-Kiosk.
# Wird vom Autostart (~/.config/autostart/britney.desktop) aufgerufen.
# serve.py liest auch den PIR-Sensor und stellt ihn unter /motion bereit;
# ein separater Sensor-Prozess ist nicht mehr noetig.
# Logs landen in /tmp/britney-*.log zum schnellen Debuggen.

cd "$(dirname "$0")" || exit 1
export DISPLAY="${DISPLAY:-:0}"

# Chromium heisst je nach Raspberry-Pi-OS-Version anders
CHROME="$(command -v chromium-browser || command -v chromium)"

# 1) Webserver (serviert Seite + Videos, liest den PIR-Sensor)
python3 serve.py >/tmp/britney-serve.log 2>&1 &

# 2) Chromium-Kiosk (kurz warten, bis der Server lauscht)
#    --password-store=basic: nutzt NICHT den GNOME-Keyring -> keine Passwort-
#    Abfrage beim Start (sonst blockiert sie den Kiosk).
sleep 3
"$CHROME" --kiosk --noerrdialogs --disable-infobars \
  --disable-restore-session-state \
  --password-store=basic \
  --autoplay-policy=no-user-gesture-required \
  http://localhost:8000/ >/tmp/britney-chromium.log 2>&1 &

wait
