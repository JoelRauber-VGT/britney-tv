"""LLM-Kuratierung: Relevanz, Kategorie, Score und deutsche Kurzfassung."""
import json
import logging
import re

from .config import CATEGORIES

log = logging.getLogger(__name__)

# Eindeutige ae/oe/ue-Umschreibungen, die das Modell selten trotzdem liefert
UMLAUT_FIX = {
    "fuer": "für", "Fuer": "Für", "ueber": "über", "Ueber": "Über", "koenn": "könn",
    "moecht": "möcht", "wuerd": "würd", "muess": "müss", "duerf": "dürf", "waer": "wär",
    "hoeh": "höh", "groess": "gröss", "aender": "änder", "Aender": "Änder",
    "aehnl": "ähnl", "Aehnl": "Ähnl", "praeg": "präg", "Praeg": "Präg",
}
# Endung -itaet ist immer -ität (Kapazität, Flexibilität, Qualität …)
_ITAET_RE = re.compile(r"itaet")
_UMLAUT_RE = re.compile(r"\b(" + "|".join(UMLAUT_FIX) + r")")


def trim_summary(t: str, limit: int = 280) -> str:
    """Zu lange Summaries an der letzten Satzgrenze innerhalb des Limits kürzen."""
    if len(t) <= limit:
        return t
    cut = max(t.rfind(". ", 0, limit), t.rfind("! ", 0, limit), t.rfind("? ", 0, limit))
    return t[: cut + 1] if cut > 80 else t[: limit - 1].rstrip() + "…"


def fix_text(t: str) -> str:
    t = t.replace("ß", "ss").strip()
    t = _ITAET_RE.sub("ität", t)
    return _UMLAUT_RE.sub(lambda m: UMLAUT_FIX[m.group(1)], t)

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["relevant", "category", "score", "title_de", "summary_de", "image_prompt"],
    "properties": {
        "relevant": {"type": "boolean"},
        "category": {"type": "string", "enum": list(CATEGORIES)},
        "score": {"type": "integer", "minimum": 0, "maximum": 100},
        "title_de": {"type": "string"},
        "summary_de": {"type": "string"},
        "image_prompt": {"type": "string"},
    },
}

SYSTEM = """Du kuratierst News für einen Lobby-Bildschirm eines Schweizer Energiehandelsunternehmens (VGT).
Die Leute lesen die Karten im Vorbeigehen. Viele sind KEINE KI- oder Energie-Fachleute.
Beurteile den Artikel und liefere:

- relevant: true nur für echte, substanzielle News zu KI oder Energie.
  false für alles andere (z. B. allgemeine Inland-/Wirtschaftsnews ohne KI- oder Energiebezug),
  Werbung, Sponsored Content, Webinare, Paywall-Teaser, Stellenanzeigen, reine Personalien.
- category: "KI weltweit" (KI allgemein), "Energie" (Strom, Gas, Erneuerbare, Netze, Energiepolitik)
  oder "KI × Energie" (KI angewendet auf Energie, Rechenzentren & Strombedarf, Netzsteuerung, Handel mit KI).
- score 0–100, nach diesen Regeln:
  ENERGIE: Fokus DACH-Raum, vor allem Schweiz. Hoch: Schweizer und europäische Strom-/Gasmärkte,
    Strompreise, Versorgungssicherheit, Energiepolitik CH/DE/AT/EU, grosse Speicher-/Netzprojekte im DACH-Raum,
    alles was den Energiehandel betrifft. Ausserhalb DACH nur hoch, wenn es weltweit Gewicht hat oder den
    europäischen Markt spürbar beeinflusst (z. B. grosse Gas-/Ölpreis-Bewegungen, Atom-Deals der Tech-Konzerne).
    US-Lokalthemen (einzelne US-Versorger, Tarifverfahren, Bundesstaaten-Regulierung, PJM-/ERCOT-Details): unter 35.
  KI: Für ein breites Publikum spannend und verständlich. Hoch: Dinge, die man aus dem Alltag kennt
    (ChatGPT, Claude, Gemini, Siri usw.), Auswirkungen auf Arbeit, Schule, Gesellschaft, Recht und Sicherheit,
    verblüffende Anwendungen, grosse Entscheide der bekannten Firmen. Tief (unter 40): Benchmark-Vergleiche,
    Nischenmodelle und Fachtools, Finanzierungsrunden, Forschungsdetails, die man ohne Vorwissen nicht versteht.
  KI × ENERGIE: hoch, wenn es den Strombedarf, Energiemärkte oder Energiefirmen konkret betrifft.
- title_de: kurze, packende deutsche Headline, maximal 70 Zeichen, keine Clickbait-Fragen.
  Für Laien verständlich: bekannte Namen statt Modellnummern, keine Abkürzungen ohne Erklärung.
- summary_de: 2–3 Sätze auf Deutsch, insgesamt maximal 260 Zeichen. Komplett eigene Formulierung,
  keine wörtlichen Zitate, keine übernommenen Sätze. Einfach und konkret: Was ist passiert, und warum
  ist das interessant? Fachbegriffe vermeiden oder kurz erklären.
  Umlaute ä, ö, ü ganz normal schreiben (nie ae/oe/ue); einzig ß wird als ss geschrieben (Schweiz).
- image_prompt: englische Bildidee für ein abstraktes, futuristisches Illustrationsbild zum Inhalt.
  Symbolisch statt wörtlich, beschreibe nur Motiv und Komposition, KEINE Farben (der Stil wird ergänzt).
  Keine Personen, keine Gesichter, keine Logos, keine Schrift, keine Markennamen."""


