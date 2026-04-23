# conduit-monorepo

Monorepo containing:
- `conduit-api`: Go + Gin backend
- `conduit-frontend`: Next.js frontend

## Run in development

Environment variables are loaded from `.env` for local development. See `.env.example` for the committed template.

Add these values:

```text
PORT=8080
DATABASE_URL=postgres://conduit:conduit@localhost:5432/conduit?sslmode=disable
JWT_SECRET=dev-change-me
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_HOURS=168
PASSWORD_RESET_TTL_MINUTES=30
COOKIE_SECURE=false
FRONTEND_URL=http://localhost:3000
RESEND_FROM_EMAIL=Conduit <onboarding@resend.dev>
RESEND_API_KEY=<your_resend_api_key>
API_BASE_URL=http://localhost:8080
```

Run both apps together:

```bash
make dev
```

Run individually:

```bash
make dev-api
make dev-frontend
```

## Environment example

Copy the template and fill in your local values:

```bash
cp .env.example .env
```

The template includes backend, frontend, and Stripe values used by local development.

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
