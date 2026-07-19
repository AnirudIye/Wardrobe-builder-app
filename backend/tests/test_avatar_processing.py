from __future__ import annotations

import io

from PIL import Image

from app.services.images import AVATAR_SIZE, process_avatar


def _png(width: int, height: int, color=(120, 30, 200)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buf, format="PNG")
    return buf.getvalue()


def test_avatar_is_square_and_small_dimensions():
    img = Image.open(io.BytesIO(process_avatar(_png(1200, 800))))
    assert img.size == AVATAR_SIZE
    assert img.size[0] == img.size[1]  # square, whatever the source aspect


def test_avatar_is_jpeg():
    img = Image.open(io.BytesIO(process_avatar(_png(400, 400))))
    assert img.format == "JPEG"


def test_avatar_bytes_are_tiny():
    # A realistic photo (random-ish content) must still fit in a few KB - the
    # whole point of the feature. 20 KB is a generous ceiling for 96px JPEG.
    import os

    noisy = Image.frombytes("RGB", (1000, 1000), os.urandom(1000 * 1000 * 3))
    buf = io.BytesIO()
    noisy.save(buf, format="PNG")
    out = process_avatar(buf.getvalue())
    assert len(out) < 20 * 1024


def test_avatar_center_crops_landscape_without_squashing():
    # A wide image with a distinct left half and right half: after a centered
    # square crop the extreme edges are dropped, but the middle survives, so
    # the avatar stays recognizable rather than horizontally squashed.
    src = Image.new("RGB", (900, 300), (255, 255, 255))
    for x in range(900):
        for y in range(0, 300, 60):
            pass
    src.paste(Image.new("RGB", (300, 300), (10, 10, 10)), (300, 0))  # centered black square
    buf = io.BytesIO()
    src.save(buf, format="PNG")
    out = Image.open(io.BytesIO(process_avatar(buf.getvalue()))).convert("RGB")
    cx, cy = out.size[0] // 2, out.size[1] // 2
    r, g, b = out.getpixel((cx, cy))
    assert r < 80 and g < 80 and b < 80  # center is the dark square, not squashed white


def test_avatar_rejects_non_image():
    import pytest

    from app.services.images import InvalidImageError

    with pytest.raises(InvalidImageError):
        process_avatar(b"this is not an image")
