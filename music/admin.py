from django.contrib import admin

from .models import Favorite, Playlist, PlaylistTrack, Track


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ("title", "artist", "genre", "user", "duration", "uploaded_at")
    list_filter = ("genre", "uploaded_at")
    search_fields = ("title", "artist", "user__username")
    readonly_fields = ("file_sha256", "file_size", "uploaded_at", "updated_at")


class PlaylistTrackInline(admin.TabularInline):
    model = PlaylistTrack
    extra = 0


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "pin", "created_at")
    list_filter = ("pin",)
    search_fields = ("name", "user__username")
    inlines = [PlaylistTrackInline]


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("user", "track", "created_at")
