# Product Finder

Customer-facing catalogue search for specialty chemicals, fed by the nightly PIM CSV export.

> Design decisions, assumptions and trade-offs: [DECISIONS.md](DECISIONS.md) · AI usage: [AI_USAGE.md](AI_USAGE.md)

## Repository layout

```
apps/api     NestJS + Prisma (PostgreSQL) — REST API and the CSV import CLI
apps/web     Angular 21 + PrimeNG 21 — the Product Finder UI (why not 22: see DECISIONS.md)
data/        products.csv — sample PIM export (stand-in for the nightly file)
docker/      Postgres init script (creates the test database)
```

pnpm workspace; each app has its own dependencies and Jest setup.

## Prerequisites

- Docker with Docker Compose v2
- For local development: Node.js 22 (`.nvmrc`) and pnpm 10 (`corepack enable` picks the pinned version)

## Run everything with Docker

```bash
docker compose up --build
```

- Web UI: http://localhost:4200
- API: http://localhost:3000/api (health: `/api/health`)
- Postgres: `localhost:5433` (user/password `finder`)

On every start the API container runs `prisma migrate deploy` and then the product import. The import is idempotent, so restarts are safe.

## Local development

```bash
cp .env.example .env
pnpm install
pnpm db:up            # Postgres only, in Docker
pnpm db:migrate       # apply migrations
pnpm db:import        # import data/products.csv
pnpm dev:api          # http://localhost:3000/api
pnpm dev:web          # http://localhost:4200 (proxies /api to :3000)
```

## Importing the PIM export

```bash
pnpm --filter api import:products                         # data/products.csv
pnpm --filter api exec tsx src/import/cli.ts <file.csv> [--dry-run] [--force]
```

Properties of the import:

- **Works on an empty database.** Products are upserted by SKU.
- **Safe to re-run.** Unchanged rows are not written at all, so the second run reports `200 unchanged`.
- **Never touches reviews.** Products are never deleted. A SKU that is missing from the export is *delisted* (`delisted_at`) and relisted if it comes back.
- **Fails safe.** Everything runs in one transaction. A broken file, or an export that would delist more than 50% of the catalogue (typically a truncated file), aborts the run without changes. `--force` overrides that check.
- **Auditable.** Every run, including its data-quality warnings, is stored in `import_runs`.

## Tests

```bash
pnpm test               # unit tests, API + web (no database needed)
pnpm db:up
pnpm test:integration   # API against the real Postgres test database (TEST_DATABASE_URL)
```

Integration tests run migrations against `product_finder_test` and truncate it between tests. They refuse to run when it is the same database as `DATABASE_URL`.
