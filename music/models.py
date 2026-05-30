import hashlib
import uuid

from django.conf import settings
from django.db import models


GENRES = [
    ("Synthwave", "Synthwave"),
    ("Ambient", "Ambient"),
    ("Lo-fi", "Lo-fi"),
    ("Drone", "Drone"),
    ("Folk-tronic", "Folk-tronic"),
    ("Post", "Post"),
    ("Spoken", "Spoken"),
    ("Rock", "Rock"),
    ("Pop", "Pop"),
    ("Electronic", "Electronic"),
    ("Jazz", "Jazz"),
    ("Classical", "Classical"),
    ("Other", "Other"),
]


def track_file_path(instance, filename):
    return f"tracks/{instance.user_id}/{uuid.uuid4().hex}-{filename}"


def cover_file_path(instance, filename):
    return f"covers/{instance.user_id}/{uuid.uuid4().hex}-{filename}"


def hash_uploaded_file(django_file):
    h = hashlib.sha256()
    pos = django_file.tell() if hasattr(django_file, "tell") else None
    if hasattr(django_file, "seek"):
        django_file.seek(0)
    for chunk in django_file.chunks():
        h.update(chunk)
    if hasattr(django_file, "seek"):
        django_file.seek(0 if pos is None else pos)
    return h.hexdigest()


class Track(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tracks",
    )
    title = models.CharField(max_length=200)
    artist = models.CharField(max_length=200, blank=True, default="")
    genre = models.CharField(max_length=40, choices=GENRES, blank=True, default="Other")
    duration = models.PositiveIntegerField(default=0, help_text="seconds")
    file = models.FileField(upload_to=track_file_path)
    cover = models.ImageField(upload_to=cover_file_path, null=True, blank=True)
    file_sha256 = models.CharField(max_length=64, db_index=True, blank=True)
    file_size = models.PositiveBigIntegerField(default=0)
    color = models.CharField(max_length=32, blank=True, default="#6e1d1d")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-uploaded_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "file_sha256"],
                name="uniq_user_file_sha256",
            )
        ]

    def save(self, *args, **kwargs):
        # Auto-compute the dedup hash when missing (covers admin uploads,
        # where the readonly field is never populated by the form).
        if self.file and not self.file_sha256:
            try:
                self.file_sha256 = hash_uploaded_file(self.file)
            except Exception:
                pass
            if not self.file_size:
                try:
                    self.file_size = self.file.size
                except Exception:
                    pass
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} — {self.artist or '—'}"


class Playlist(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="playlists",
    )
    name = models.CharField(max_length=120)
    pin = models.BooleanField(default=False)
    cover = models.CharField(
        max_length=200,
        blank=True,
        default="linear-gradient(135deg,#d957a6,#6e1d1d)",
    )
    tracks = models.ManyToManyField(
        Track,
        through="PlaylistTrack",
        related_name="playlists",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-pin", "-created_at"]

    def __str__(self):
        return self.name


class PlaylistTrack(models.Model):
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE)
    track = models.ForeignKey(Track, on_delete=models.CASCADE)
    position = models.PositiveIntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "added_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["playlist", "track"],
                name="uniq_playlist_track",
            )
        ]


class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorites",
    )
    track = models.ForeignKey(Track, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "track"],
                name="uniq_user_track_favorite",
            )
        ]
