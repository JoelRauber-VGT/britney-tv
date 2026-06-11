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

# Alte Chromium-Instanzen + Profil-Lock entfernen, damit es NUR EIN Fenster gibt.
# Zwei Instanzen -> eine verdeckt die andere -> Chromium drosselt Timer/rAF der
# verdeckten Seite (setInterval ~1x/Minute, requestAnimationFrame gar nicht) ->
# /motion-Polling und Video-Uebergaenge stehen praktisch still.
pkill -9 -f chromium 2>/dev/null
rm -f "$HOME/.config/chromium/SingletonLock" 2>/dev/null

# 2) Chromium-Kiosk (kurz warten, bis der Server lauscht)
#    --password-store=basic: nutzt NICHT den GNOME-Keyring -> keine Passwort-
#    Abfrage beim Start (sonst blockiert sie den Kiosk).
#    Die drei --disable-*-Flags verhindern das Hintergrund-/Occlusion-Throttling:
#    ohne sie drosselt Chromium Timer + requestAnimationFrame, sobald es das
#    Fenster fuer verdeckt haelt -> Sensor-Polling und Uebergaenge frieren ein.
sleep 3
"$CHROME" --kiosk --noerrdialogs --disable-infobars \
  --disable-restore-session-state \
  --password-store=basic \
  --autoplay-policy=no-user-gesture-required \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-features=CalculateNativeWinOcclusion \
  http://localhost:8000/ >/tmp/britney-chromium.log 2>&1 &

wait
