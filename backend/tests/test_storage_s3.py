from __future__ import annotations

from unittest.mock import MagicMock

import pytest

pytest.importorskip("boto3")

from app.storage.s3 import S3Storage  # noqa: E402


class _NoSuchKey(Exception):
    pass


@pytest.fixture()
def storage(monkeypatch):
    client = MagicMock()
    client.exceptions.NoSuchKey = _NoSuchKey
    monkeypatch.setattr("boto3.client", lambda *a, **k: client)
    backend = S3Storage(bucket="test-bucket", public_base_url="https://pub.example.com/")
    return backend, client


def test_save_puts_object_with_content_type(storage):
    backend, client = storage
    key = backend.save(b"jpegbytes", "abc123.jpg")
    assert key == "abc123.jpg"
    client.put_object.assert_called_once_with(
        Bucket="test-bucket", Key="abc123.jpg", Body=b"jpegbytes", ContentType="image/jpeg"
    )


def test_url_composes_public_base(storage):
    backend, _ = storage
    # Trailing slash on the base is normalized away.
    assert backend.url("abc123.jpg") == "https://pub.example.com/abc123.jpg"


def test_read_returns_body_bytes(storage):
    backend, client = storage
    body = MagicMock()
    body.read.return_value = b"data"
    client.get_object.return_value = {"Body": body}
    assert backend.read("abc123.jpg") == b"data"
    client.get_object.assert_called_once_with(Bucket="test-bucket", Key="abc123.jpg")


def test_read_missing_key_raises_filenotfound(storage):
    backend, client = storage
    client.get_object.side_effect = _NoSuchKey()
    with pytest.raises(FileNotFoundError):
        backend.read("missing.jpg")


def test_delete_is_idempotent(storage):
    backend, client = storage
    backend.delete("abc123.jpg")  # no raise even if the key never existed
    client.delete_object.assert_called_once_with(Bucket="test-bucket", Key="abc123.jpg")


# --- presign mode: private buckets (e.g. Filebase free plan has no public buckets) ---


def test_presign_mode_generates_signed_urls(monkeypatch):
    client = MagicMock()
    client.generate_presigned_url.return_value = "https://signed.example.com/abc123.jpg?X-Amz-Signature=zz"
    monkeypatch.setattr("boto3.client", lambda *a, **k: client)
    backend = S3Storage(bucket="test-bucket", public_base_url="", presign=True)
    url = backend.url("abc123.jpg")
    assert url == "https://signed.example.com/abc123.jpg?X-Amz-Signature=zz"
    client.generate_presigned_url.assert_called_once_with(
        "get_object",
        Params={"Bucket": "test-bucket", "Key": "abc123.jpg"},
        ExpiresIn=604800,
    )


def test_presign_produces_a_real_signature_offline():
    # Presigning is pure local crypto - a real boto3 client with fake creds
    # proves the URL shape end to end without any network.
    backend = S3Storage(
        bucket="test-bucket",
        public_base_url="",
        endpoint_url="https://s3.filebase.io",
        access_key_id="FAKEKEY",
        secret_access_key="FAKESECRET",
        presign=True,
    )
    url = backend.url("abc123.jpg")
    assert "abc123.jpg" in url
    assert "X-Amz-Signature=" in url
    assert url.startswith("https://")


def test_s3_settings_accept_presign_instead_of_public_base():
    from app.config import Settings

    ok = Settings(storage_backend="s3", s3_bucket="b", s3_presign=True, s3_public_base_url="")
    assert ok.s3_presign is True
    with pytest.raises(Exception):
        Settings(storage_backend="s3", s3_bucket="b", s3_presign=False, s3_public_base_url="")
