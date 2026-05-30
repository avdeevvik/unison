import time

from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


BUILD_ID = str(int(time.time()))


class HomeView(TemplateView):
    template_name = "music/home.html"


class AboutView(TemplateView):
    template_name = "music/about.html"


class AppView(LoginRequiredMixin, TemplateView):
    template_name = "music/app.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["build_id"] = BUILD_ID
        return ctx
