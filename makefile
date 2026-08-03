build-dev:
	docker build -f Dockerfile.api --tag dwichs-api-dev .

prod-build:
	docker build -f Dockerfile.production.api --tag dwichs-api .
	docker build -f Dockerfile.production.reverse-proxy --tag dwichs-reverse-proxy .
prod-rm:
	docker service rm dwichs_api
	docker service rm dwichs_reverse-proxy
prod-deploy:
	docker stack deploy -c docker-compose.production.yml dwichs
prod-ls:
	docker ps

reset: 
	docker run --rm -it \
		--name dwichs-api-temp \
		--hostname dwichs-api-temp \
		-p 3001:3000 \
		--network dwichs \
		--workdir /app \
		-v ./prisma:/app/prisma \
		-v ./.env:/app/.env \
		dwichs-api-dev \
		npx prisma migrate reset

seed: 
	docker run --rm -it \
		--name dwichs-api-temp \
		--hostname dwichs-api-temp \
		-p 3001:3000 \
		--network dwichs \
		--workdir /app \
		-v ./prisma:/app/prisma \
		-v ./.env:/app/.env \
		dwichs-api-dev \
		npx prisma db seed

prod-seed: 
	docker run --rm -it \
		--name dwichs-api-temp \
		--hostname dwichs-api-temp \
		-p 3001:3000 \
		--network dwichs \
		--workdir /app \
		-v ./prisma:/app/prisma \
		-v ./.env:/app/.env \
		dwichs-api \
		npx prisma db seed

psql:
	docker exec -it $(docker ps --filter name=dwichs_database -q) psql -U admin -d dwichs

logs-api:
	docker service logs dwichs_api --raw --timestamps --follow

logs-database:
	docker service logs dwichs_database --raw --timestamps --follow

