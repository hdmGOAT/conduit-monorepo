SHELL := /bin/bash

.PHONY: dev dev-api dev-frontend lint lint-api lint-frontend test test-api test-frontend build-api ci

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
