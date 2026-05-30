# Унисон

Личный музыкальный сервис: загружай свои MP3, собирай плейлисты, слушай в стилизованном «ламповом» плеере с эквалайзером и визуализатором. Без подписок, региональных ограничений и «серых» кнопок.

- Бэкенд: **Django 5.1 + PostgreSQL 16 + MinIO (S3)**
- Фронтенд: React 18 через CDN + Babel-standalone (прототип из дизайн-бандла), Web Audio API (8-полосный эквалайзер + визуализатор)
- Стилистика: постсоветская «ламповая» эстетика — телевизор на ковре, CRT-эффекты, тёплая палитра

---

## Содержание

1. [Возможности](#возможности)
2. [Архитектура и стек](#архитектура-и-стек)
3. [Быстрый старт](#быстрый-старт)
4. [Структура проекта по файлам](#структура-проекта-по-файлам)
5. [Маршруты и URL](#маршруты-и-url)
6. [REST API](#rest-api)
7. [Модели данных](#модели-данных)
8. [MinIO / S3](#minio--s3)
9. [Команды разработки](#команды-разработки)
10. [Частые проблемы](#частые-проблемы)

---

## Возможности

- Регистрация / вход / выход (стандартная Django-аутентификация на сессиях).
- Загрузка MP3 в облачное S3-хранилище (MinIO). Обложка и метаданные опциональны.
- Защита от дублирования треков по **SHA-256** хэшу файла (per-user).
- Полноценный плеер: play / pause / next / prev, прогресс-бар с перемоткой.
- **8-полосный эквалайзер** на BiquadFilterNode (60Hz – 12kHz).
- **Визуализатор** в трёх стилях: bars / wave / dots — через AnalyserNode.
- Плейлисты: создание, выбор, плейлисты «закреплённые» (pin).
- Избранное: per-user, persist в БД.
- Фонотека с поиском по названию/исполнителю и фильтром по жанру.
- Хоткеи: `Space` — play/pause, `←/→` — трек, `/` — фокус поиска.
- Адаптивная разметка: дизайн на 1440×900, при меньших окнах вся страница масштабируется через `transform: scale`.

---

## Архитектура и стек

```
┌──────────────────────────────────────────────────────────────────┐
│                       Browser (React + Web Audio)                │
│  /accounts/login/, /accounts/signup/  ── Django templates only   │
│  /                                    ── home (TV-меню)           │
│  /about/                              ── О проекте                │
│  /app/                                ── React-плеер              │
│                              │ fetch JSON (cookie session)        │
└──────────────────────────────┼───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                          Django web (8800)                        │
│  • accounts  — register / login / logout views (sessions)         │
│  • music     — models, admin, home/about/app views                │
│  • api       — JSON endpoints для React (bootstrap, tracks, …)    │
└──────────────────────────────┬────────────────┬──────────────────┘
                               ▼                ▼
                         ┌──────────┐     ┌───────────┐
                         │ Postgres │     │   MinIO   │
                         │ (5433)   │     │ S3 (9100) │
                         └──────────┘     └───────────┘
```

### Технологии

| Слой | Технология |
|------|-----------|
| Web framework | Django 5.1.4 |
| Python | 3.12 |
| БД | PostgreSQL 16 + psycopg 3 |
| Хранилище файлов | MinIO (S3-совместимое) через django-storages + boto3 |
| Аутентификация | django.contrib.auth, сессии (HttpOnly cookie) |
| Метаданные MP3 | mutagen (длительность трека) |
| Дедуп | SHA-256 хэш файла, уникальный constraint в БД |
| Frontend (auth/home) | Чистые Django-шаблоны (DTL) + статический CSS |
| Frontend (плеер) | React 18 + Babel-standalone (CDN, без билда), Web Audio API |
| Контейнеры | Docker Compose: 4 сервиса (web, db, minio, minio-init) |

---

## Быстрый старт

### Требования
- Docker и Docker Compose (плагин v2)
- Свободные порты на хосте: **8800, 5433, 9100, 9101**

### Запуск

```bash
git clone <repo>
cd unison
make up           # копирует .env.example → .env и поднимает весь стек
```

Через ~10 секунд сервисы будут доступны:

| Сервис | URL | Логин |
|--------|-----|-------|
| Приложение | http://localhost:8800/ | создаётся регистрацией |
| Django admin | http://localhost:8800/admin/ | через `make superuser` |
| MinIO Console | http://localhost:9101/ | `minioadmin` / `minioadmin` |
| MinIO S3 API | http://localhost:9100/ | то же |

### Создать суперпользователя

```bash
make superuser
```

### Остановить

```bash
make down            # сохранить данные
make clean           # удалить вместе с томами (БД и MinIO)
```

---

## Структура проекта по файлам

```
unison/
├── README.md              ← этот файл
├── Makefile               ← удобные команды (up/down/migrate/...)
├── manage.py              ← Django CLI entrypoint
├── requirements.txt       ← Python-зависимости
├── docker-compose.yml     ← инфраструктура (db, minio, web)
├── Dockerfile             ← образ Django-сервиса
├── .env.example           ← шаблон переменных окружения
├── .gitignore
│
├── unison/                ← Django project (settings, urls)
├── accounts/              ← регистрация/вход/выход
├── music/                 ← модели + страницы
├── api/                   ← JSON endpoints
│
├── templates/             ← HTML-шаблоны (DTL)
├── static/                ← CSS, JSX, картинки
└── media/                 ← пусто (всё в MinIO)
```

### Корень проекта

| Файл | Назначение |
|------|-----------|
| **`manage.py`** | Стандартная Django-точка входа. `DJANGO_SETTINGS_MODULE = unison.settings`. |
| **`requirements.txt`** | `Django==5.1.4`, `psycopg[binary]==3.2.3`, `django-storages[boto3]==1.14.4`, `boto3==1.35.71`, `Pillow==11.0.0`, `python-dotenv==1.0.1`, `gunicorn==23.0.0`, `mutagen==1.47.0`. |
| **`Dockerfile`** | Python 3.12-slim + системные зависимости (`build-essential`, `libpq-dev`, `curl`), pip install, запуск `runserver` на 0.0.0.0:8000. |
| **`docker-compose.yml`** | 4 сервиса: `db` (postgres-16-alpine, healthcheck `pg_isready`), `minio` (с health-check на `/minio/health/ready`), `minio-init` (создаёт бакет `unison-media` через `mc`, ставит политику `download`), `web` (Django, ждёт healthy db+minio, делает `migrate --noinput`, потом `runserver`). |
| **`Makefile`** | `env` — создать .env из шаблона, `up`, `down`, `restart`, `logs`, `migrate`, `makemigrations`, `shell`, `dbshell`, `superuser`, `ps`, `clean`. |
| **`.env.example`** | Шаблон секретов и настроек: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `POSTGRES_*`, `MINIO_*`. Скопируется в `.env` через `make env` / `make up`. |
| **`.env`** | Реальные переменные (создаётся автоматически, **не коммитить**). |
| **`.gitignore`** | Стандартный для Django: `__pycache__/`, `*.pyc`, `.env`, `.venv/`, `db.sqlite3`, `/media/`, `/staticfiles/`. |

### `unison/` — Django project package

| Файл | Назначение |
|------|-----------|
| **`__init__.py`** | Пустой, делает каталог Python-пакетом. |
| **`settings.py`** | Все настройки Django. Читает `.env` через `python-dotenv`. Ключевые блоки: `INSTALLED_APPS` (включая `storages`, `accounts`, `music`, `api`), `DATABASES` (PostgreSQL), `STORAGES` (default = S3-бэкенд django-storages на MinIO с querystring auth и presigned URLs, expire 1 час), `LOGIN_URL = accounts:login`, `LOGIN_REDIRECT_URL = music:app`, лимит загрузки 64 МБ, `CSRF_TRUSTED_ORIGINS`. |
| **`urls.py`** | Корневой роутер: `/admin/`, `/accounts/` → `accounts.urls`, `/api/` → `api.urls`, `/` → `music.urls`. |
| **`wsgi.py`** / **`asgi.py`** | Стандартные точки входа для gunicorn/uvicorn. |

### `accounts/` — учётные записи

| Файл | Назначение |
|------|-----------|
| **`__init__.py`** | Маркер пакета. |
| **`apps.py`** | `AccountsConfig` — стандартная декларация Django-app. |
| **`forms.py`** | `SignupForm(UserCreationForm)` — добавляет необязательное поле `email` к стандартной форме регистрации. Использует `get_user_model()`. |
| **`views.py`** | `SignupView(CreateView)` — рендерит `accounts/signup.html`, после успешной регистрации делает `login()` и редиректит на `music:app`. Залогиненного юзера сразу перебрасывает в `/app/`. `UnisonLoginView`, `UnisonLogoutView` — тонкие обёртки над стандартными вьюхами Django auth со своими шаблонами и редиректами. |
| **`urls.py`** | `accounts:login` → `/accounts/login/`, `accounts:logout` → `/accounts/logout/`, `accounts:signup` → `/accounts/signup/`. |

### `music/` — основной домен

| Файл | Назначение |
|------|-----------|
| **`__init__.py`** | Маркер пакета. |
| **`apps.py`** | `MusicConfig` — стандартная декларация. |
| **`models.py`** | <ul><li>`Track` — `user` FK, `title`, `artist`, `genre` (choices), `duration` (сек), `file` FileField (S3), `cover` ImageField (S3), `file_sha256` (64-char hex), `file_size`, `color`, timestamps. Constraint `uniq_user_file_sha256(user, file_sha256)`.</li><li>`Playlist` — `user`, `name`, `pin`, `cover` (CSS-gradient строка), tracks через `PlaylistTrack`.</li><li>`PlaylistTrack` — through-model, `position`, `added_at`, constraint `uniq_playlist_track`.</li><li>`Favorite` — `user`, `track`, constraint `uniq_user_track_favorite`.</li><li>`hash_uploaded_file(django_file)` — считает SHA-256, корректно работает с InMemoryUploadedFile (читает chunks, не ломает указатель).</li><li>`track_file_path` / `cover_file_path` — генераторы путей вида `tracks/{user_id}/{uuid}-{filename}`.</li></ul> |
| **`forms.py`** | `TrackUploadForm` — ModelForm с валидацией: только MP3, размер ≤50 МБ. `TrackEditForm` — для PATCH (без файла). `PlaylistForm`. |
| **`services.py`** | `probe_mp3_duration(file)` — читает длительность через `mutagen.mp3.MP3` (защищённый try, при ошибке возвращает 0). `_s3_client()` — фабрика boto3 на `MINIO_PUBLIC_ENDPOINT` (важно: presigned URL должен указывать на тот endpoint, который доступен **браузеру**, а не на внутрисетевой `http://minio:9000`). `presigned_url(key)` — генерация подписанного URL для скачивания/проигрывания, expire 1 час. |
| **`admin.py`** | `TrackAdmin` (list_display, filters, search), `PlaylistAdmin` с inline `PlaylistTrack`, `FavoriteAdmin`. |
| **`views.py`** | `HomeView` (`/`) — главная (телевизор + меню вход/регистрация). `AboutView` (`/about/`) — отдельная страница О проекте. `AppView` (`/app/`, LoginRequiredMixin) — рендерит React-плеер; пробрасывает `build_id` (=timestamp старта процесса) в шаблон для cache-busting. |
| **`urls.py`** | `music:home`, `music:about`, `music:app`. |
| **`migrations/0001_initial.py`** | Создаёт Track, Playlist, PlaylistTrack, Favorite + 3 unique constraints. Сгенерирована командой `makemigrations music`. |

### `api/` — JSON endpoints для React

| Файл | Назначение |
|------|-----------|
| **`__init__.py`** | Маркер пакета. |
| **`apps.py`** | `ApiConfig`. |
| **`serializers.py`** | Ручные dict-сериализаторы (DRF не используется, чтобы не тащить лишнюю зависимость). `serialize_track(track, request)` собирает absolute stream URL через `request.build_absolute_uri(reverse(...))`. `serialize_playlist(pl)` — id вида `"p<pk>"`, tracks через ordered through-model. Внешние id — строки с префиксами (`t1`, `p2`) для совместимости с фронтом, плюс отдельное поле `pk` (числовое). |
| **`urls.py`** | `bootstrap`, `tracks` (list), `upload`, `track-detail`, `track-stream`, `favorite`, `playlists` (list/create), `playlist-detail`, `playlist-tracks`. |
| **`views.py`** | Простые функции-вью с `@login_required` и `@require_GET/POST/...`. <ul><li>**`bootstrap`** (GET) — стартовый payload для React: `user`, `tracks`, `playlists`, `favorites`. Один запрос — все данные.</li><li>**`tracks_list`** (GET) — с фильтрами `q`, `genre`.</li><li>**`upload_track`** (POST, multipart) — валидация формы → SHA-256 → проверка дубля (409 при дубле) → `probe_mp3_duration` → сохранение. Все ошибки в `errors` dict.</li><li>**`track_detail`** (GET/PATCH/DELETE) — на DELETE удаляет файл и обложку из MinIO перед `Track.delete()`.</li><li>**`track_stream`** (GET) — `HttpResponseRedirect` на presigned URL → браузер запрашивает напрямую у MinIO, минуя Django (важно для скорости).</li><li>**`toggle_favorite`** (POST) — get_or_create / delete.</li><li>**`playlists_list`**, **`playlist_detail`**, **`playlist_tracks`** — CRUD плейлистов и добавление/удаление треков.</li></ul> |

### `templates/` — Django-шаблоны (DTL)

| Файл | Назначение |
|------|-----------|
| **`base.html`** | Базовый layout: `<meta viewport="device-width">`, шрифты Google Fonts (Bebas Neue, Courier Prime, IBM Plex Mono, VT323), `styles.css`, блоки `body`, `scripts`. |
| **`music/home.html`** | Главная: `tv-carpet.png` на ковре, внутри cream-экрана меню «Вход / Регистрация» (или «В эфир / Выйти» если залогинен), снизу плавающая ссылка «о проекте →». Один экран на 100vh, без скролла. |
| **`music/about.html`** | О проекте — отдельная страница. Шапка «◂ на главную · UNISON · музыка без подписок», ниже секция `.about` с метаданными в 3 колонки и CTA внизу. |
| **`music/app.html`** | Контейнер для React: пустой `<div id="root">`, окно глобалов (`UNISON_USER`, `UNISON_URLS`, `UNISON_CSRF`, `UNISON_DEFAULTS`), подключение React 18 + ReactDOM + Babel-standalone с CDN, далее `tweaks-panel.jsx`, `audio.jsx`, `screens.jsx`, `app.jsx` через `<script type="text/babel">`. Каждый JSX-файл с `?v={{ build_id }}` для cache-busting. |
| **`accounts/login.html`** | Форма входа в стиле «надпись на экране ТВ»: тот же `.login-hero` фон, внутри cream-экрана `.tv-form` с `tv-field` (логин, пароль), кнопка `tv-submit`. Использует `{% csrf_token %}`. |
| **`accounts/signup.html`** | Аналогично, плюс поля email и подтверждения пароля; ошибки формы рендерятся под каждым полем. |

### `static/` — статика

#### `static/css/styles.css`

Один большой CSS-файл (≈1700 строк). Разделы:

- **`:root`** — палитра (`--cream`, `--brown-*`, `--accent` magenta, `--accent-2` ярко-розовый), шрифты.
- **Reset + базовые элементы** (`html, body, button, input, ::selection`).
- **`.home / .login`** — обёртки страниц.
- **`.login-hero` + `.carpet-wrap` + `.login-screen-overlay`** — главная сцена с телевизором, маска `::after` поверх burnt-in «О проекте» текста в карпет-картинке.
- **`.tv-menu`, `.tv-form`, `.tv-field`, `.tv-submit`** — формы на «экране».
- **`.about / .about-page`** — оформление страницы О проекте.
- **`.main-header`, `.main-nav`, `.user-chip`, `.user-menu`** — навбар приложения с combo-box на чипе пользователя (выйти / на главную в дропдауне).
- **`.main-stage`, `.sidebar`, `.sidebar-show`, `.sidebar-hide`** — двух-колоночный layout (380px sidebar + 1fr TV).
- **`.tv-stage`, `.tv-frame`, `.tv-img`, `.tv-screen`, `.tv-mask`, `.crt-flicker`** — карпетный ТВ-фрейм (1060×828) + cream-экран с CRT-эффектами (scanlines, vignette, phosphor stripes) поверх. `.tv-frame::after` — нижний градиент-маска, скрывает напечатанный в картинке текст «О ПРОЕКТЕ».
- **`.player`, `.viz-wrap`, `.progress`, `.controls`, `.eq`** — UI плеера внутри экрана.
- **`.player-empty`** — состояние «нет сигнала» с CTA «загрузить трек».
- **`.edit-pane`, `.edit-form`, `.dropzone`, `.edit-actions`, `.edit-alert`** — карточка загрузки/редактирования трека с плотным cream-фоном и `z-index: 50` (поверх CRT-маски).
- **`.lib-grid`, `.lib-row`** — фонотека (список треков).
- **`@media (max-width: 1439px)`** — `transform: scale(calc(100vw/1440))` на body для проп. масштабирования.
- **`@media (max-width: 768px)`** — авто-скрытие sidebar.

#### `static/js/`

JSX, не транспилированный — компилируется в браузере Babel-standalone.

| Файл | Назначение |
|------|-----------|
| **`tweaks-panel.jsx`** | Служебная панель «Tweaks» из дизайн-бандла (Anthropic Design tool). В Unison-проде не отображается, активируется только при загрузке в дизайн-тулзе через `postMessage('__activate_edit_mode')`. Экспортирует в `window`: `useTweaks`, `TweaksPanel`, `TweakSection`, `TweakToggle`, `TweakRadio`, `TweakColor`, `TweakButton`. |
| **`audio.jsx`** | **Аудио-движок и визуализатор.** <ul><li>`useAudio(initialQueue, opts)` — хук. Управляет очередью треков, idx, isPlaying, временем, громкостью, эквалайзером (массив дБ для 8 полос), избранным (`Set` строковых id).</li><li>Web Audio граф: `HTMLAudioElement` → `MediaElementSource` → 8 × `BiquadFilterNode` (lowshelf / 6 × peaking / highshelf) → `GainNode` → `AnalyserNode` → `destination`.</li><li>`toggleFav(id, pk)` — оптимистично обновляет локальный `Set`, потом POST `/api/tracks/<pk>/favorite/` с CSRF.</li><li>Управление: `play`, `pause`, `toggle`, `next`, `prev`, `seek`, `setVol`, `setEqBand`, `resetEq`, `playTrack`, `addTrack`, `removeTrack`, `updateTrack`.</li><li>`<Visualizer>` — canvas-визуализатор поверх AnalyserNode (3 стиля: bars / wave / dots). Если реальных данных нет — рисует «фейковый» анимированный паттерн (kick + lead + hi-hat огибающие).</li></ul> |
| **`screens.jsx`** | **Все панели UI.** <ul><li>`TvScreen` — обёртка cream-экрана. Координаты (`left/top/width/height`) подобраны под `tv-carpet.png` на scale 1.274.</li><li>`Player` — текущий трек + визуализатор + прогресс + transport + громкость + эквалайзер.</li><li>`EditPane` — карточка загрузки/редактирования. Dropzone это `<label>` с `<input type="file">` внутри (нативный flow, без `ref.click()`). Запасной системный file-input снизу. POST `/api/tracks/upload/` с FormData.</li><li>`LibraryPane` — фонотека: тулбар + список треков с фильтром по жанру + клик по треку → playTrack.</li><li>`Sidebar` — список плейлистов + треки текущего плейлиста (или всех).</li><li>`csrfHeaders` — хелпер для добавления `X-CSRFToken` в fetch-запросы (берёт из `window.UNISON_CSRF`).</li></ul> |
| **`app.jsx`** | **Корень React-приложения.** <ul><li>`Bootstrapper` — компонент-загрузчик: fetch `/api/bootstrap/`, при 302/403 редиректит на login, при ошибке показывает сообщение, при успехе передаёт данные в `<App initial={...}/>`. До загрузки рендерит «НАСТРАИВАЕМ АНТЕННУ…».</li><li>`App` — главный layout: header (UNISON + nav + поиск + user-chip с combo-box), main-stage (Sidebar + TvScreen с одной из трёх панелей: Player/EditPane/LibraryPane). Глобальные хоткеи (`Space`, `←/→`, `/`).</li><li>Combo-box на user-chip: click → дропдаун с «на главную» и «выйти» (POST формой через CSRF). Click-outside закрывает.</li><li>`createPlaylist` — `prompt()` + POST `/api/playlists/`.</li><li>Tweaks-панель отключена в проде (открывается только из дизайн-тулзы).</li></ul> |

#### `static/assets/`

| Файл | Назначение |
|------|-----------|
| **`tv-carpet.png`** (832×1248) | Прямостоящий ТВ на ковре. Используется и на /home/, и на /app/. |
| **`tv-table.png`** (1360×768) | Альтернативный ракурс — ТВ под углом на столе. Сейчас не используется (был на /app/ в первой итерации), оставлен в репо. |

### `media/`

Локально пустая. Все загруженные файлы идут в MinIO через django-storages. Если в будущем понадобится FileSystemStorage — сюда.

---

## Маршруты и URL

| URL | View | Описание |
|-----|------|----------|
| `GET /` | `music.HomeView` | Главная: ТВ-меню (вход / регистрация / в эфир) |
| `GET /about/` | `music.AboutView` | О проекте — отдельная страница |
| `GET /app/` | `music.AppView` (LoginRequired) | Плеер (React) |
| `GET /accounts/login/` | `UnisonLoginView` | Форма входа |
| `POST /accounts/login/` | то же | Обработка входа |
| `GET /accounts/signup/` | `SignupView` | Форма регистрации |
| `POST /accounts/signup/` | то же | Создание юзера + auto-login |
| `POST /accounts/logout/` | `UnisonLogoutView` | Выход |
| `/admin/...` | django.contrib.admin | Стандартная админка |
| `/api/...` | `api.urls` | См. ниже |

---

## REST API

Все эндпоинты требуют сессионной аутентификации. Для POST/PATCH/DELETE необходим заголовок `X-CSRFToken` (берётся из `window.UNISON_CSRF` в React).

| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/bootstrap/` | Стартовый payload: `{user, tracks[], playlists[], favorites[]}` |
| GET | `/api/tracks/?q=&genre=` | Список треков пользователя с фильтром |
| POST | `/api/tracks/upload/` | multipart: `file`, `cover?`, `title`, `artist`, `genre`. 201 / 400 / 409 (дубль) |
| GET | `/api/tracks/<pk>/` | Детали |
| PATCH | `/api/tracks/<pk>/` | JSON: `title?, artist?, genre?` |
| DELETE | `/api/tracks/<pk>/` | Удалить (вместе с файлом и обложкой в MinIO) |
| GET | `/api/tracks/<pk>/stream/` | 302 на presigned URL MinIO (живёт 1 час) |
| POST | `/api/tracks/<pk>/favorite/` | Toggle избранное |
| GET | `/api/playlists/` | Список плейлистов пользователя |
| POST | `/api/playlists/` | JSON: `name, pin?, cover?` |
| GET / PATCH / DELETE | `/api/playlists/<pk>/` | Детали / редактирование / удаление |
| POST | `/api/playlists/<pk>/tracks/` | JSON: `track_id` ("t12" или 12) — добавить трек |
| DELETE | `/api/playlists/<pk>/tracks/` | JSON: `track_id` — убрать трек |

Ответы всегда JSON. Ошибки валидации в формате `{"errors": {"field": ["msg", ...]}}`.

---

## Модели данных

```python
Track(user, title, artist, genre, duration, file, cover, file_sha256, file_size, color, uploaded_at, updated_at)
  UniqueConstraint(user, file_sha256)  ← дедуп per-user

Playlist(user, name, pin, cover, created_at, updated_at)
  Ordering: -pin, -created_at  (закреплённые сверху)

PlaylistTrack(playlist, track, position, added_at)
  UniqueConstraint(playlist, track)
  Ordering: position, added_at

Favorite(user, track, created_at)
  UniqueConstraint(user, track)
```

---

## MinIO / S3

- Бакет: `unison-media` (создаётся `minio-init` контейнером при первом старте через `mc mb`)
- Политика: `download` (анонимный read разрешён, чтобы presigned URL не были обязательны для отдачи статичных обложек — но для самих треков мы всё равно отдаём через presigned для безопасности и контроля доступа)
- Доступ:
  - Внутри docker-сети: `http://minio:9000`
  - Из браузера: `http://localhost:9100`
- Presigned URLs строятся через **публичный** endpoint (`MINIO_PUBLIC_ENDPOINT`), потому что подпись содержит хост и должна совпадать с тем, что увидит браузер.
- Структура ключей:
  ```
  tracks/<user_id>/<uuid>-<original-filename>
  covers/<user_id>/<uuid>-<original-filename>
  ```
- Дедуп: SHA-256 файла считается в `music.models.hash_uploaded_file`. При совпадении хэша у того же юзера — отказ 409.

---

## Команды разработки

```bash
# Поднять весь стек
make up

# Логи Django
make logs

# Создать миграции (после изменения models.py)
make makemigrations
# или для конкретного app:
docker compose exec web python manage.py makemigrations music

# Применить миграции
make migrate

# Django shell
make shell

# Postgres psql
make dbshell

# Создать суперпользователя
make superuser

# Перезапустить только web
docker compose restart web

# Полный сброс (включая БД и MinIO)
make clean
```

### Внести изменения во фронтенд

Файлы `static/js/*.jsx` и `static/css/styles.css` примонтированы в контейнер volume’ом (`./static:/app/static`). Любое изменение видно по F5 в браузере. Шаблоны (`templates/`) тоже автоматически перечитываются.

Babel-standalone компилирует JSX на лету в браузере. На каждый запрос /app/ генерируется новый `build_id` (timestamp старта Django-процесса) — он приклеивается к URL скриптов как `?v=...` для cache-busting. Если что-то «зависает» в кэше — `make restart` (рестарт web обновит build_id).

### Внести изменения в модели

```bash
# Меняешь music/models.py …
make makemigrations
make migrate
```

---

## Частые проблемы

- **Порты заняты другим стеком.** Проект специально использует нестандартные порты (8800, 5433, 9100, 9101), чтобы не конфликтовать. Если и они заняты — поправь в `docker-compose.yml` и `CSRF_TRUSTED_ORIGINS` в `settings.py`.
- **«Ничего не происходит» при клике в браузере.** Чаще всего — кэш Babel-standalone. Решается: `make restart` (новый `build_id` → новый `?v=` → принудительная перезагрузка скриптов). Если не помогло — Ctrl+Shift+R.
- **`csrf token from POST incorrect`.** Cookie `csrftoken` ставится только при первом GET на страницу с `{% csrf_token %}`. Просто перезагрузи `/app/`.
- **MinIO 403 при стриминге.** Проверь что `MINIO_PUBLIC_ENDPOINT` в `.env` указывает на хост, доступный из браузера (по умолчанию `http://localhost:9100`).
- **Трек не воспроизводится после рестарта.** Presigned URL живёт 1 час. После истечения нужно перезагрузить трек (просто кликни по нему ещё раз — React получит новый URL через bootstrap или playTrack).
- **«Этот трек уже загружен» (409).** Сработал SHA-256 дедуп. Это не баг — файл с этим хэшем уже есть в твоей коллекции.

---

## Лицензия и происхождение

Учебный проект. Дизайн (HTML/CSS + React-прототип в `static/js/*.jsx`) — экспорт из дизайн-тулзы Claude Design, бандл сложен в `static/`. Бэкенд написан с нуля под этот фронт.
