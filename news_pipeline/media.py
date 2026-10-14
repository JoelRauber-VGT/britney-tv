"""Bilder (OpenAI Image API) und QR-Codes (SVG) erzeugen."""
import base64
import io
import logging
import shutil
from pathlib import Path

import qrcode
from PIL import Image

from .config import CATEGORY_SLUG, IMAGE_SIZE, IMAGE_STYLE, PKG_DIR

log = logging.getLogger(__name__)


def write_atomic(path: Path, data: bytes) -> None:
    """Erst Temp-Datei, dann umbenennen → der Kiosk sieht nie halbe Dateien."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)


def fallback_image(out_dir: Path, category: str) -> str:
    """Kategorie-Fallback aus assets/ in den Output kopieren, relativen Pfad liefern."""
    name = f"fallback-{CATEGORY_SLUG[category]}.svg"
    dst = out_dir / "news-img" / name
    if not dst.exists():
        shutil.copyfile(PKG_DIR / "assets" / name, dst)
    return f"news-img/{name}"


class ImageMaker:
    def __init__(self, client, model: str, quality: str):
        self.client = client
        self.model = model
        self.quality = quality
        self.generated = 0
        self.failed = 0

    def generate(self, prompt: str, dst: Path) -> bool:
        try:
            res = self.client.images.generate(
                model=self.model,
                prompt=f"{prompt}\n\n{IMAGE_STYLE}",
                size=IMAGE_SIZE,
                quality=self.quality,
                output_format="webp",
                output_compression=82,
                n=1,
            )
            raw = base64.b64decode(res.data[0].b64_json)
        except Exception as e:
            self.failed += 1
            log.warning("Bild fehlgeschlagen (%s): %s", dst.name, e)
            return False
        if raw[:4] != b"RIFF":  # Modell lieferte kein WebP → selbst konvertieren
            buf = io.BytesIO()
            Image.open(io.BytesIO(raw)).convert("RGB").save(buf, "WEBP", quality=82)
            raw = buf.getvalue()
        write_atomic(dst, raw)
        self.generated += 1
        return True


def make_qr(url: str, dst: Path) -> None:
    """QR als schlankes SVG: dunkle Module auf hellem Grund (scannt am zuverlässigsten)."""
    # Level L = gröbstes Raster → am Bildschirm aus Distanz am besten lesbar
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_L, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    m = qr.get_matrix()
    n = len(m)
    path = "".join(f"M{x} {y}h1v1h-1z" for y, row in enumerate(m) for x, on in enumerate(row) if on)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges">'
        f'<rect width="{n}" height="{n}" fill="#f1ecf2"/>'
        f'<path d="{path}" fill="#140c18"/></svg>'
    )
    write_atomic(dst, svg.encode())
