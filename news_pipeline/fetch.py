"""Feeds abrufen und in einheitliche Artikel-Dicts umwandeln."""
import hashlib
import html
import logging
import re
import time
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import feedparser
import httpx

log = logging.getLogger(__name__)

UA = "Mozilla/5.0 (compatible; BritneyNewsKiosk/1.0)"
TRACKING = re.compile(r"^(utm_|fbclid|gclid|mc_|ref$|cmp$)")


SPONSORED = re.compile(r"/(spons|sponsored|advertorial|anzeige)/", re.I)


def normalize_url(url: str) -> str:
    """Tracking-Parameter und Fragment entfernen → stabile ID, kürzerer QR-Code."""
    p = urlsplit(url.strip())
    query = urlencode([(k, v) for k, v in parse_qsl(p.query) if not TRACKING.match(k)])
    return urlunsplit((p.scheme, p.netloc.lower(), p.path, query, ""))


def url_id(url: str) -> str:
    return hashlib.sha1(url.encode()).hexdigest()[:12]


def _clean(text: str, limit: int = 1500) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"\s+", " ", html.unescape(text)).strip()
    return text[:limit]


def _published(entry) -> datetime | None:
    for key in ("published_parsed", "updated_parsed"):
        t = entry.get(key)
        if t:
            return datetime(*t[:6], tzinfo=timezone.utc)
    return None


def _get(client: httpx.Client, url: str, tries: int = 3) -> bytes:
    for i in range(tries):
        try:
            r = client.get(url)
            if r.status_code < 500:
                r.raise_for_status()
                return r.content
            raise httpx.HTTPStatusError(f"{r.status_code}", request=r.request, response=r)
        except (httpx.TransportError, httpx.HTTPStatusError) as e:
            # 4xx nicht wiederholen
            if isinstance(e, httpx.HTTPStatusError) and e.response.status_code < 500:
                raise
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))
    raise RuntimeError("unreachable")


def fetch_all(sources: list[dict]) -> list[dict]:
    """Alle Feeds holen. Ein kaputter Feed wird geloggt und übersprungen."""
    articles: dict[str, dict] = {}
    with httpx.Client(timeout=15, follow_redirects=True, headers={"User-Agent": UA}) as client:
        for src in sources:
            try:
                feed = feedparser.parse(_get(client, src["url"]))
            except Exception as e:
                log.warning("Feed fehlgeschlagen: %s (%s)", src["name"], e)
                continue
            n = 0
            for e in feed.entries:
                link = e.get("link")
                if not link:
                    continue
                url = normalize_url(link)
                if SPONSORED.search(url):  # bezahlte Inhalte (z. B. Utility Dive /spons/)
                    continue
                aid = url_id(url)
                if aid in articles:
                    continue
                pub = _published(e)
                articles[aid] = {
                    "id": aid,
                    "url": url,
                    "source": src["name"],
                    "kind": src.get("kind", "ai"),
                    "weight": float(src.get("weight", 1.0)),
                    "title": _clean(e.get("title", ""), 300),
                    "teaser": _clean(e.get("summary", "") or e.get("description", "")),
                    "published_at": pub.isoformat() if pub else None,
                }
                n += 1
            log.info("Feed %-18s %2d Artikel", src["name"], n)
    return list(articles.values())
