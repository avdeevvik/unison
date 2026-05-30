import hashlib
import io
import json
import logging

from django.contrib.auth.decorators import login_required
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.http import HttpResponseRedirect, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from music.forms import TrackEditForm, TrackUploadForm
from music.models import Favorite, Playlist, PlaylistTrack, Track
from music.services import presigned_url, probe_mp3_duration

from .serializers import serialize_playlist, serialize_track

logger = logging.getLogger(__name__)


def _track_pk_from_string(value):
    """Accept either '12' or 't12' and return int."""
    if value is None:
        return None
    s = str(value)
    if s.startswith("t"):
        s = s[1:]
    try:
        return int(s)
    except (TypeError, ValueError):
        return None


def _json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


@login_required
@require_GET
def bootstrap(request):
    tracks = list(request.user.tracks.all())
    playlists = list(request.user.playlists.all())
    favs = list(
        request.user.favorites.values_list("track_id", flat=True)
    )
    return JsonResponse(
        {
            "user": {
                "id": request.user.id,
                "name": request.user.username,
                "email": request.user.email,
            },
            "tracks": [serialize_track(t, request) for t in tracks],
            "playlists": [serialize_playlist(p) for p in playlists],
            "favorites": [f"t{tid}" for tid in favs],
        }
    )


@login_required
@require_GET
def tracks_list(request):
    qs = request.user.tracks.all()
    q = request.GET.get("q")
    if q:
        qs = qs.filter(title__icontains=q) | qs.filter(artist__icontains=q)
    genre = request.GET.get("genre")
    if genre and genre != "all":
        qs = qs.filter(genre=genre)
    return JsonResponse(
        {"tracks": [serialize_track(t, request) for t in qs]}
    )


@login_required
@require_POST
def upload_track(request):
    form = TrackUploadForm(request.POST, request.FILES)
    if not form.is_valid():
        return JsonResponse({"errors": form.errors}, status=400)

    upload = request.FILES["file"]

    # Read the whole upload into memory ONCE. This avoids stream-position
    # differences between InMemoryUploadedFile and (disk-backed)
    # TemporaryUploadedFile that vary by file size and machine — the source
    # of inconsistent hashing / truncated saves on some devices.
    try:
        data = b"".join(upload.chunks())
    except Exception as exc:
        logger.exception("upload read failed")
        return JsonResponse(
            {"errors": {"file": [f"Не удалось прочитать файл: {exc}"]}}, status=400
        )
    file_hash = hashlib.sha256(data).hexdigest()

    # Idempotent: if this exact file already exists for the user, return it as
    # success (no error, no new S3 object). Covers manual re-uploads and
    # double-submit races alike.
    existing = Track.objects.filter(
        user=request.user, file_sha256=file_hash
    ).first()
    if existing:
        return JsonResponse(
            {"track": serialize_track(existing, request), "duplicate": True},
            status=200,
        )

    duration = probe_mp3_duration(io.BytesIO(data))

    track = Track(
        user=request.user,
        title=(form.cleaned_data.get("title")
               or (upload.name or "Без названия").rsplit(".", 1)[0]),
        artist=form.cleaned_data.get("artist") or "",
        genre=form.cleaned_data.get("genre") or "Other",
        file_sha256=file_hash,
        file_size=len(data),
        duration=duration or 0,
    )
    cover = request.FILES.get("cover")
    if cover:
        track.cover = cover

    # Write the file to storage from the in-memory bytes (deterministic).
    track.file.save(upload.name or "track.mp3", ContentFile(data), save=False)

    try:
        with transaction.atomic():
            track.save()
    except Exception as exc:
        # Any failure after the file is in storage → remove the orphan so MinIO
        # never accumulates files that have no DB row.
        try:
            track.file.delete(save=False)
        except Exception:
            pass
        if cover:
            try:
                track.cover.delete(save=False)
            except Exception:
                pass
        # Uniqueness race: another request won — return the existing row.
        existing = Track.objects.filter(
            user=request.user, file_sha256=file_hash
        ).first()
        if existing:
            return JsonResponse(
                {"track": serialize_track(existing, request), "duplicate": True},
                status=200,
            )
        logger.exception("upload save failed (not a duplicate)")
        return JsonResponse(
            {"errors": {"file": [f"Не удалось сохранить трек: {exc}"]}},
            status=400,
        )

    return JsonResponse(
        {"track": serialize_track(track, request)}, status=201
    )


