#!/usr/bin/env bash
# Britney-Kiosk-Start: Webserver -> Chromium-Kiosk.
# Wird vom Autostart (~/.config/autostart/britney.desktop) aufgerufen.
# serve.py liest auch den PIR-Sensor und stellt ihn unter /motion bereit;
# ein separater Sensor-Prozess ist nicht mehr noetig.
# Logs landen in /tmp/britney-*.log zum schnellen Debuggen.

cd "$(dirname "$0")" || exit 1
export DISPLAY="${DISPLAY:-:0}"

# HDMI-CEC: Adapter registrieren UND den TV aktiv aufwecken.
# WICHTIG: Das passiert hier INNERHALB der Wayland-Session (Autostart nach dem
# 07:00-Reboot). Nur so setzt kanshi danach Aufloesung + Rotation sauber. Ein
# separater Cron-Aufruf ausserhalb der Session weckt den TV zwar, aber ohne
# kanshi -> falsches Bildformat. Darum gehoert das Aufwecken HIERHER, nicht in
# die Crontab. (Die Crontab macht nur: 07:00 Reboot, 18:00/Wochenende Standby.)
cec-ctl -d /dev/cec0 --playback 2>/dev/null || true
# image-view-on mehrfach senden: ein TV aus tiefem Standby ueberhoert den ersten
# Befehl gern -> sonst bleibt der Schirm morgens schwarz (genau dieser Bug).
for _ in 1 2 3 4; do
  cec-ctl -d /dev/cec0 --to 0 --image-view-on 2>/dev/null || true
  sleep 2
done
# Eingang auf den Pi umschalten (phys. Adresse des genutzten HDMI-Ports).
cec-ctl -d /dev/cec0 --active-source phys-addr=2.0.0.0 2>/dev/null || true

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

# Warten, bis der Server WIRKLICH antwortet (nicht nur 'sleep 3'). Nach einem
# Kaltstart braucht serve.py manchmal laenger -> sonst laedt Chromium, bevor
# /motion erreichbar ist, und das Sensor-Polling startet ins Leere.
for i in $(seq 1 30); do
  if curl -s -o /dev/null "http://localhost:8000/motion"; then break; fi
  sleep 1
done

# 2) Chromium-Kiosk
#    --password-store=basic: nutzt NICHT den GNOME-Keyring -> keine Passwort-Abfrage.
#    --ozone-platform=wayland: native Wayland-Ausgabe unter labwc.
#    --disable-session-crashed-bubble: kein "Wiederherstellen?"-Dialog nach hartem Kill.
#    Die --disable-*backgrounding/throttling-Flags verhindern, dass Chromium Timer +
#    requestAnimationFrame drosselt, sobald es das Fenster fuer verdeckt haelt
#    (sonst frieren Sensor-Polling und Video-Uebergaenge ein).
#    WICHTIG: Es darf nur EINE Stelle Chromium starten. Die Datei
#    ~/.config/labwc/autostart darf KEINE eigene chromium-Zeile (v. a. mit file://)
#    mehr enthalten, sonst kollidieren zwei Instanzen und die Seite laeuft ueber
#    file:// -> /motion (Sensor) ist dann nicht erreichbar.
"$CHROME" --kiosk --noerrdialogs --disable-infobars \
  --ozone-platform=wayland \
  --disable-restore-session-state \
  --disable-session-crashed-bubble \
  --password-store=basic \
  --autoplay-policy=no-user-gesture-required \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-features=CalculateNativeWinOcclusion \
  http://localhost:8000/ >/tmp/britney-chromium.log 2>&1 &

wait