class Curator:
    def __init__(self, client, model: str, reasoning: str | None):
        self.client = client
        self.model = model
        self.reasoning = reasoning
        self.calls = 0
        self.tokens_in = 0
        self.tokens_out = 0

    def curate(self, art: dict) -> dict | None:
        user = (
            f"Quelle: {art['source']} (Feed-Typ: {art['kind']})\n"
            f"Titel: {art['title']}\n"
            f"Teaser: {art['teaser'] or '(kein Teaser)'}"
        )
        kwargs = {}
        if self.reasoning:
            kwargs["reasoning_effort"] = self.reasoning
        try:
            res = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": "news_card", "strict": True, "schema": SCHEMA},
                },
                **kwargs,
            )
        except Exception as e:
            log.warning("LLM-Fehler bei %s: %s", art["id"], e)
            return None
        self.calls += 1
        if res.usage:
            self.tokens_in += res.usage.prompt_tokens
            self.tokens_out += res.usage.completion_tokens
        try:
            data = json.loads(res.choices[0].message.content)
        except (TypeError, json.JSONDecodeError):
            log.warning("LLM-Antwort unlesbar bei %s", art["id"])
            return None
        data["score"] = max(0, min(100, int(data["score"])))
        for k in ("title_de", "summary_de"):
            data[k] = fix_text(data[k])
        data["summary_de"] = trim_summary(data["summary_de"])
        return data


def dummy_curation(art: dict) -> dict:
    """Für --dry-run: plausibles Ergebnis ohne API-Call und ohne Artikeltext."""
    cat = "KI weltweit" if art["kind"] == "ai" else "Energie"
    title = art["title"]
    if len(title) > 70:
        title = title[:69].rstrip() + "…"
    return {
        "relevant": True,
        "category": cat,
        "score": 50 + int(art["id"][:2], 16) % 45,
        "title_de": title or "Dry-Run-Meldung",
        "summary_de": (
            "Dies ist eine Platzhalter-Zusammenfassung aus dem Dry-Run. Im echten Lauf "
            "formuliert das Sprachmodell hier zwei bis drei eigene Sätze zum Artikel."
        ),
        "image_prompt": "abstract glowing network of light",
    }
