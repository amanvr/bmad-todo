# Backend (`@bmad-todo/backend`)

Fastify HTTP backend for the bmad-todo app. TypeScript strict, layered architecture (controllers → services → repositories → db).

## Local development

```bash
# From repo root, with .env populated:
docker compose up backend postgres -d --wait

# OR run outside Docker (requires Postgres running somewhere accessible):
npm run dev --workspace @bmad-todo/backend
```

`npm run dev` uses `tsx --watch` for hot-reload. Source mounts come via `docker-compose.override.yml` once Story 1.4 wiring lands.

## Testing

```bash
# Unit + non-DB integration tests (Fastify inject; Postgres tests skip)
npm run test --workspace @bmad-todo/backend

# Coverage report (≥70% required per NFR18)
npm run test:coverage --workspace @bmad-todo/backend

# Postgres-required integration tests (opts in via RUN_POSTGRES_TESTS=true).
# Requires bmad_todo_test DB to exist; run `docker compose up postgres -d` first
# and create the test DB if it doesn't exist (see *Local DB workflow* below).
npm run test:integration --workspace @bmad-todo/backend
```

## Local DB workflow

Story 1.7 introduces Drizzle ORM. Schema lives in `src/db/schema.ts`; migrations in `drizzle/`.

```bash
# Regenerate migrations after a schema change
npm run db:generate --workspace @bmad-todo/backend

# Apply pending migrations against $DATABASE_URL (also runs at backend startup)
npm run db:migrate --workspace @bmad-todo/backend

# Drizzle Studio — local DB browser
npm run db:studio --workspace @bmad-todo/backend
```

### Creating the test database (one-time)

`bmad_todo_test` is a separate logical DB used by `test:integration`. With Postgres up:

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -c "CREATE DATABASE bmad_todo_test;"
```

(Postgres has no `CREATE DATABASE IF NOT EXISTS`; if it already exists the command fails with a duplicate-database error which is safe to ignore.)

## Architecture & layering

Controllers → services → repositories → db. **One-way only** — lower layers never import upper.

- `src/server.ts` — entry; calls `buildApp()` + `listen()`.
- `src/app.ts` — `buildApp(config)` factory; testable without binding to a port.
- `src/config.ts` — Zod-validated env loader; fails fast on bad config.
- `src/errors.ts` — `AppError` + 4 subclasses.
- `src/logger.ts` — pino factory.
- `src/plugins/` — `cors.ts`, `helmet.ts`, `userContext.ts`, `errorHandler.ts`.
- `src/controllers/healthController.ts` — `GET /api/health`.

- `src/repositories/` — `TodoRepository` interface + `PostgresTodoRepository` (Story 1.7).
- `src/db/` — Drizzle schema, client, migrations (Story 1.7).

Future (later stories):

- `src/services/` (Story 1.8+) — business logic.

For the architectural canon: see `_bmad-output/planning-artifacts/architecture.md` _Service Boundaries_ and _Implementation Patterns & Consistency Rules_ sections.

## Auth-readiness seam

`src/plugins/userContext.ts` stamps `request.userId = 'default-user'` on every request via an `onRequest` hook. v1 hard-codes the value; when auth lands later, this single plugin is replaced — no service / repository / persistence rewrite.

## Health check observation (post Story 3.4)

```bash
# All health state transitions across services
docker compose logs --tail=200 | grep '"event":"health.'

# Just persistence flips
docker compose logs backend | grep 'health.persistence'

# Per-container health status (Docker's view, not the app's)
docker compose ps                      # shows healthy/unhealthy column
docker inspect --format='{{json .State.Health}}' bmad-todo-backend
```

(Story 1.4 `/api/health` always returns `{status:'healthy'}`. Story 3.4 will add persistence-aware probes + state-transition logging.)
