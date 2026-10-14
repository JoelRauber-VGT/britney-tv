# News-Pipeline

Holt KI- und Energie-News aus RSS-Feeds, lässt sie per OpenAI kuratieren und zusammenfassen,
generiert pro Karte ein Bild und einen QR-Code und schreibt `data/news.json` für das
News-Widget im Kiosk. Der Kiosk liest nur die fertigen Dateien.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r news_pipeline/requirements.txt
cp news_pipeline/.env.example news_pipeline/.env   # OPENAI_API_KEY eintragen
```

## Starten (aus dem Repo-Root)

```bash
.venv/bin/python -m news_pipeline run                 # normaler Lauf
.venv/bin/python -m news_pipeline run --dry-run       # ohne API-Calls, Dummy-Texte, State bleibt unberührt
.venv/bin/python -m news_pipeline run --no-images     # Texte ja, keine neuen Bilder
.venv/bin/python -m news_pipeline run --max-images 3  # Bild-Limit für diesen Lauf
```

Am Ende loggt jeder Lauf die kostenrelevanten Zähler: LLM-Calls, Tokens und neu generierte Bilder.

## Ablauf

1. Feeds aus `sources.yaml` holen (Timeout + Retry). Ein kaputter Feed wird übersprungen.
2. Dedupe per URL-Hash. Bereits verarbeitete Artikel stehen in `state/seen.json` und kosten nichts mehr.
3. Nur Artikel der letzten 72 h. Jeder neue Artikel wird **einmal** per LLM bewertet
   (Relevanz, Kategorie, Score, Titel, Summary, Bildidee).
4. Auswahl der Top 14 mit Ziel-Mix (`selection.mix` in `sources.yaml`); fehlt Material, wird aufgefüllt.
5. Bilder nur für ausgewählte Karten ohne Bild, höchstens `MAX_NEW_IMAGES_PER_RUN`. Sonst/bei Fehler
   ein Kategorie-Fallback aus `assets/`. Fehlende Bilder holt der nächste Lauf nach.
6. QR-Code (SVG) pro Artikel, `news.json` atomar schreiben, Bilder/QR älter als 7 Tage aufräumen.

## Konfiguration (`.env`)

| Variable | Default | |
|---|---|---|
| `OPENAI_API_KEY` | – | Pflicht (ausser `--dry-run`) |
| `LLM_MODEL` | `gpt-5.4-mini` | Kuratierung, Structured Output |
| `LLM_REASONING_EFFORT` | `low` | leer lassen für Modelle ohne Reasoning |
| `IMAGE_MODEL` | `gpt-image-1-mini` | |
| `IMAGE_QUALITY` | `medium` | `low` / `medium` / `high` |
| `MAX_NEW_IMAGES_PER_RUN` | `8` | Kostenbremse |
| `OUTPUT_DIR` | `data` | relativ zum Repo oder absolut |

## Cron (alle 3 h)

Auf dem Pi selbst (schreibt direkt nach `data/`, das `serve.py` ausliefert):

```cron
0 */3 * * * cd /home/pi/britney-tv && .venv/bin/python -m news_pipeline run >> /tmp/britney-news.log 2>&1
```

Auf einem separaten Server: `OUTPUT_DIR` auf einen eigenen Ordner setzen und danach auf den Pi
kopieren, z. B.

```cron
0 */3 * * * cd /srv/britney-tv && .venv/bin/python -m news_pipeline run >> /var/log/britney-news.log 2>&1 && rsync -a --delete data/ pi@kiosk:/home/pi/britney-tv/data/
```

## Inhaltliche Regeln

Titel und Summaries formuliert das Modell immer selbst (keine Zitate, keine übernommenen Sätze).
Die Quelle steht auf jeder Karte, der QR-Code führt zum Originalartikel. Es werden keine Verlagsbilder
verwendet, nur generierte Bilder bzw. die Fallbacks.
