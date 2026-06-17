#!/usr/bin/env bash
# Wechselt den aktiven Video-Satz des Britney-Dashboards: real <-> pixar.
#
#   ./switch-videos.sh real     # realistische Videos (vidoes/real/)
#   ./switch-videos.sh pixar    # Pixar-Videos        (vidoes/pixar/)
#   ./switch-videos.sh          # zeigt den aktuellen Satz an
#
# Schreibt nur vidoes/active.txt. serve.py liefert den Wert unter /videoset;
# die Kiosk-Seite pollt das und laedt sich bei Aenderung in ~2 s selbst neu.
# Kein Browser-Neustart, kein xdotool noetig (funktioniert auch unter Wayland).
set -euo pipefail
cd "$(dirname "$0")"

ACTIVE="vidoes/active.txt"
choice="${1:-}"

if [ -z "$choice" ]; then
  current="$( [ -f "$ACTIVE" ] && cat "$ACTIVE" || echo real )"
  echo "Aktiver Video-Satz: $current"
  echo "Umschalten:  $0 real   |   $0 pixar"
  exit 0
fi

case "$choice" in
  real|pixar) ;;
  *) echo "Ungueltig: '$choice'. Erlaubt: real | pixar"; exit 1 ;;
esac

if [ ! -d "vidoes/$choice" ]; then
  echo "Fehler: Ordner vidoes/$choice existiert nicht." >&2
  exit 1
fi

# Warnen, falls der Zielordner (noch) keine Videos enthaelt (egal welche Endung).
if ! ls "vidoes/$choice"/britney_1.* >/dev/null 2>&1; then
  echo "Warnung: vidoes/$choice enthaelt keine britney_1.* – Seite bliebe leer." >&2
fi

echo "$choice" > "$ACTIVE"
echo "Aktiver Video-Satz: $choice  (Kiosk laedt sich in ~2 s selbst neu)"
