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

## Database (Docker)

Start PostgreSQL:

```bash
make db-up
```

Stop services:

```bash
make db-down
```

Reset PostgreSQL volume:

```bash
make db-reset
```

Run migrations:

```bash
make migrate-up
```

Rollback one migration:

```bash
make migrate-down
```

Generate Go DB models/queries from SQL (sqlc):

```bash
make sqlc-generate
```

Generate API route docs for frontend integration:

```bash
make docs-api
```

Output file: `conduit-api/docs/api-routes.md`

Docker migration target uses this database URL:

```text
postgres://conduit:conduit@postgres:5432/conduit?sslmode=disable
```

From host tools (for example psql on your machine), use:

```text
postgres://conduit:conduit@localhost:5432/conduit?sslmode=disable
```

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

It runs:
- Backend: `gofmt` check, `go vet`, `go test`, `go build`
- Frontend: `npm ci`, `npm run lint`, `npm test`
