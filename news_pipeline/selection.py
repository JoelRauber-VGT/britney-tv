"""Top-Artikel nach Score auswählen, mit Ziel-Mix pro Kategorie."""
from .config import CATEGORIES


def rank(item: dict) -> float:
    return item["score"] * item.get("weight", 1.0)


def select(items: list[dict], total: int, mix: dict[str, float], min_score: int) -> list[dict]:
    pool = sorted(
        (i for i in items if i["relevant"] and i["score"] >= min_score),
        key=rank,
        reverse=True,
    )
    picked: list[dict] = []
    for cat in CATEGORIES:
        quota = round(total * mix.get(cat, 0))
        picked += [i for i in pool if i["category"] == cat][:quota]

    # Kategorien mit zu wenig Material: mit den besten restlichen auffüllen
    ids = {i["id"] for i in picked}
    for i in pool:
        if len(picked) >= total:
            break
        if i["id"] not in ids:
            picked.append(i)
            ids.add(i["id"])

    return _spread(sorted(picked[:total], key=rank, reverse=True))


def _spread(items: list[dict]) -> list[dict]:
    """Reihenfolge nach Score, aber möglichst nie zweimal dieselbe Kategorie hintereinander."""
    out, rest = [], list(items)
    while rest:
        prev = out[-1]["category"] if out else None
        nxt = next((i for i in rest if i["category"] != prev), rest[0])
        rest.remove(nxt)
        out.append(nxt)
    return out
