# bmad-todo

A local-first single-user todo app with a Fastify API, React frontend, shared Zod contracts, and PostgreSQL persistence, all runnable via Docker Compose.

[![CI](https://github.com/amanvr/bmad-todo/actions/workflows/ci.yml/badge.svg)](https://github.com/amanvr/bmad-todo/actions/workflows/ci.yml)

## What it is

`bmad-todo` is a production-shaped v1 reference app for a single-screen todo workflow. It demonstrates strict TypeScript workspace architecture, backend layering (controller/service/repository), and end-to-end quality gates (Vitest + Playwright + axe).

## Quick Start

```bash
# Prerequisites: Docker Engine 24+, Git, ~2GB free disk space.
git clone <repo-url> bmad-todo && cd bmad-todo
cp .env.example .env
docker compose -f docker-compose.yml up --wait
xdg-open http://localhost:8080
```

For development with hot-reload, run `docker compose up` (no `-f`) — `docker-compose.override.yml` swaps the frontend to Vite on `http://localhost:5173` and the backend to `tsx --watch`.

## Prerequisites

- Docker Engine 24+ (`docker --version`)
- Git
- Node.js LTS (for local non-container workflows; see `.nvmrc`)

## Environment variables

Copy `.env.example` to `.env` and adjust as needed:

| Var                 | Purpose                         | Example                                                             |
| ------------------- | ------------------------------- | ------------------------------------------------------------------- |
| `POSTGRES_USER`     | Postgres username               | `bmad_todo`                                                         |
| `POSTGRES_PASSWORD` | Postgres password               | `changeme_in_real_env`                                              |
| `POSTGRES_DB`       | Postgres database name          | `bmad_todo`                                                         |
| `DATABASE_URL`      | Backend Postgres connection URL | `postgres://bmad_todo:changeme_in_real_env@postgres:5432/bmad_todo` |
| `BACKEND_PORT`      | Backend internal port           | `3000`                                                              |
| `CORS_ORIGINS`      | Allowed browser origins         | `http://localhost:8080`                                             |
| `NODE_ENV`          | Runtime mode                    | `development`                                                       |
| `LOG_LEVEL`         | Backend logger level            | `info`                                                              |

## Common commands

```bash
# Stack
docker compose -f docker-compose.yml up --wait
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml down -v

# Workspace
npm ci
npm run lint
npm run format
npm run format:check
npm run typecheck
npm run test

# Per-package
npm test --workspace @bmad-todo/backend
npm test --workspace @bmad-todo/frontend
npm test --workspace @bmad-todo/e2e
```

## Project structure

Core workspaces:

- `apps/backend` — Fastify API, Drizzle ORM, PostgreSQL integration
- `apps/frontend` — React + Vite client, CSS modules
- `packages/shared` — shared Zod schemas/types for API contracts
- `e2e` — Playwright suite (flows, responsive, keyboard, accessibility)

See `_bmad-output/planning-artifacts/architecture.md` for the full boundary and layering model.

## Architectural overview

The backend enforces one-way layering (`controllers -> services -> repositories -> db`) with typed errors and centralized error mapping. The frontend uses feature folders (`features/todos`) with `useReducer` and pessimistic updates. Shared contracts live in `packages/shared` and are consumed by both apps.

## Fresh-machine first-run verification (NFR16 acceptance)

Run this on a machine that has never built this repo before and time each step:

1. Install Docker Engine (if missing).
2. `git clone <repo-url> bmad-todo && cd bmad-todo`
3. `cp .env.example .env`
4. `docker compose -f docker-compose.yml up --wait`
5. Open `http://localhost:8080` and verify the app loads.
6. Create one todo and verify it appears in the list.

Target elapsed time is **<= 15 minutes**. If exceeded, record the bottleneck step and open a project issue.

## Tests

- `npm run test` runs unit and component tests for `@bmad-todo/backend` and `@bmad-todo/frontend`. The `e2e` workspace is excluded — Playwright runs separately because it needs browsers installed and the Docker stack up.
- Backend integration tests against a real Postgres are opt-in. With the stack running, run `RUN_POSTGRES_TESTS=true npm run test:integration --workspace @bmad-todo/backend` (uses `TEST_DATABASE_URL` → `DATABASE_URL`).
- E2E: `docker compose -f docker-compose.yml up -d --wait` then `npm test --workspace @bmad-todo/e2e` (first run: `npm run test:install --workspace @bmad-todo/e2e`).
- NFR20 flow coverage includes create/list/complete/incomplete/delete Playwright specs.
- Accessibility is enforced by `e2e/tests/accessibility.spec.ts` (WCAG 2.2 Level A, zero violations).
- Coverage target is `>= 70%` on backend and frontend.

## Troubleshooting

- Port `8080` busy: stop conflicting stacks or adjust frontend port mapping in local compose override.
- `docker compose ... up` exits early: inspect logs via `docker compose logs <service>`.
- Todo mutations fail: check backend logs and `/api/health`.
- Integration tests fail or get skipped: they require `RUN_POSTGRES_TESTS=true` and a reachable Postgres at `TEST_DATABASE_URL` (defaults to `DATABASE_URL`); start the stack first with `docker compose -f docker-compose.yml up -d --wait`.
- Windows mount issues: use Docker Desktop with WSL2 backend and keep repo in the WSL filesystem.

## Per-package docs

- `apps/backend/README.md`
- `apps/frontend/README.md`
- `packages/shared/README.md`
- `e2e/README.md`

## License

<!-- TODO: add license -->

## Issues

Use your repository issue tracker for bugs, docs gaps, or first-run bottleneck reports.
