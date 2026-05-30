from django import forms

from .models import GENRES, Playlist, Track


class TrackUploadForm(forms.ModelForm):
    title = forms.CharField(max_length=200, required=False)
    artist = forms.CharField(max_length=200, required=False)
    genre = forms.ChoiceField(choices=GENRES, required=False)

    class Meta:
        model = Track
        fields = ("title", "artist", "genre", "file", "cover")

    def clean_file(self):
        f = self.cleaned_data["file"]
        if not f:
            raise forms.ValidationError("Файл обязателен.")
        name = (f.name or "").lower()
        ctype = (getattr(f, "content_type", "") or "").lower()
        if not (name.endswith(".mp3") or "mpeg" in ctype or "mp3" in ctype):
            raise forms.ValidationError("Принимаются только MP3-файлы.")
        if f.size > 50 * 1024 * 1024:
            raise forms.ValidationError("Файл больше 50 МБ.")
        return f


class TrackEditForm(forms.ModelForm):
    class Meta:
        model = Track
        fields = ("title", "artist", "genre", "cover")


class PlaylistForm(forms.ModelForm):
    class Meta:
        model = Playlist
        fields = ("name", "pin", "cover")