@login_required
@require_http_methods(["GET", "PATCH", "DELETE"])
def track_detail(request, pk):
    track = get_object_or_404(Track, pk=pk, user=request.user)
    if request.method == "GET":
        return JsonResponse({"track": serialize_track(track, request)})
    if request.method == "DELETE":
        track.file.delete(save=False)
        if track.cover:
            track.cover.delete(save=False)
        track.delete()
        return JsonResponse({"ok": True})

    # PATCH
    data = _json_body(request)
    form = TrackEditForm(data, instance=track)
    if not form.is_valid():
        return JsonResponse({"errors": form.errors}, status=400)
    form.save()
    return JsonResponse({"track": serialize_track(track, request)})


@login_required
@require_GET
def track_stream(request, pk):
    track = get_object_or_404(Track, pk=pk, user=request.user)
    if not track.file:
        return JsonResponse({"error": "no file"}, status=404)
    url = presigned_url(track.file.name)
    if not url:
        return JsonResponse({"error": "storage unavailable"}, status=500)
    return HttpResponseRedirect(url)


@login_required
@require_POST
def toggle_favorite(request, pk):
    track = get_object_or_404(Track, pk=pk, user=request.user)
    fav, created = Favorite.objects.get_or_create(user=request.user, track=track)
    if not created:
        fav.delete()
        return JsonResponse({"favorite": False})
    return JsonResponse({"favorite": True})


@login_required
@require_http_methods(["GET", "POST"])
def playlists_list(request):
    if request.method == "GET":
        qs = request.user.playlists.all()
        return JsonResponse(
            {"playlists": [serialize_playlist(p) for p in qs]}
        )
    data = _json_body(request)
    name = (data.get("name") or "").strip()
    if not name:
        return JsonResponse({"errors": {"name": ["Введите название."]}}, status=400)
    pl = Playlist.objects.create(
        user=request.user,
        name=name[:120],
        pin=bool(data.get("pin")),
        cover=data.get("cover")
        or "linear-gradient(135deg,#d957a6,#6e1d1d)",
    )
    return JsonResponse({"playlist": serialize_playlist(pl)}, status=201)


@login_required
@require_http_methods(["GET", "PATCH", "DELETE"])
def playlist_detail(request, pk):
    pl = get_object_or_404(Playlist, pk=pk, user=request.user)
    if request.method == "GET":
        return JsonResponse({"playlist": serialize_playlist(pl)})
    if request.method == "DELETE":
        pl.delete()
        return JsonResponse({"ok": True})
    data = _json_body(request)
    if "name" in data:
        pl.name = (data["name"] or "").strip()[:120] or pl.name
    if "pin" in data:
        pl.pin = bool(data["pin"])
    if "cover" in data and data["cover"]:
        pl.cover = data["cover"]
    pl.save()
    return JsonResponse({"playlist": serialize_playlist(pl)})


@login_required
@require_http_methods(["POST", "DELETE"])
def playlist_tracks(request, pk):
    pl = get_object_or_404(Playlist, pk=pk, user=request.user)
    data = _json_body(request)
    track_pk = _track_pk_from_string(data.get("track_id"))
    if track_pk is None:
        return JsonResponse({"error": "track_id required"}, status=400)
    track = get_object_or_404(Track, pk=track_pk, user=request.user)

    if request.method == "POST":
        position = pl.playlisttrack_set.count()
        try:
            PlaylistTrack.objects.create(
                playlist=pl, track=track, position=position
            )
        except IntegrityError:
            return JsonResponse({"ok": True, "note": "already in playlist"})
        return JsonResponse({"playlist": serialize_playlist(pl)}, status=201)

    # DELETE
    PlaylistTrack.objects.filter(playlist=pl, track=track).delete()
    return JsonResponse({"playlist": serialize_playlist(pl)})
