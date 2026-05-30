"""Django settings for Unison."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env(key, default=None):
    return os.environ.get(key, default)


def env_bool(key, default=False):
    v = os.environ.get(key)
    if v is None:
        return default
    return v.lower() in ("1", "true", "yes", "on")


SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-insecure-please-change")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = [h.strip() for h in env("DJANGO_ALLOWED_HOSTS", "*").split(",") if h.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "storages",
    "accounts",
    "music",
    "api",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "unison.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "unison.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", "unison"),
        "USER": env("POSTGRES_USER", "unison"),
        "PASSWORD": env("POSTGRES_PASSWORD", "unison"),
        "HOST": env("POSTGRES_HOST", "localhost"),
        "PORT": env("POSTGRES_PORT", "5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 6}},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGIN_URL = "accounts:login"
LOGIN_REDIRECT_URL = "music:app"
LOGOUT_REDIRECT_URL = "music:home"

DATA_UPLOAD_MAX_MEMORY_SIZE = 64 * 1024 * 1024  # 64MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 64 * 1024 * 1024

# ---- MinIO / S3 storage ----------------------------------------------------
MINIO_BUCKET = env("MINIO_BUCKET", "unison-media")
MINIO_ENDPOINT = env("MINIO_ENDPOINT", "http://minio:9000")
MINIO_PUBLIC_ENDPOINT = env("MINIO_PUBLIC_ENDPOINT", "http://localhost:9000")
MINIO_REGION = env("MINIO_REGION", "us-east-1")
MINIO_ACCESS_KEY = env("MINIO_ROOT_USER", "minioadmin")
MINIO_SECRET_KEY = env("MINIO_ROOT_PASSWORD", "minioadmin")

STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": MINIO_BUCKET,
            "endpoint_url": MINIO_ENDPOINT,
            "access_key": MINIO_ACCESS_KEY,
            "secret_key": MINIO_SECRET_KEY,
            "region_name": MINIO_REGION,
            "addressing_style": "path",
            "signature_version": "s3v4",
            "file_overwrite": False,
            "querystring_auth": True,
            "querystring_expire": 60 * 60,
            "url_protocol": "http:",
            "custom_domain": False,
        },
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

SESSION_COOKIE_AGE = 60 * 60 * 24 * 30
CSRF_TRUSTED_ORIGINS = [
    "http://localhost", "http://localhost:8000", "http://localhost:8800",
    "http://127.0.0.1:8000", "http://127.0.0.1:8800",
]
