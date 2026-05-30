from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("login/", views.UnisonLoginView.as_view(), name="login"),
    path("logout/", views.UnisonLogoutView.as_view(), name="logout"),
    path("signup/", views.SignupView.as_view(), name="signup"),
]
