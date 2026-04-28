SHELL := /bin/bash

DB_USER ?= conduit
DB_PASSWORD ?= conduit
DB_NAME ?= conduit
DB_PORT ?= 5432
DB_URL_LOCAL := postgres://$(DB_USER):$(DB_PASSWORD)@localhost:$(DB_PORT)/$(DB_NAME)?sslmode=disable
DB_URL_DOCKER := postgres://$(DB_USER):$(DB_PASSWORD)@postgres:5432/$(DB_NAME)?sslmode=disable

.PHONY: dev dev-api dev-frontend lint lint-api lint-frontend test test-api test-frontend build-api ci db-up db-down db-logs db-reset migrate-up migrate-down sqlc-generate docs-api

dev:
	@set -euo pipefail; \
	(cd conduit-api && go run .) & API_PID=$$!; \
	(cd conduit-frontend && npm run dev) & WEB_PID=$$!; \
	trap 'kill $$API_PID $$WEB_PID 2>/dev/null || true' INT TERM EXIT; \
	wait $$API_PID $$WEB_PID

dev-api:
	cd conduit-api && go run .

dev-frontend:
	cd conduit-frontend && npm run dev

lint: lint-api lint-frontend

lint-api:
	cd conduit-api && test -z "$$(gofmt -l .)" && go vet ./...

lint-frontend:
	cd conduit-frontend && npm run lint

test: test-api test-frontend

test-api:
	cd conduit-api && go test ./...

test-frontend:
	cd conduit-frontend && npm test

build-api:
	cd conduit-api && go build ./...

ci: lint test build-api

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

db-logs:
	docker compose logs -f postgres
	test-api-race:
		cd conduit-api && go test -race ./...

	test-api-integration:
		cd conduit-api && go test -v ./app/api -run "Concurrent|Member|Stripe|Webhook|Payment|Closed|Billing|Multiple|Zero" -timeout 30s

db-reset:
	docker compose down -v
	docker compose up -d postgres

migrate-up:
	docker compose run --rm migrate -path=/migrations -database "$(DB_URL_DOCKER)" up

migrate-down:
	docker compose run --rm migrate -path=/migrations -database "$(DB_URL_DOCKER)" down 1

sqlc-generate:
	docker compose run --rm sqlc generate

docs-api:
	cd conduit-api && go run ./cmd/apidocs
