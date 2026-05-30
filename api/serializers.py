"""Hand-rolled dict serializers — DRF is not installed."""
from django.urls import reverse

from music.models import Playlist, Track
from music.services import presigned_url


def serialize_track(track: Track, request=None) -> dict:
    stream_path = reverse("api:track-stream", args=[track.pk])
    if request is not None:
        stream = request.build_absolute_uri(stream_path)
    else:
        stream = stream_path
    cover_url = ""
    if track.cover:
        # Build the cover URL through the PUBLIC MinIO endpoint, same as the
        # audio stream. track.cover.url would use the internal docker endpoint
        # (http://minio:9000) which the browser cannot reach.
        try:
            cover_url = presigned_url(track.cover.name) or ""
        except Exception:
            cover_url = ""
    return {
        "id": f"t{track.pk}",
        "pk": track.pk,
        "title": track.title,
        "artist": track.artist,
        "genre": track.genre,
        "duration": track.duration,
        "color": track.color,
        "src": stream,
        "cover": cover_url,
        "uploaded_at": track.uploaded_at.isoformat(),
    }


def serialize_playlist(pl: Playlist) -> dict:
    track_ids = list(
        pl.playlisttrack_set.order_by("position", "added_at").values_list(
            "track_id", flat=True
        )
    )
    return {
        "id": f"p{pl.pk}",
        "pk": pl.pk,
        "name": pl.name,
        "pin": pl.pin,
        "cover": pl.cover,
        "tracks": [f"t{tid}" for tid in track_ids],
        "track_ids": track_ids,
    }
