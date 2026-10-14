"""CLI:  python -m news_pipeline run [--dry-run] [--no-images] [--max-images N]"""
import argparse
import json
import logging
import sys
import time
from datetime import datetime, timedelta, timezone

from .config import load_settings
from .curate import Curator, dummy_curation
from .fetch import fetch_all
from .media import ImageMaker, fallback_image, make_qr, write_atomic
from .selection import select

log = logging.getLogger("news_pipeline")

STATE_KEEP_DAYS = 14
FILE_KEEP_DAYS = 7


def load_state(path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"articles": {}}
    except json.JSONDecodeError:
        log.warning("state/seen.json kaputt → starte mit leerem State")
        return {"articles": {}}


def parse_dt(s: str) -> datetime:
    return datetime.fromisoformat(s)


def cleanup(out_dir, keep: set[str]) -> int:
    """Bilder/QR älter als 7 Tage löschen, sofern nicht mehr in news.json verwendet."""
    cutoff = time.time() - FILE_KEEP_DAYS * 86400
    removed = 0
    for sub in ("news-img", "news-qr"):
        for f in (out_dir / sub).iterdir():
            rel = f"{sub}/{f.name}"
            if f.name.startswith("fallback-") or rel in keep:
                continue
            if f.stat().st_mtime < cutoff or f.suffix == ".tmp":
                f.unlink(missing_ok=True)
                removed += 1
    return removed


def run(args) -> int:
    s = load_settings()
    dry = args.dry_run
    if not dry and not s.api_key:
        log.error("OPENAI_API_KEY fehlt (news_pipeline/.env). Für einen Test ohne API: --dry-run")
        return 2

    client = None
    if not dry:
        from openai import OpenAI
        client = OpenAI(api_key=s.api_key, timeout=120, max_retries=2)

    now = datetime.now(timezone.utc)
    max_age = timedelta(hours=s.max_age_hours)
    state = load_state(s.state_file)
    seen: dict = state["articles"]

    # 1) Feeds holen, nur neue Artikel weiterverarbeiten
    fetched = fetch_all(s.sources)
    curator = Curator(client, s.llm_model, s.llm_reasoning) if client else None
    new = skipped_old = 0
    for art in fetched:
        if art["id"] in seen:
            continue
        art["first_seen"] = now.isoformat()
        pub = parse_dt(art["published_at"] or art["first_seen"])
        if now - pub > max_age:
            art["curated"] = None  # zu alt: merken, aber kein LLM-Call
            seen[art["id"]] = art
            skipped_old += 1
            continue
        result = dummy_curation(art) if dry else curator.curate(art)
        if result is None:
            continue  # beim nächsten Lauf erneut versuchen
        art["curated"] = result
        seen[art["id"]] = art
        new += 1
    log.info("Artikel: %d geholt · %d neu kuratiert · %d zu alt", len(fetched), new, skipped_old)

    # 2) Kandidaten der letzten 72 h → Auswahl
    candidates = []
    for a in seen.values():
        c = a.get("curated")
        if not c:
            continue
        pub = parse_dt(a["published_at"] or a["first_seen"])
        if now - pub <= max_age:
            candidates.append({**a, **c, "pub": pub})
    picked = select(candidates, s.total, s.mix, s.min_score)
    mix = {}
    for p in picked:
        mix[p["category"]] = mix.get(p["category"], 0) + 1
    log.info("Auswahl: %d Karten %s", len(picked), mix)

    # 3) Bilder + QR-Codes (nur was noch fehlt)
    out = s.output_dir
    (out / "news-img").mkdir(parents=True, exist_ok=True)
    (out / "news-qr").mkdir(parents=True, exist_ok=True)
    budget = 0 if (dry or args.no_images) else (
        args.max_images if args.max_images is not None else s.max_new_images)
    images = ImageMaker(client, s.image_model, s.image_quality) if client else None

    items = []
    for p in picked:
        img_rel = f"news-img/{p['id']}.webp"
        img_path = out / img_rel
        if not img_path.exists() and images and images.generated < budget:
            images.generate(p["image_prompt"], img_path)
        if not img_path.exists():
            img_rel = fallback_image(out, p["category"])

        qr_rel = f"news-qr/{p['id']}.svg"
        if not (out / qr_rel).exists():
            make_qr(p["url"], out / qr_rel)

        items.append({
            "id": p["id"],
            "category": p["category"],
            "title": p["title_de"],
            "summary": p["summary_de"],
            "source": p["source"],
            "url": p["url"],
            "published_at": p["pub"].isoformat(),
            "image": img_rel,
            "qr": qr_rel,
            "score": p["score"],
        })

    # 4) news.json atomar schreiben
    doc = {"generated_at": now.isoformat(timespec="seconds"), "items": items}
    write_atomic(out / "news.json", json.dumps(doc, ensure_ascii=False, indent=1).encode())
    removed = cleanup(out, {i["image"] for i in items} | {i["qr"] for i in items})

    # 5) State speichern (nicht im Dry-Run, damit der echte Lauf alles neu kuratiert)
    if not dry:
        keep_after = now - timedelta(days=STATE_KEEP_DAYS)
        state["articles"] = {k: v for k, v in seen.items() if parse_dt(v["first_seen"]) > keep_after}
        s.state_file.parent.mkdir(parents=True, exist_ok=True)
        write_atomic(s.state_file, json.dumps(state, ensure_ascii=False).encode())

    # Kosten-relevante Zähler
    log.info(
        "Fertig%s: LLM-Calls=%d (Tokens in/out %d/%d, Modell %s) · Bilder neu=%d fehlgeschlagen=%d (Modell %s) · "
        "aufgeräumt=%d · → %s",
        " (DRY-RUN)" if dry else "",
        curator.calls if curator else 0,
        curator.tokens_in if curator else 0,
        curator.tokens_out if curator else 0,
        s.llm_model,
        images.generated if images else 0,
        images.failed if images else 0,
        s.image_model,
        removed,
        out / "news.json",
    )
    return 0


def main() -> int:
    logging.basicConfig(
        level=logging.INFO, stream=sys.stdout,
        format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%Y-%m-%d %H:%M:%S",
    )
    for name in ("httpx", "httpx2"):  # keine Log-Zeile pro HTTP-Request
        logging.getLogger(name).setLevel(logging.WARNING)
    ap = argparse.ArgumentParser(prog="news_pipeline")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="Feeds holen, kuratieren, news.json schreiben")
    r.add_argument("--dry-run", action="store_true", help="ohne API-Calls, mit Dummy-Daten")
    r.add_argument("--no-images", action="store_true", help="keine Bilder generieren")
    r.add_argument("--max-images", type=int, default=None, help="überschreibt MAX_NEW_IMAGES_PER_RUN")
    args = ap.parse_args()
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
