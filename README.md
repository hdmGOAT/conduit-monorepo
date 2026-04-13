# conduit-monorepo

Monorepo containing:
- `conduit-api`: Go + Gin backend
- `conduit-frontend`: Next.js frontend

## Run in development

Run both apps together:

```bash
make dev
```

Run individually:

```bash
make dev-api
make dev-frontend
```

## Quality checks

```bash
make lint
make test
make build-api
```

Run the same checks as CI:

```bash
make ci
```

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

It runs:
- Backend: `gofmt` check, `go vet`, `go test`, `go build`
- Frontend: `npm ci`, `npm run lint`, `npm test`
