from __future__ import annotations

import contextlib

import pytest

from app.services.images import (
    ImageDownloadError,
    _assert_public_http_url,
    download_image_bytes,
)


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/x.jpg",
        "http://127.0.0.1:8000/media/x.jpg",
        "http://localhost:8000/media/x.jpg",
        "http://169.254.169.254/latest/meta-data",  # cloud metadata endpoint
        "http://10.0.0.5/a.jpg",  # RFC1918
        "http://192.168.1.10/a.jpg",  # RFC1918
        "http://[::1]/a.jpg",  # IPv6 loopback
    ],
)
def test_private_and_internal_urls_rejected(url):
    with pytest.raises(ImageDownloadError, match="private or internal|resolve"):
        _assert_public_http_url(url)


@pytest.mark.parametrize("url", ["ftp://example.com/x.jpg", "file:///etc/passwd", "not-a-url"])
def test_non_http_urls_rejected(url):
    with pytest.raises(ImageDownloadError, match="Invalid image URL"):
        _assert_public_http_url(url)


def test_public_ip_literal_accepted():
    # IP literals resolve without touching the network.
    _assert_public_http_url("http://93.184.216.34/a.jpg")  # must not raise


class _RedirectResponse:
    """Stub httpx streaming response that always redirects."""

    def __init__(self, location: str):
        self.is_redirect = True
        self.headers = {"location": location}

    def raise_for_status(self) -> None:  # pragma: no cover - never reached
        pass

    def iter_bytes(self):  # pragma: no cover - never reached
        return iter(())


def _stub_stream(location: str):
    @contextlib.contextmanager
    def fake_stream(method, url, **kwargs):
        yield _RedirectResponse(location)

    return fake_stream


def test_redirect_to_private_address_rejected(monkeypatch):
    # Public first hop 302s to the metadata endpoint - the per-hop
    # revalidation must catch it.
    monkeypatch.setattr(
        "app.services.images.httpx.stream",
        _stub_stream("http://169.254.169.254/latest/meta-data"),
    )
    with pytest.raises(ImageDownloadError, match="private or internal"):
        download_image_bytes("http://93.184.216.34/a.jpg")


def test_endless_public_redirects_capped(monkeypatch):
    monkeypatch.setattr(
        "app.services.images.httpx.stream",
        _stub_stream("http://93.184.216.34/again.jpg"),
    )
    with pytest.raises(ImageDownloadError, match="Too many redirects"):
        download_image_bytes("http://93.184.216.34/a.jpg")
