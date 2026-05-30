from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls", namespace="accounts")),
    path("api/", include("api.urls", namespace="api")),
    path("", include("music.urls", namespace="music")),
]
