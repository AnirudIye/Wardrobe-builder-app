from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, UnidentifiedImageError

# Cap the stored image so we don't keep multi-MB originals or send huge
# payloads to the vision model. Thumbnails feed the wardrobe grid.
MAX_IMAGE_SIZE = (1280, 1280)
THUMBNAIL_SIZE = (400, 400)
JPEG_QUALITY = 85


class InvalidImageError(ValueError):
    """Raised when uploaded bytes are not a decodable image."""


@dataclass
class ProcessedImage:
    image_bytes: bytes
    thumbnail_bytes: bytes


def _to_rgb(img: Image.Image) -> Image.Image:
    # Flatten transparency / palette modes onto white for JPEG.
    if img.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        rgba = img.convert("RGBA")
        background.paste(rgba, mask=rgba.split()[-1])
        return background
    return img.convert("RGB")


def _encode_jpeg(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buf.getvalue()


def process_upload(raw: bytes) -> ProcessedImage:
    """Validate, normalize, and thumbnail an uploaded image.

    Returns JPEG-encoded full and thumbnail bytes. Raises InvalidImageError
    if the bytes are not a valid image.
    """
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise InvalidImageError("Uploaded file is not a valid image") from exc

    img = _to_rgb(img)

    full = img.copy()
    full.thumbnail(MAX_IMAGE_SIZE, Image.LANCZOS)

    thumb = img.copy()
    thumb.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)

    return ProcessedImage(
        image_bytes=_encode_jpeg(full),
        thumbnail_bytes=_encode_jpeg(thumb),
    )
