from __future__ import annotations

from app.storage.base import StorageBackend


class S3Storage(StorageBackend):
    """S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, ...).

    Objects are served via a public base URL (R2's pub-xxxx.r2.dev / a CDN
    domain / an S3 bucket policy) — media here is public-by-design with
    unguessable uuid4 keys, same as the /media mount. If the bucket ever needs
    to be private, swap `url()` for presigned URLs — but note the frontend
    caches URL strings across the session, so presigned links would expire in
    users' hands.
    """

    def __init__(
        self,
        *,
        bucket: str,
        public_base_url: str,
        endpoint_url: str = "",
        region: str = "auto",
        access_key_id: str = "",
        secret_access_key: str = "",
    ) -> None:
        # Local import: boto3 loads only when the s3 backend is selected.
        import boto3

        self.bucket = bucket
        self.public_base_url = public_base_url.rstrip("/")
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url or None,
            region_name=region or None,
            aws_access_key_id=access_key_id or None,
            aws_secret_access_key=secret_access_key or None,
        )

    def save(self, data: bytes, key: str) -> str:
        # Keys are server-generated "{uuid4hex}.jpg" (see wardrobe/profile
        # routers), so a fixed JPEG content type is correct.
        self._client.put_object(
            Bucket=self.bucket, Key=key, Body=data, ContentType="image/jpeg"
        )
        return key

    def url(self, key: str) -> str:
        return f"{self.public_base_url}/{key}"

    def read(self, key: str) -> bytes:
        try:
            return self._client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except self._client.exceptions.NoSuchKey as exc:
            raise FileNotFoundError(key) from exc

    def delete(self, key: str) -> None:
        # S3 DeleteObject is idempotent — missing keys are silently fine,
        # matching the ABC contract.
        self._client.delete_object(Bucket=self.bucket, Key=key)
