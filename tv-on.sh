#!/usr/bin/env bash
# TV einschalten via CEC und danach Display-Modus korrigieren.
# Wird vom Cronjob aufgerufen (laeuft ohne Wayland-Session -> env manuell setzen).

export XDG_RUNTIME_DIR=/run/user/1000
export WAYLAND_DISPLAY=wayland-1

cec-ctl -d /dev/cec0 --playback
cec-ctl -d /dev/cec0 --to 0 --image-view-on

# Warten bis HDMI-Verbindung aufgebaut ist, dann Eingang umschalten
sleep 5
cec-ctl -d /dev/cec0 --active-source phys-addr=2.0.0.0

# kanshi setzt Aufloesung + Rotation automatisch sobald der Output erscheint
