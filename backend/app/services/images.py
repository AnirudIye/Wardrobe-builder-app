from __future__ import annotations

import io
from dataclasses import dataclass

import httpx
from PIL import Image, UnidentifiedImageError

# Cap the stored image so we don't keep multi-MB originals or send huge
# payloads to the vision model. Thumbnails feed the wardrobe grid.
MAX_IMAGE_SIZE = (1280, 1280)
THUMBNAIL_SIZE = (400, 400)
JPEG_QUALITY = 85

# Default cap on bytes downloaded from a remote image URL.
MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024


class InvalidImageError(ValueError):
    """Raised when uploaded bytes are not a decodable image."""


class ImageDownloadError(RuntimeError):
    """Raised when a remote image URL can't be downloaded."""


def download_image_bytes(url: str, max_bytes: int = MAX_DOWNLOAD_BYTES) -> bytes:
    """Download bytes from an http(s) URL, capped at `max_bytes`.

    Raises ImageDownloadError on a bad scheme, network failure, or oversize
    response. Does not validate the bytes are a real image — pass the result
    to `process_upload` for that.
    """
    if not url.lower().startswith(("http://", "https://")):
        raise ImageDownloadError("Invalid image URL")
    try:
        with httpx.stream("GET", url, timeout=20.0, follow_redirects=True) as resp:
            resp.raise_for_status()
            raw = b""
            for chunk in resp.iter_bytes():
                raw += chunk
                if len(raw) > max_bytes:
                    raise ImageDownloadError(
                        f"Image too large (max {max_bytes // (1024 * 1024)} MB)"
                    )
    except httpx.HTTPError as exc:
        raise ImageDownloadError(f"Could not download image: {exc}") from exc
    if not raw:
        raise ImageDownloadError("Empty image")
    return raw


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
