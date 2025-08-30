dev:
	docker compose watch

local-production:
	docker compose -f docker-compose.local-production.yml up -d --build --remove-orphans


