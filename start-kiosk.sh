#!/usr/bin/env bash
# Britney-Kiosk-Start: Webserver -> Chromium-Kiosk -> PIR-Sensor.
# Wird vom Autostart (~/.config/autostart/britney.desktop) aufgerufen.
# Logs landen in /tmp/britney-*.log zum schnellen Debuggen.

cd "$(dirname "$0")" || exit 1
export DISPLAY="${DISPLAY:-:0}"

# Chromium heisst je nach Raspberry-Pi-OS-Version anders
CHROME="$(command -v chromium-browser || command -v chromium)"

# 1) Webserver (Videos brauchen HTTP)
python3 serve.py >/tmp/britney-serve.log 2>&1 &

# 2) Chromium-Kiosk (kurz warten, bis der Server lauscht)
sleep 3
"$CHROME" --kiosk --noerrdialogs --disable-infobars \
  --disable-restore-session-state \
  --autoplay-policy=no-user-gesture-required \
  http://localhost:8000/ >/tmp/britney-chromium.log 2>&1 &

# 3) PIR-Sensor (warten, bis das Kiosk-Fenster offen und fokussiert ist)
sleep 5
python3 sensor/bs412_motion.py >/tmp/britney-sensor.log 2>&1 &

wait
