"""Shrink each tool's promo image into a card thumbnail (thumbs/<name>.webp).

Run with any Python that has Pillow, e.g. the venv of kokofolia-apng:
    ..\\kokofolia-apng\\.venv\\Scripts\\python.exe _dev\\make-thumbs.py
"""
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parent.parent
WORK = SITE.parent
OUT = SITE / "thumbs"
SIZE = (640, 336)  # 2x the card width on a desktop, same ratio as OGP (1200x630)

# thumbnail name -> source image. Sources with another ratio are centre-cropped.
SOURCES: dict[str, Path] = {
    "scene-transition-maker": WORK / "kokofolia-apng" / "docs" / "ogp.png",
    "foreground-frame-maker": WORK / "kokofolia-frame" / "ogp.png",
    "status-bar-maker": WORK / "kokofolia-statusbar" / "ogp.png",
    "chat-window-maker": WORK / "kokofolia-chatwindow" / "ogp.png",
    "message-box-maker": WORK / "kokofolia-messagebox" / "ogp.png",
    "zaishitsutou": Path.home() / "kono-yami-obs-discord" / "store-images" / "02-howitworks.png",
}


def crop_to_ratio(im: Image.Image, ratio: float) -> Image.Image:
    w, h = im.size
    if w / h > ratio:
        new_w = round(h * ratio)
        left = (w - new_w) // 2
        return im.crop((left, 0, left + new_w, h))
    new_h = round(w / ratio)
    top = (h - new_h) // 2
    return im.crop((0, top, w, top + new_h))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, src in SOURCES.items():
        with Image.open(src) as im:
            source_size = im.size
            cropped = crop_to_ratio(im.convert("RGB"), SIZE[0] / SIZE[1])
        thumb = cropped.resize(SIZE, Image.Resampling.LANCZOS)
        dst = OUT / f"{name}.webp"
        thumb.save(dst, "WEBP", quality=82, method=6)
        print(f"{name}: {source_size} -> {SIZE}, {dst.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
