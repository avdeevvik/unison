from django.urls import path

from . import views

app_name = "music"

urlpatterns = [
    path("", views.HomeView.as_view(), name="home"),
    path("about/", views.AboutView.as_view(), name="about"),
    path("app/", views.AppView.as_view(), name="app"),
]
