"""Einstellungen aus .env + sources.yaml."""
import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from dotenv import load_dotenv

PKG_DIR = Path(__file__).resolve().parent
REPO_DIR = PKG_DIR.parent

CATEGORIES = ("KI weltweit", "KI × Energie", "Energie")
# Dateiname der Fallback-Bilder pro Kategorie (liegen in assets/)
CATEGORY_SLUG = {"KI weltweit": "ki", "KI × Energie": "ki-energie", "Energie": "energie"}

# Einheitlicher Bildstil für alle generierten Bilder
IMAGE_STYLE = (
    "Style: near-black background. Color palette strictly violet, magenta, rose pink "
    "and warm coral glow accents; avoid blue, cyan and teal. Cinematic lighting, "
    "abstract futuristic, minimal, "
    "high detail, wide composition with the subject in the upper two thirds. "
    "Absolutely no text, no letters, no numbers, no logos, no real people, no faces."
)
# Querformat, das Widget schneidet per object-fit: cover auf ~1.9:1 zu
IMAGE_SIZE = "1536x1024"


@dataclass
class Settings:
    api_key: str | None
    llm_model: str
    llm_reasoning: str | None
    image_model: str
    image_quality: str
    max_new_images: int
    output_dir: Path
    state_file: Path
    sources: list[dict]
    total: int
    max_age_hours: int
    min_score: int
    mix: dict[str, float] = field(default_factory=dict)


def load_settings() -> Settings:
    load_dotenv(PKG_DIR / ".env")
    load_dotenv(REPO_DIR / ".env")  # optional zweiter Ort

    cfg = yaml.safe_load((PKG_DIR / "sources.yaml").read_text(encoding="utf-8"))
    sel = cfg.get("selection", {})

    out = Path(os.getenv("OUTPUT_DIR", "data"))
    if not out.is_absolute():
        out = REPO_DIR / out

    return Settings(
        api_key=os.getenv("OPENAI_API_KEY") or None,
        llm_model=os.getenv("LLM_MODEL", "gpt-5.4-mini"),
        llm_reasoning=os.getenv("LLM_REASONING_EFFORT", "low") or None,
        image_model=os.getenv("IMAGE_MODEL", "gpt-image-1-mini"),
        image_quality=os.getenv("IMAGE_QUALITY", "medium"),
        max_new_images=int(os.getenv("MAX_NEW_IMAGES_PER_RUN", "8")),
        output_dir=out,
        state_file=PKG_DIR / "state" / "seen.json",
        sources=[s for s in cfg.get("sources", []) if s and s.get("url")],
        total=int(sel.get("total", 14)),
        max_age_hours=int(sel.get("max_age_hours", 72)),
        min_score=int(sel.get("min_score", 40)),
        mix={k: float(v) for k, v in (sel.get("mix") or {}).items()},
    )
