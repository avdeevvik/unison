from django.contrib.auth import login
from django.contrib.auth.views import LoginView, LogoutView
from django.shortcuts import redirect
from django.urls import reverse_lazy
from django.views.generic import CreateView

from .forms import SignupForm


class SignupView(CreateView):
    form_class = SignupForm
    template_name = "accounts/signup.html"
    success_url = reverse_lazy("music:app")

    def form_valid(self, form):
        response = super().form_valid(form)
        login(self.request, self.object)
        return response

    def get(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect("music:app")
        return super().get(request, *args, **kwargs)


class UnisonLoginView(LoginView):
    template_name = "accounts/login.html"
    redirect_authenticated_user = True


class UnisonLogoutView(LogoutView):
    next_page = "music:home"
