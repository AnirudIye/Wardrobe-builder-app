from __future__ import annotations

import io
import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx
from PIL import Image, UnidentifiedImageError

# Cap the stored image so we don't keep multi-MB originals or send huge
# payloads to the vision model. Thumbnails feed the wardrobe grid.
MAX_IMAGE_SIZE = (1280, 1280)
THUMBNAIL_SIZE = (400, 400)
JPEG_QUALITY = 85

# Default cap on bytes downloaded from a remote image URL.
MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024

# Redirects are followed manually so every hop gets re-validated (a public URL
# redirecting to 169.254.169.254 is the classic SSRF escalation).
MAX_REDIRECTS = 3


class InvalidImageError(ValueError):
    """Raised when uploaded bytes are not a decodable image."""


class ImageDownloadError(RuntimeError):
    """Raised when a remote image URL can't be downloaded."""


def _assert_public_http_url(url: str) -> None:
    """SSRF guard: only http(s) URLs whose host resolves to public addresses.

    Rejects anything resolving to loopback, RFC1918, link-local (incl. the
    169.254.169.254 cloud metadata endpoint), CGNAT, or ULA ranges - one
    `is_global` check covers them all. Every address returned by DNS is
    checked, so a host with one public and one private record is rejected.
    Residual risk (accepted): a DNS-rebind between this check and httpx's own
    resolution; pinning connections breaks TLS/SNI handling and isn't worth it
    for fetching product images.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ImageDownloadError("Invalid image URL")
    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError as exc:
        raise ImageDownloadError("Invalid image URL") from exc
    try:
        infos = socket.getaddrinfo(parsed.hostname, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise ImageDownloadError("Could not resolve image host") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise ImageDownloadError("URL points to a private or internal address")


def download_image_bytes(url: str, max_bytes: int = MAX_DOWNLOAD_BYTES) -> bytes:
    """Download bytes from a PUBLIC http(s) URL, capped at `max_bytes`.

    Redirects are followed manually (max MAX_REDIRECTS), re-validating each
    hop against the SSRF guard. Raises ImageDownloadError on a bad/private
    URL, network failure, or oversize response. Does not validate the bytes
    are a real image - pass the result to `process_upload` for that.
    """
    for _ in range(MAX_REDIRECTS + 1):
        _assert_public_http_url(url)
        try:
            with httpx.stream("GET", url, timeout=20.0, follow_redirects=False) as resp:
                if resp.is_redirect:
                    location = resp.headers.get("location", "")
                    if not location:
                        raise ImageDownloadError("Invalid redirect")
                    url = urljoin(url, location)
                    continue
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
    raise ImageDownloadError("Too many redirects")


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
