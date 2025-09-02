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

