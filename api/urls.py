from django.urls import path

from . import views

app_name = "api"

urlpatterns = [
    path("bootstrap/", views.bootstrap, name="bootstrap"),
    path("tracks/", views.tracks_list, name="tracks"),
    path("tracks/upload/", views.upload_track, name="upload"),
    path("tracks/<int:pk>/", views.track_detail, name="track-detail"),
    path("tracks/<int:pk>/stream/", views.track_stream, name="track-stream"),
    path("tracks/<int:pk>/favorite/", views.toggle_favorite, name="favorite"),
    path("playlists/", views.playlists_list, name="playlists"),
    path("playlists/<int:pk>/", views.playlist_detail, name="playlist-detail"),
    path("playlists/<int:pk>/tracks/", views.playlist_tracks, name="playlist-tracks"),
]
