#!/usr/bin/env bash
# Einmalige Einrichtung der News auf dem Pi.
#   ./setup-news.sh
# Macht alles: Python-Umgebung, OpenAI-Key, erster News-Lauf, Cron alle 3 h.
# Kann gefahrlos mehrfach ausgeführt werden.
set -e
cd "$(dirname "$0")"
REPO="$(pwd)"

echo "== 1/4 Python-Umgebung einrichten (dauert beim ersten Mal ein paar Minuten)"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r news_pipeline/requirements.txt

echo "== 2/4 OpenAI-Key"
if grep -q '^OPENAI_API_KEY=sk-' news_pipeline/.env 2>/dev/null \
   && ! grep -q '^OPENAI_API_KEY=sk-\.\.\.' news_pipeline/.env; then
  echo "   Key ist schon hinterlegt."
else
  read -r -s -p "   OpenAI-Key einfügen (beginnt mit sk-, wird nicht angezeigt) und Enter: " KEY; echo
  [ -n "$KEY" ] || { echo "   Kein Key eingegeben, Abbruch."; exit 1; }
  sed "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$KEY|" news_pipeline/.env.example > news_pipeline/.env
  chmod 600 news_pipeline/.env
  echo "   Key gespeichert."
fi

echo "== 3/4 Erster News-Lauf (ca. 3–5 Minuten)"
.venv/bin/python -m news_pipeline run

echo "== 4/4 Automatisch alle 3 Stunden (Cron)"
LINE="0 */3 * * * cd $REPO && .venv/bin/python -m news_pipeline run >> /tmp/britney-news.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'news_pipeline run' ; echo "$LINE" ) | crontab -
echo "   Eingetragen: $LINE"

echo
echo "Fertig. Die News erscheinen spätestens nach dem nächsten Neustart (täglich 07:00)."
echo "Sofort sehen: sudo reboot"
