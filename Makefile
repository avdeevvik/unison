.PHONY: env up down restart logs migrate makemigrations shell dbshell superuser ps clean

env:
	@if [ ! -f .env ]; then cp .env.example .env && echo ".env создан из .env.example"; \
	else echo ".env уже существует"; fi

up: env
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose restart web

logs:
	docker compose logs -f web

migrate:
	docker compose exec web python manage.py migrate

makemigrations:
	docker compose exec web python manage.py makemigrations

shell:
	docker compose exec web python manage.py shell

dbshell:
	docker compose exec db psql -U unison -d unison

superuser:
	docker compose exec web python manage.py createsuperuser

ps:
	docker compose ps

clean:
	docker compose down -v
