"""Helpers for track ingest: hashing, duration probing, S3 streaming URL."""
from __future__ import annotations

import io
import logging
from typing import Optional

import boto3
from botocore.client import Config
from django.conf import settings

logger = logging.getLogger(__name__)


def probe_mp3_duration(django_file) -> int:
    """Return duration in seconds, or 0 if unreadable."""
    try:
        from mutagen.mp3 import MP3
    except Exception:
        return 0
    try:
        if hasattr(django_file, "seek"):
            django_file.seek(0)
        buf = io.BytesIO(django_file.read())
        if hasattr(django_file, "seek"):
            django_file.seek(0)
        m = MP3(buf)
        return int(round(m.info.length or 0))
    except Exception as exc:
        logger.warning("mp3 probe failed: %s", exc)
        return 0


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.MINIO_PUBLIC_ENDPOINT,
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        region_name=settings.MINIO_REGION,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def presigned_url(key: str, expires: int = 60 * 60) -> Optional[str]:
    """Build a presigned URL pointing at the public MinIO endpoint."""
    if not key:
        return None
    cli = _s3_client()
    return cli.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.MINIO_BUCKET, "Key": key},
        ExpiresIn=expires,
    )
