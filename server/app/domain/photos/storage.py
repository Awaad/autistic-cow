"""Object storage for EXIF-STRIPPED photos only. strip() runs before put() —
enforced at the single call site in api/v1/photos.py."""
from __future__ import annotations

import boto3
from botocore.client import Config

from app.core.settings import settings

BUCKET = "photos"


def _client():
    s = settings()
    return boto3.client(
        "s3", endpoint_url=s.s3_endpoint,
        aws_access_key_id=s.s3_access_key, aws_secret_access_key=s.s3_secret_key,
        config=Config(signature_version="s3v4"), region_name="us-east-1",
    )


def ensure_bucket() -> None:
    c = _client()
    try:
        c.head_bucket(Bucket=BUCKET)
    except Exception:  # noqa: BLE001
        c.create_bucket(Bucket=BUCKET)


def put(key: str, data: bytes) -> None:
    _client().put_object(Bucket=BUCKET, Key=key, Body=data, ContentType="image/jpeg")


def presign(key: str, expires_s: int = 3600) -> str:
    return _client().generate_presigned_url(
        "get_object", Params={"Bucket": BUCKET, "Key": key}, ExpiresIn=expires_s,
    )
