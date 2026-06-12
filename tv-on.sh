#!/usr/bin/env bash
# TV einschalten via CEC und danach Display-Modus korrigieren.
# Wird vom Cronjob aufgerufen (laeuft ohne Wayland-Session -> env manuell setzen).

export XDG_RUNTIME_DIR=/run/user/1000
export WAYLAND_DISPLAY=wayland-1

cec-ctl -d /dev/cec0 --playback
cec-ctl -d /dev/cec0 --to 0 --image-view-on

# Auf richtigen HDMI-Eingang umschalten (physische Adresse des Pi)
sleep 2
cec-ctl -d /dev/cec0 --active-source phys-addr=2.0.0.0

# Warten bis der TV und der Compositor die Verbindung neu aufgebaut haben
sleep 8

wlr-randr --output HDMI-A-1 --mode 3840x2160 --refresh 30 --transform normal 2>/dev/null || true
