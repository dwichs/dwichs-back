build-dev:
	docker build -f Dockerfile.api --tag dwichs-api-dev .

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

