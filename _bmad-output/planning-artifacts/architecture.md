---
stepsCompleted:
  - step-01-init
  - step-02-context
  - step-03-starter
  - step-04-decisions
  - step-05-patterns
  - step-06-structure
  - step-07-validation
  - step-08-complete
status: complete
completedAt: '2026-04-27'
lastStep: 8
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/prd-validation-report.md
documentCounts:
  prd: 1
  brief: 1
  ux: 0
  research: 0
  projectDocs: 0
projectType: greenfield
workflowType: 'architecture'
project_name: 'bmad-todo'
user_name: 'Aman'
date: '2026-04-27'
---

# Architecture Decision Document — bmad-todo

**Author:** Aman
**Architect:** Winston (System Architect persona)
**Date:** 2026-04-27

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (23 FRs across 8 capability areas):**

The user-facing surface is intentionally minimal — CRUD on a single `todo` entity (text description, completion status, creation timestamp). The remaining FRs cover application-lifecycle states (empty / loading / error / retry per FR8–FR11), persistence guarantees against refresh and container restart (FR12–FR14), operational health observability (FR15, FR16), responsive layout at desktop ≥ 1024 px and mobile ≥ 360 px (FR17, FR18), keyboard- and assistive-tech accessibility consistent with WCAG 2.2 Level A (FR19, FR20), and configuration / deployment shape (env-var config, per-service Dockerfiles, single-command `docker compose up` — FR21–FR23). The full FR set is the binding capability contract; nothing outside it ships in v1.

**Non-Functional Requirements (23 NFRs across 7 categories):**

- **Performance:** qualitative-only ("perceived-instant under local Docker"). No numeric SLOs, no load-testing requirement.
- **Security:** baseline only — XSS-safe rendering, parameterized queries, no exposed secrets, no public persistence port. No auth, no compliance regime.
- **Accessibility:** WCAG 2.2 Level A, automated-scanner-verified, zero violations.
- **Reliability & Durability:** data survives container restart and backend service restart independent of persistence; backend crashes do not corrupt persistence (atomic or not-persisted writes).
- **Maintainability:** enforced lint / format, clear backend / frontend / persistence separation, README enabling first-run within 15 minutes on a Docker-installed machine.
- **Testability & Quality:** ≥ 70% meaningful coverage backend and frontend separately; ≥ 5 Playwright E2E tests covering the five core CRUD flows.
- **Portability:** runs identically on Linux / macOS / Windows hosts via Docker.

**Scale & Complexity:**

- **v1 functional complexity:** *low.* Single entity, single user, no auth, no real-time, no integrations.
- **v1 architectural complexity:** *medium-low.* The non-foreclosure obligations (multi-user / auth, per-todo metadata, real-time sync, audit log) shift this above pure-low because the architecture must demonstrate the path for each, even though none ships in v1.
- **Primary technical domain:** full-stack web app — React SPA + Fastify HTTP backend + persistence layer, all containerized and orchestrated locally via `docker compose`.
- **Estimated component count:** 3 deployable services (frontend, backend, persistence) plus a small set of internal modules per service.

### Technical Constraints & Dependencies

**Stakeholder-imposed (not up for re-litigation):**

- Backend runtime: Fastify (Node.js).
- Frontend framework: React.
- Deployment: local-only, Dockerized, env-driven config, single-command `docker compose up`, backend health endpoints.
- E2E framework: Playwright (≥ 5 tests, named flows).
- Code coverage: ≥ 70% backend and frontend separately.
- Accessibility: WCAG 2.2 Level A automated.
- Browser matrix: latest 2 stable Chrome / Firefox / Safari / Edge.
- Cross-OS host portability: Linux / macOS / Windows via Docker.

**Architect-owned (this document resolves):**

Persistence technology, API resource shape and versioning approach, module / package structure, frontend state management library, frontend build tooling, CSS approach, test runners, linter / formatter, container topology, and the non-foreclosure-extension contract for auth, per-todo metadata, real-time sync, and audit log.

**Partially deferred (this document raises but may not fully resolve):**

- *PRD Open Question 5 — E2E + CI integration path.* Playwright committed; CI provider and the trigger / gating / reporting model are open. Will surface as a decision for Aman within this workflow.

### Cross-Cutting Concerns Identified

- **The architectural-extension contract** (auth, per-todo metadata, real-time sync, audit log) — the single most consequential cross-cut for this engagement. Module boundaries, API shape, and persistence schema must each leave a clean seam for each capability without pre-building.
- **Error-response shape** — consistent backend error format that the React frontend can dispatch to its error states (FR10, NFR12) without per-endpoint special-casing.
- **Configuration via environment variables** — FR21 + NFR5 + NFR17. Touches every service boundary.
- **Health observability** — FR15, FR16. Cross-cuts backend ↔ persistence.
- **Cross-OS portability** — Docker handles most of it, but volume-mount semantics and line-ending defaults will need attention in Dockerfiles and any persistence-volume layout.
- **Test pyramid layout** — backend unit + frontend unit/component + E2E. Each surface needs a runnable invocation pattern that the CI integration (when defined) can hook into.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web app with split frontend / backend services and a persistence layer, all containerized for local Docker orchestration. Stack is partially constrained (Fastify backend + React frontend frozen by stakeholder); the architect-owned starter decisions cover language, build / test / lint tooling, repo layout, and styling approach.

### Starter Options Considered

The conventional combined-stack starters (Next.js, T3, RedwoodJS) were rejected up front because:

- **Next.js / T3:** Introduce server-rendering, file-based routing, and an opinionated framework boundary the PRD's *SEO Strategy: N/A* and single-screen surface do not earn. Rule-of-Three argues against framework features used zero times in v1.
- **RedwoodJS / Blitz:** Bundle GraphQL / Prisma / opinionated state management — moves architect-owned decisions into the framework, which is exactly the wrong direction for this engagement (PRD *Process Success* requires that constraints-vs-decisions boundary be respected).
- **Combined Fastify + React mono-templates** (community-maintained): inconsistent maintenance, opinionated layouts that obscure the non-foreclosure paths the architecture must demonstrate.

The chosen approach is **two boring scaffolds in a workspace-based monorepo**, hand-assembled rather than templated. This keeps each architectural decision visible in the repo rather than buried in a framework's defaults.

### Selected Starter: Two-Scaffold Workspace Monorepo

**Rationale for Selection:**

A monorepo with two service packages and one shared package gives us:

- Visible architectural seams (one folder = one decision domain).
- Co-evolution of the API contract via `packages/shared` types.
- Independent Dockerfile per service (FR22) without repository coordination cost.
- The ability to demonstrate the four non-foreclosure paths (auth, per-todo metadata, real-time sync, audit log) at the *layout* level, not just in prose.

**Initialization Commands** (to be pinned to current stable versions at scaffolding time — the dev team should run these against the latest published versions on the day they scaffold):

```bash
# Repo root
mkdir bmad-todo && cd bmad-todo
npm init -y                                 # workspace root
# Configure "workspaces": ["apps/*", "packages/*"] in root package.json

# Frontend service
npm create vite@latest apps/frontend -- --template react-ts

# Backend service (hand-rolled, no CLI scaffold)
mkdir -p apps/backend && cd apps/backend
npm init -y
npm install fastify
npm install -D typescript tsx @types/node vitest
# (plus the project's chosen ESLint + Prettier configs from the root)
cd ../..

# Shared types package
mkdir -p packages/shared && cd packages/shared
npm init -y
npm install -D typescript
cd ../..
```

### Architectural Decisions Provided by This Starter Posture

**Language & Runtime:**

- TypeScript across all three packages (`apps/backend`, `apps/frontend`, `packages/shared`).
- Node.js for backend runtime (Fastify constraint).
- Browser ESM for frontend (Vite default).
- *Rationale:* Maintainability (NFR14, NFR16) and the non-foreclosure type-safety win outweigh the learning-exercise overhead. TS makes the API contract enforceable across the wire.

**Repo Layout:**

```
bmad-todo/
├── apps/
│   ├── backend/           # Fastify HTTP service
│   └── frontend/          # Vite + React SPA
├── packages/
│   └── shared/            # API contract types (Todo, request / response shapes, error shape)
├── docker-compose.yml
├── .env.example
├── package.json           # workspaces root
└── README.md
```

- **`apps/backend`** — Fastify HTTP backend. Self-contained (own `package.json`, own Dockerfile).
- **`apps/frontend`** — React SPA built by Vite. Self-contained.
- **`packages/shared`** — TypeScript types only (no runtime code). Imported by both `apps/*`. The API contract lives here, which gives the non-foreclosure work a single place to evolve schemas (priority / due-date / tags fields, audit-event types, auth-related types) without touching service code unnecessarily.
- **Workspace tool:** npm workspaces is the default, low-ceremony option. pnpm workspaces is acceptable if the dev team prefers; the architecture is agnostic.

**Styling Solution:**

- Plain CSS modules (`*.module.css`). Scoped class names, no runtime cost, no design-system overhead.
- *Rationale:* "Doesn't look broken" UX bar (PRD). Tailwind / styled-components / vanilla-extract considered and rejected as Rule-of-Three abuse for a single-screen app.

**Build Tooling:**

- *Frontend:* Vite (HMR for dev, production build via `vite build`). Native ESM, fast cold start.
- *Backend:* `tsx` for dev hot-reload; `tsc` for production compilation in the Docker image. No bundler — Node 20+ runs compiled JS directly.
- *Shared:* `tsc --emitDeclarationOnly` to publish types; consumed by both services through workspace symlinks.

**Testing Framework:**

- *Unit / component / integration:* **Vitest** on both backend and frontend. Single tool, single config story; Jest-compatible API for familiarity.
- *E2E:* **Playwright** (stakeholder-locked). ≥ 5 tests across the five core CRUD flows (NFR20).
- *Accessibility:* `@axe-core/playwright` (or equivalent automated scanner) integrated into the E2E run for the WCAG 2.2 Level A check (NFR8).
- *Coverage reporting:* Vitest's built-in `--coverage` (V8 provider) for backend and frontend; thresholds set per `package.json` to enforce ≥ 70%.

**Linting & Formatting:**

- **ESLint + Prettier**, configured at the workspace root and inherited by all packages.
- ESLint with the recommended TypeScript ruleset; Prettier handles formatting; `eslint-config-prettier` integration to avoid rule conflicts.
- Enforced in the test pipeline (NFR14): `npm run lint` and `npm run format:check` are pre-test gates.

**Code Organization Patterns (established by the starter; refined in Step 4):**

- Backend follows a thin-controller / service / repository layering — controllers only handle HTTP concerns, services hold business logic, repositories isolate persistence behind an interface (the *core seam* for the persistence-choice deferral and for the audit-log non-foreclosure).
- Frontend follows a feature-folder layout under `src/features/todos/` rather than a type-folder layout (`components/`, `hooks/`, `services/`). The feature folder co-locates the UI, hooks, and API-call code for the single feature, which keeps the architectural seam clean if a future second feature is added.
- Shared types are organized by domain concept (`Todo`, `ApiError`, request / response per resource), not by service consumer.

**Development Experience:**

- `docker compose up` launches all three services with hot-reload available for backend (`tsx --watch`) and frontend (Vite HMR).
- Volume mounts for local source under WSL / macOS / Linux. Windows-host volume-mount semantics will be tested as part of NFR23 verification.
- `.env.example` checked in; `.env` gitignored.

**Note:** Project initialization using these commands should be the **first implementation story** in the epics-and-stories breakdown, with the workspace skeleton + Dockerfiles + `docker-compose.yml` skeleton as its acceptance criteria.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (block implementation):**

- Persistence technology and access layer.
- API resource shape and error format.
- Auth-readiness module-boundary seam (non-foreclosure obligation).
- Container topology (`docker-compose.yml` structure).

**Important Decisions (shape architecture):**

- Validation library and schema authoring location.
- Migration tooling.
- Frontend data-fetching pattern.
- Security middleware (CORS, headers).
- OpenAPI documentation generation.
- Developer documentation layout.

**Deferred Decisions (raised but not committed in v1):**

- Caching strategy (none in v1; documented seam in the repository layer if needed later).
- Rate limiting (none in v1).
- APM / structured-logging aggregator beyond Fastify defaults.

### Data Architecture

**Persistence technology: PostgreSQL 16+ (in a sidecar container).**

- **Decision:** PostgreSQL in a `postgres` service container, persistence-volume mounted into the data directory, port not exposed to host (only reachable from the `backend` container — NFR6).
- **Rationale:**
  - NFR10–NFR13 require crash-safe, atomic, restart-surviving persistence. PostgreSQL gives this with no additional engineering.
  - Three of the four non-foreclosure capabilities (multi-user / auth, audit log, real-time sync via LISTEN/NOTIFY or logical replication) are materially easier on a real RDBMS.
  - Cross-OS host portability (NFR23) is cleaner with a containerized DB than a SQLite file mounted across hosts (Windows volume-mount semantics get flaky with heavy file locking).
  - Boring technology.
- **Alternative considered — SQLite file in Docker volume:** Simpler for v1 (zero extra service), meets NFR13 with WAL mode, but the non-foreclosure story is weaker and cross-OS volume-mount semantics are riskier. Rejected.
- **Alternative considered — JSON file with periodic write:** Fails NFR13 (no atomic writes for crash recovery). Rejected.

**Data modeling approach: minimal v1 schema with explicit non-foreclosure column conventions.**

v1 schema:

```sql
CREATE TABLE todos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description   TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 500),
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id       TEXT NOT NULL DEFAULT 'default-user'
);

CREATE INDEX todos_user_id_idx ON todos (user_id);
CREATE INDEX todos_created_at_idx ON todos (created_at);
```

- **`user_id` column from day one** (with default `'default-user'`) — the non-foreclosure seam for multi-user / auth. v1 reads/writes always use `'default-user'`; auth replaces the default with a real user identity without schema migration.
- **`updated_at`** — non-foreclosure seam for audit log (cheap to capture; existing `updated_at` is the change-detection anchor).
- **`UUID` primary keys** — non-foreclosure seam for real-time sync (UUIDs collide-safely across clients; integer IDs would fight a future LISTEN/NOTIFY pattern).
- **Per-todo metadata extension path:** new nullable columns added later (`priority INT`, `due_date DATE`, `tags JSONB`). No schema rewrite required.

**Validation library: Zod schemas in `packages/shared`, applied via `@fastify/type-provider-zod` on the backend and reused on the frontend.**

- **Decision:** Zod for runtime validation; schemas authored once in `packages/shared`; backend validates inbound requests via Fastify's type provider; frontend uses the same Zod schemas to type API responses (and optionally validate response shape in dev).
- **Rationale:** Single source of truth for the API contract — exactly the seam `packages/shared` was created to hold. Adding fields for non-foreclosure (priority, due_date) is one schema edit, type-checked across both services.
- **Alternative considered — Fastify-native JSON Schema (Ajv):** Fastify's first-class option; faster at runtime; but verbose to author and harder to share with TS frontend types. Rejected on developer-experience grounds (NFR16, NFR14).
- **Alternative considered — Typebox:** Equivalent ergonomics; rejected only because Zod is more familiar to React developers and the asymmetry is irrelevant for v1.

**Migration tooling: Drizzle ORM + Drizzle Kit.**

- **Decision:** Drizzle ORM as the query layer; `drizzle-kit generate` for migrations; migrations applied at backend container startup (or via a dedicated `migrate` script).
- **Rationale:** Schema-as-TS-code matches the TS-first stance; type-safe queries propagate into services and controllers; SQL-first philosophy (no codegen-driven black box like Prisma); migration story is explicit and reviewable.
- **Alternative considered — raw `pg` driver + hand-written SQL migrations:** Maximally explicit; rejected because it sacrifices type-safety on queries (a real maintainability win for non-foreclosure).
- **Alternative considered — Prisma:** Codegen-heavy, slower, opinionated; rejected as too much framework for a small app.
- **Alternative considered — Kysely:** Solid type-safe query builder, no migrations; rejected because pairing it with a separate migration tool adds glue for no gain over Drizzle.

**Caching strategy: none in v1.** Single-user local app with a one-table schema. *Non-foreclosure note:* the repository layer is the natural place to add a cache without controller / service changes.

### Authentication & Security

**Authentication: none in v1; module-boundary seam pre-baked for future addition.**

- **Decision:** v1 ships without any login flow, session, or token. Backend treats every request as belonging to the default user.
- **Auth-readiness seam:** every service-layer call is parameterized by a `userId: string`. In v1, the controller layer hard-codes `'default-user'`. When auth lands, a Fastify auth plugin populates `request.userId` from a session/JWT/whatever, the controller reads `request.userId` instead of the constant, and **no service / repository / persistence code changes.**
- **Rationale:** The cheapest possible non-foreclosure for the auth/multi-user capability — *one line per controller* changes when auth is added, instead of a refactor through every layer.

**CORS: `@fastify/cors`, origin allow-list driven by env var.**

- `CORS_ORIGINS=http://localhost:5173` (dev) configurable per environment.
- Required because frontend (Vite dev server or nginx-served build) and backend run on different origins.

**Security headers: `@fastify/helmet` with default settings.**

- Boring default. Sets sensible CSP, HSTS, X-Content-Type-Options, etc.
- *Note:* CSP may need a `connect-src` allowance for the backend origin in non-default deployments. Default config covers v1.

**Output encoding: React's default text rendering (no `dangerouslySetInnerHTML`).** React escapes text content by default — satisfies NFR3 (no XSS).

**Input sanitization:** Zod schema length/type constraints + parameterized queries via Drizzle. Zod constrains `description` to 1–500 chars (matches the `CHECK` constraint in the DB). Drizzle parameterizes all queries — satisfies NFR7 (no SQL injection).

**Rate limiting: none in v1.** Single-user local-only deployment makes rate limiting noise. *Non-foreclosure note:* `@fastify/rate-limit` is a single-plugin add when needed.

### API & Communication Patterns

**API style: REST/HTTP/JSON.** (Stakeholder-locked.)

**Resource shape:**

| Method | Path | Purpose | Request body | Response |
|---|---|---|---|---|
| `GET` | `/api/todos` | List all todos | — | `Todo[]` ordered by `created_at DESC` |
| `POST` | `/api/todos` | Create todo | `{ description: string }` | `Todo` (201) |
| `PATCH` | `/api/todos/:id` | Update completion state | `{ completed: boolean }` | `Todo` (200) or 404 |
| `DELETE` | `/api/todos/:id` | Delete todo | — | 204 or 404 |
| `GET` | `/api/health` | Health check (FR15, FR16) | — | `{ status: 'healthy' \| 'unhealthy', persistence: 'up' \| 'down' }` |

- `PATCH` rather than `PUT` — partial update on `completed` only; doesn't require client to send the full resource.
- All resources under `/api/` prefix — leaves a versioning seam (`/api/v1/...` if ever needed) without committing to one now.
- **No update of `description` in v1.** Editing existing todo text is not in the FR contract; if added later, it's a new field on the PATCH body.

**Error response shape: consistent JSON across all endpoints.**

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "description must be between 1 and 500 characters",
    "details": { "field": "description" }
  }
}
```

- HTTP status families: `4xx` for client errors (validation, not-found), `5xx` for server errors (persistence-down, unhandled). Maps directly to the FR10 / NFR12 frontend dispatcher.
- Codes enumerated in `packages/shared/errors.ts`: `VALIDATION_FAILED`, `NOT_FOUND`, `INTERNAL_ERROR`, `PERSISTENCE_UNAVAILABLE`.

**API documentation: `@fastify/swagger` + `@fastify/swagger-ui`, served at `/docs` in development.**

- OpenAPI 3.x generated from Fastify routes (Zod schemas auto-converted via `@fastify/type-provider-zod`'s OpenAPI bridge).
- Available only when `NODE_ENV=development`.
- Cheap to wire up; useful for the dev team and for any future external API consumer (a non-foreclosure win).

**Service-to-service communication:** N/A — no internal services. Browser-to-backend HTTP is the only communication channel.

### Frontend Architecture

**State management: React state + context.** (Already decided in Step 3.)

**Component architecture:**

```
apps/frontend/src/
├── App.tsx                          # root component; renders <TodoFeature />
├── main.tsx                         # Vite entry point
├── features/
│   └── todos/
│       ├── TodoFeature.tsx          # screen-level orchestration
│       ├── TodoList.tsx             # renders [TodoItem]
│       ├── TodoItem.tsx             # single todo row, with toggle + delete
│       ├── AddTodoForm.tsx          # input + submit
│       ├── EmptyState.tsx           # FR8
│       ├── LoadingState.tsx         # FR9
│       ├── ErrorState.tsx           # FR10
│       ├── useTodos.ts              # custom hook: fetch / mutate / cache
│       ├── api.ts                   # fetch wrappers; uses shared Zod schemas
│       └── todos.module.css         # CSS-modules styling
├── shared/
│   ├── http.ts                      # generic fetch wrapper, error normalization
│   └── ErrorBoundary.tsx            # last-resort error catcher
└── styles/
    └── globals.css                  # base typography, layout reset
```

**Data-fetching pattern: custom hook (`useTodos`) using React's `useState` + `useEffect` + `useReducer` for the local cache.**

- v1: fetch on mount; **pessimistic** updates on mutation (wait for server confirmation before updating UI). Simpler error story than optimistic UI.
- *Non-foreclosure note for real-time sync:* if real-time lands later, swap `useTodos` internals for `@tanstack/react-query` + a WebSocket / SSE subscription. The hook contract stays the same; consumers don't change.

**Routing: none.** Single-screen app. If a second screen is added later, `react-router-dom` slots in cleanly at `App.tsx`.

**Performance optimization: none beyond Vite defaults.** Vite handles code-splitting, tree-shaking, asset hashing, source-map generation automatically.

**Bundle-size budget: none committed.** (Per PRD.)

### Infrastructure & Deployment

**Container topology — three services orchestrated by `docker-compose.yml`:**

```
+-------------+        +-------------+        +--------------+
|  frontend   |  HTTP  |   backend   |  PG    |   postgres   |
|  (nginx /   +------->+  (Fastify)  +------->+  (sidecar)   |
|   Vite dev) |        |             |        |              |
+-------------+        +-------------+        +--------------+
       |                       |                      |
   :8080 (host)            :3000 (internal)       :5432 (internal)
   exposed                NOT exposed            NOT exposed
```

- Only the frontend port (`:8080`) is exposed to the host — the user's browser hits `localhost:8080`. Backend and persistence are reachable only on the internal Docker network (NFR6).
- *Production frontend container:* nginx serves static assets built by `vite build`; nginx config rewrites `/api/*` requests to the backend service. (Multi-stage Dockerfile with a `node:lts` builder + `nginx:alpine` final image.)
- *Development override:* `docker-compose.override.yml` swaps the frontend container to a Vite dev server with HMR; backend container runs `tsx --watch`.

**Environment configuration:**

- Single `.env.example` checked in at repo root listing all required keys; `.env` gitignored.
- Keys (v1): `BACKEND_PORT`, `DATABASE_URL`, `CORS_ORIGINS`, `NODE_ENV`, `LOG_LEVEL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
- `docker-compose.yml` uses `${VAR}` interpolation; service `environment:` blocks pass through to container processes.
- Satisfies FR21, NFR5, NFR17.

**Logging:**

- Backend: Fastify's built-in pino logger to stdout, JSON format. Captured by Docker.
- Log level via `LOG_LEVEL` env var (`info` default in dev, `warn` in production).
- No structured-logging-aggregator in v1 (no APM, no Loki, no ELK).

**Health endpoints:**

- `GET /api/health` returns `{ status: 'healthy' | 'unhealthy', persistence: 'up' | 'down' }`.
- Backend tests persistence by issuing `SELECT 1` against Postgres on each health request.
- Docker `HEALTHCHECK` directives in both backend and postgres Dockerfiles, used for `docker compose up --wait` semantics. Specifics in *Health Checks & Health-Check Logging* below.

**Health Checks & Health-Check Logging**

*Container-level `HEALTHCHECK` directives:*

Backend Dockerfile:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
```

Postgres healthcheck (declared in `docker-compose.yml` so the official `postgres` image stays untouched):

```yaml
postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
    interval: 10s
    timeout: 3s
    retries: 5
    start_period: 5s
```

Backend's `depends_on:` declaration uses `condition: service_healthy` against the postgres service, so `docker compose up --wait` blocks until Postgres is actually ready, not just started.

*Health-probe logging discipline:*

The default Fastify request-logger would emit one `info` line per `/api/health` probe — that's 2 lines / minute from Docker plus whatever else probes. In `docker compose logs` this drowns the actual application traffic. The discipline:

- The `/api/health` route is registered on a Fastify scope with logging **muted at `info` level** for successful probes — only `warn` and `error` propagate. Implementation: `fastify.register(healthRoutes, { logLevel: 'warn' })`.
- The healthcheck handler emits a structured **state-transition log line** only when the persistence status flips:
  - `info`: `{ event: 'health.persistence.up', previous: 'down' }` on a down → up transition.
  - `warn`: `{ event: 'health.persistence.down', previous: 'up', error: <msg> }` on an up → down transition.
  - No log on steady-state probes.
- State is held in-memory per backend process (a single boolean `lastPersistenceUp`). Process restart resets it — first probe after restart logs the initial state at `info`.

*Reading health state from `docker compose logs`:*

```bash
# All health state transitions across services
docker compose logs --tail=200 | grep '"event":"health.'

# Just persistence flips
docker compose logs backend | grep 'health.persistence'

# Per-container health status (Docker's view, not the app's)
docker compose ps                      # shows healthy/unhealthy column
docker inspect --format='{{json .State.Health}}' bmad-todo-backend
```

*Liveness vs readiness:*

v1 ships with a single `/api/health` endpoint that conflates liveness ("backend process responsive") and readiness ("backend can serve real traffic, persistence reachable"). This is acceptable for a single-process local-only deployment. *Non-foreclosure note:* splitting into `/api/health/live` and `/api/health/ready` is a routine extension when the deployment topology grows beyond local Docker; the current `healthController.ts` shape supports the split with no service / repository changes.

**CI / CD: GitHub Actions.**

- Workflow `.github/workflows/ci.yml`. Triggers: pull requests + pushes to `main`.
- Pipeline stages: `lint` (ESLint + Prettier check) → `test` (Vitest with coverage thresholds enforced ≥ 70%) → `build` (Docker images for both services) → `e2e` (Playwright in headless container with axe-core integration).
- E2E job spins up the docker-compose stack, waits for healthchecks, runs Playwright, archives the HTML report.
- No deployment job — local-only deployment per PRD.
- *Resolves PRD Open Question 5.*

**Backend integration-test strategy:**

- Tests run against the docker-compose Postgres service (option `(a)` from architect / Aman selection).
- Test setup: `docker compose up postgres -d` before running Vitest; tests connect via the same `DATABASE_URL` as the backend, but to a separate test database (`bmad_todo_test`) that's truncated between test files.
- *Alternative rejected — Testcontainers:* spawn ephemeral Postgres per run. Cleaner isolation but heavier startup; the simplicity of `(a)` outweighs the isolation benefit at this scale.

**Monitoring / observability beyond logs and health:** none in v1. (PRD: *"Out of scope as success metrics: ... analytics, uptime SLOs"*.)

### Developer Documentation

NFR16 commits to a root README enabling first-run within 15 minutes. For a workspace monorepo with three packages, that's under-specified — a layered README structure makes the seams discoverable.

| Location | Purpose | Audience |
|---|---|---|
| `README.md` (repo root) | The 15-minute-to-`docker compose up` README. Quick start, prerequisites (Docker version, OS notes), env-var reference, `docker compose` commands, test commands, troubleshooting. **Required by NFR16.** | Anyone cloning the repo for the first time. |
| `apps/backend/README.md` | Backend-only context: route list, error codes, how to run dev mode without Docker, how to add a Drizzle migration, link to the OpenAPI UI at `/docs`. | Devs working on the backend. |
| `apps/frontend/README.md` | Frontend-only context: how to point the dev server at a local-vs-Dockerized backend, component structure, accessibility-testing notes. | Devs working on the frontend. |
| `packages/shared/README.md` | What lives here (Zod schemas, error codes, shared types) and the editing rule (*"if you change anything here, both apps may need to react — run all tests"*). | Anyone touching the API contract. |
| `docs/architecture.md` (this document) | The architectural decision record. **Source of truth for the why.** | Onboarding devs, future architecture work. |
| `docs/adr/` *(optional, deferred)* | Architectural Decision Records for *future* changes. ADRs would document deviations from this baseline. | Anyone making architectural changes post-v1. |

The root `README.md` and the three per-package READMEs are **required deliverables** as part of v1; the `docs/adr/` directory is optional and deferred.

### Decision Impact Analysis

**Implementation sequence (feeds the epics-and-stories breakdown):**

1. Workspace skeleton — `apps/backend`, `apps/frontend`, `packages/shared`, root tooling (ESLint, Prettier, TypeScript, Vitest config), `.env.example`, root README scaffold.
2. Container topology — `Dockerfile`s for both services, `docker-compose.yml`, healthchecks, `docker-compose.override.yml` for dev.
3. Persistence layer — Postgres container, Drizzle schema, initial migration, health-check `SELECT 1`.
4. Backend API — repository / service / controller layering for Todo, all five endpoints, error-shape middleware, Zod validation, OpenAPI generation.
5. Backend tests — unit (services), integration (against running Postgres), Vitest coverage configured to ≥ 70%.
6. Frontend feature — `useTodos` hook, components for list / item / form, empty / loading / error states, CSS modules.
7. Frontend tests — component-level via Vitest + Testing Library, ≥ 70% coverage.
8. E2E — Playwright suite covering create / list / complete / incomplete / delete (NFR20), `@axe-core/playwright` integration for WCAG Level A (NFR8).
9. CI integration — GitHub Actions workflow.
10. Documentation finalization — root README + per-package READMEs satisfying NFR16.

**Cross-component dependencies:**

- `packages/shared` blocks both apps — must scaffold first or in parallel with empty stubs.
- Postgres + Drizzle migrations block backend integration tests — backend integration tests need a running DB via the docker-compose Postgres service.
- Frontend can stub the API while backend is in flight — `useTodos`'s `api.ts` module is the swap point.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical conflict points identified and resolved:** 18 — covering naming, structure, format, communication, and process. Most are codifications of decisions made in Step 4; the remainder are explicit conventions added here.

### Naming Patterns

**Database Naming (Postgres conventions):**

- Table names: `snake_case`, **plural**. Examples: `todos`, future `users`, future `audit_events`.
- Column names: `snake_case`. Examples: `created_at`, `user_id`, `is_completed`.
- Primary key: always `id` (UUID).
- Foreign keys: `<referenced_table_singular>_id`. Example: `user_id` (references `users.id`).
- Indexes: `<table>_<column(s)>_idx`. Example: `todos_created_at_idx`.
- Timestamps: every table has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and (where mutable) `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**API Naming (REST conventions):**

- Resources: **plural**, `kebab-case` (single-word `todos` is fine). Path: `/api/todos`, `/api/todos/:id`.
- Path parameters: `:paramName` (Fastify default). Camel-case in code: `:id`, `:userId`.
- Query parameters: `camelCase`. Example: `?createdAfter=2026-01-01`.
- Response field naming: **`camelCase` across the wire** (e.g. `createdAt`, `userId`). Drizzle column-name aliases bridge the snake_case-DB ↔ camelCase-JSON gap; controllers never see snake_case.
- HTTP methods: `GET` list/read, `POST` create, `PATCH` partial update, `DELETE` remove. **No `PUT`** in this API.
- Custom HTTP headers (none in v1): if added, `X-` prefix is **discouraged** per RFC 6648 — use the hyphenated unprefixed form (`Request-Id`).

**Code Naming (TypeScript conventions):**

- Variables, functions, parameters: `camelCase`.
- React components: `PascalCase`. Example: `TodoList`, `AddTodoForm`.
- Custom hooks: `camelCase` starting with `use`. Example: `useTodos`.
- Types and interfaces: `PascalCase`. Example: `Todo`, `CreateTodoInput`, `ApiError`.
- Type aliases vs interfaces: prefer **`type`** for object shapes; reserve `interface` for declaration-merging cases (rare here).
- Constants: `SCREAMING_SNAKE_CASE` only for true module-level immutables. Otherwise `camelCase`.
- Booleans: prefix with `is`, `has`, `can`, or `should`. Example: `isLoading`, `hasError`, `canRetry`.
- Enum-like unions: prefer string-literal unions over `enum`. Example: `type ErrorCode = 'VALIDATION_FAILED' | 'NOT_FOUND' | 'INTERNAL_ERROR' | 'PERSISTENCE_UNAVAILABLE'`.

**File Naming:**

- React components: `PascalCase.tsx`. Example: `TodoList.tsx`.
- Hooks: `camelCase.ts` starting with `use`. Example: `useTodos.ts`.
- Utility / non-component modules: `camelCase.ts`. Example: `http.ts`, `api.ts`.
- Test files: co-located, same basename + `.test.ts(x)`. Example: `useTodos.test.ts`, `TodoItem.test.tsx`.
- CSS modules: same basename + `.module.css`. Example: `TodoItem.module.css`.
- Drizzle schema: `apps/backend/src/db/schema.ts` (single file in v1; can split per-table when there are 3+ tables).
- Migrations: `apps/backend/drizzle/<timestamp>_<description>.sql` — generated by `drizzle-kit`.

### Structure Patterns

**Project Organization (already established in Step 3 / 4 — codified here):**

- **Feature-folder layout** for frontend (`apps/frontend/src/features/<feature>/`). One folder = one user-facing feature.
- **Layered layout** for backend (`apps/backend/src/{controllers,services,repositories,db}/`). Layers strictly one-way: controllers → services → repositories → db.
- **Shared cross-package types** in `packages/shared/`. No runtime code, just Zod schemas and inferred types.
- **Tests co-located with source** for unit/component tests. Integration tests in `apps/backend/tests/integration/`. E2E in `e2e/` at repo root.

**Layer Boundaries (backend):**

- **Controllers** (`apps/backend/src/controllers/*.ts`): HTTP-only concerns. Route registration, request parsing/validation via Zod, response shaping, error mapping. *No business logic.*
- **Services** (`apps/backend/src/services/*.ts`): Business logic. Operate on domain types from `packages/shared`. *No HTTP awareness, no SQL.*
- **Repositories** (`apps/backend/src/repositories/*.ts`): Persistence-only. Drizzle queries hidden behind a typed interface (`TodoRepository`). *No business logic.*
- **`db/` directory**: Drizzle schema, migration runner, connection pool initialization.
- The repository interface is the **non-foreclosure seam for caching, audit-log capture, and (later) real-time notification triggers** — it's the natural single point of interception.

**Frontend Component Boundaries:**

- **Feature components** (`features/todos/*.tsx`): UI + interaction logic specific to the feature. Consume the `useTodos` hook for data.
- **`useTodos` hook**: data-fetching + local cache. *Components never call `fetch` directly.*
- **`api.ts`**: thin wrapper over `fetch`, handles URL construction, JSON parsing, error normalization. *Only `useTodos` calls it.*
- **`shared/http.ts`**: even-thinner generic fetch wrapper. *Only `api.ts` calls it.*
- **`shared/ErrorBoundary.tsx`**: last-resort React error boundary; wraps `<App>` in `main.tsx`.

### Format Patterns

**API Response Formats:**

- Success: **direct response body** (no envelope). `GET /api/todos` returns `Todo[]`, not `{ data: Todo[] }`.
- Error: **always** the `{ error: { code, message, details? } }` envelope (decided in Step 4).
- Status codes:
  - `200` for successful read/update.
  - `201` for successful create (returns the created entity).
  - `204` for successful delete (no body).
  - `400` for validation failure (`code: VALIDATION_FAILED`).
  - `404` for not-found (`code: NOT_FOUND`).
  - `500` for unhandled server errors (`code: INTERNAL_ERROR`).
  - `503` for persistence-down (`code: PERSISTENCE_UNAVAILABLE`).
- No pagination in v1 (small dataset). *Non-foreclosure note:* if added, use cursor-based pagination with a `cursor` query param and `nextCursor` in response — not offset/limit.

**Data Format Rules:**

- JSON field naming: `camelCase` across the wire (already stated; reinforced here).
- Date/time: **ISO-8601 strings** (RFC 3339), always UTC, with timezone suffix. Example: `"2026-04-27T13:54:06Z"`.
- Booleans: `true` / `false`. Never `0` / `1` or `"true"` / `"false"`.
- Identifiers: UUID strings, lowercase, hyphenated (the canonical form). Example: `"550e8400-e29b-41d4-a716-446655440000"`.
- Optional / missing values: **omit the field** rather than emit `null`. Frontend treats absent fields as undefined. *Exception:* explicit nullable columns (none in v1) may emit `null`.
- Empty collections: emit `[]`, never omit and never emit `null`.

### Communication Patterns

**Event Systems:** none in v1.

- *Non-foreclosure note:* the audit-log capability lands as either (a) database-trigger-driven events written to an `audit_events` table, or (b) repository-layer interception writing audit rows transactionally. Either path lives behind the repository interface — services and controllers stay agnostic.

**State Management Patterns (frontend):**

- **Immutable updates only.** All state transitions produce new objects/arrays — `useReducer` actions never mutate.
- **Action naming:** past-tense verbs describing what happened. Examples: `todoCreated`, `todoCompleted`, `todoDeleted`, `todosLoaded`, `loadingFailed`. *Not* command-style (`createTodo`, `deleteTodo`).
- **State shape:** `{ todos: Todo[], status: 'idle' | 'loading' | 'loaded' | 'error', error: ApiError | null }`. The `status` field is the single source of truth for which lifecycle component renders.
- **No global state library.** Per-feature local state via `useReducer` in the feature's hook (`useTodos`). If a second feature ever needs to share state with todos, lift to React Context — *not* a state library.

### Process Patterns

**Error Handling (backend):**

- **Typed error classes** in `apps/backend/src/errors.ts`: `ValidationError`, `NotFoundError`, `InternalError`, `PersistenceUnavailableError`. All extend a common `AppError` base with a `code` and `httpStatus` property.
- Services throw typed errors; **never** return error objects, never use null-as-error.
- Single Fastify `setErrorHandler` maps `AppError` → response envelope. Unhandled non-`AppError` exceptions become `InternalError` (logged at `error` level, response stripped of stack).
- Validation errors (Zod) are caught by `@fastify/type-provider-zod` and converted to `ValidationError` automatically.
- *Logging discipline:* `4xx` errors logged at `info`; `5xx` errors logged at `error`; validation failures at `debug`.

**Error Handling (frontend):**

- `shared/http.ts` parses non-2xx responses into a typed `ApiError` (matches `packages/shared/errors.ts`). Network failures and JSON-parse failures also map to `ApiError` with `code: 'INTERNAL_ERROR'` for consistent downstream handling.
- `useTodos` exposes `{ status, error }`; components decide what to render based on `status`.
- `<ErrorState>` shows a user-readable message (`error.message`) and a retry button. *Never* render `error.code` to the user; codes are for log/test inspection only.
- `<ErrorBoundary>` catches React render errors only — *not* a substitute for `useTodos`'s error state.

**Loading States:**

- **Per-feature, local** to the hook that fetches (`useTodos`). No global loading store.
- Naming: `status: 'idle' | 'loading' | 'loaded' | 'error'` for the initial fetch; `isMutating: boolean` for in-flight create/update/delete.
- During `isMutating`, the list remains rendered (pessimistic update — no optimistic insertion). The action button shows a spinner / disabled state; the list does not show a global spinner.
- **No skeleton screens** in v1 — the "doesn't look broken" UX bar is met by a simple "Loading…" text or spinner. Skeleton UI is over-engineering for v1.

**Retry Patterns:**

- Manual retry only. `<ErrorState>` exposes a "Try again" button that re-invokes the failed operation.
- **No automatic retries** on the frontend in v1 (would mask transient failures and complicate test assertions).
- Backend: no retry logic (single-process Fastify, no upstream services to retry against). Database connection retries are handled by the `pg` driver's built-in pool reconnection.

**Validation Timing:**

- **Client-side validation:** lightweight checks for immediate feedback (e.g., disable submit when input empty). Reuses the same Zod schemas from `packages/shared` for type checks.
- **Server-side validation:** authoritative. Same Zod schemas applied via `@fastify/type-provider-zod`.
- Client never trusts client-side validation as a security boundary — server validation is always the gate.

### Enforcement Guidelines

**All AI Agents and devs MUST:**

- Use the file-naming, code-naming, and DB-naming conventions above without deviation.
- Follow the layered backend boundaries (controllers / services / repositories / db) — no shortcuts that skip a layer.
- Throw typed errors from services; never return error objects or use null-as-error.
- Write tests in the same package as the code under test, co-located.
- Author API contract changes (Zod schemas) in `packages/shared/` first, then update both apps.
- Run `npm run lint && npm run format:check && npm run test` before opening a PR.

**Pattern Enforcement Mechanisms:**

- **ESLint** catches naming violations (configurable via `@typescript-eslint/naming-convention`), unused imports, banned patterns.
- **Prettier** removes formatting drift mechanically.
- **TypeScript strict mode** (`strict: true`, `noUncheckedIndexedAccess: true`) catches type-shape violations at build time.
- **Vitest coverage thresholds** in `package.json` (≥ 70% backend, ≥ 70% frontend) fail CI on drop.
- **Code review** is the backstop for layering violations and pattern smells the linters can't catch.

**Pattern Update Process:**

- Material changes to these patterns are **architectural changes** and should be recorded in `docs/adr/` (or appended to this architecture doc with a dated revision).
- Drift discovered during implementation should be raised via `bmad-correct-course`, not silently accommodated.

### Pattern Examples

**Good Examples:**

```typescript
// Repository (apps/backend/src/repositories/todoRepository.ts)
export interface TodoRepository {
  list(userId: string): Promise<Todo[]>;
  create(input: CreateTodoInput, userId: string): Promise<Todo>;
  setCompleted(id: string, completed: boolean, userId: string): Promise<Todo>;
  delete(id: string, userId: string): Promise<void>;
}

// Service (apps/backend/src/services/todoService.ts)
export class TodoService {
  constructor(private readonly repo: TodoRepository) {}
  async createTodo(input: CreateTodoInput, userId: string): Promise<Todo> {
    return this.repo.create(input, userId);
  }
}

// Controller (apps/backend/src/controllers/todoController.ts)
fastify.post(
  '/api/todos',
  { schema: { body: CreateTodoInputSchema, response: { 201: TodoSchema } } },
  async (request, reply) => {
    const todo = await todoService.createTodo(request.body, request.userId);
    return reply.code(201).send(todo);
  }
);
```

```typescript
// Frontend hook (apps/frontend/src/features/todos/useTodos.ts)
export function useTodos() {
  const [state, dispatch] = useReducer(todosReducer, initialState);
  // ... fetch, mutate; expose { todos, status, error, isMutating, actions }
}
```

**Anti-Patterns (do not do):**

- ❌ Controller calling Drizzle directly: `fastify.get('/api/todos', () => db.select().from(todos))`. *Skips the service and repository layers.*
- ❌ Component fetching directly: `useEffect(() => { fetch('/api/todos').then(...) }, [])`. *Skips `useTodos` and `api.ts`.*
- ❌ Returning errors instead of throwing: `if (!found) return { error: 'not found' }`. *Use `throw new NotFoundError(...)`.*
- ❌ snake_case in API JSON: `{ "created_at": "..." }`. *Use `createdAt`.*
- ❌ Mutating React state: `state.todos.push(newTodo)`. *Always produce new arrays.*
- ❌ Optimistic update in v1: showing a todo as added before the server confirms. *Pessimistic only.*
- ❌ Adding a global Redux/Zustand store for one feature's state. *useReducer + Context if anything.*

## Project Structure & Boundaries

### Complete Project Directory Structure

```
bmad-todo/
├── README.md                                    # NFR16 root README — clone-to-`docker compose up` in 15 min
├── package.json                                 # workspace root (npm workspaces)
├── package-lock.json
├── tsconfig.base.json                           # shared TS compiler options, strict mode
├── eslint.config.js                             # ESLint 9+ flat config, root-level
├── .prettierrc.json
├── .prettierignore
├── .editorconfig
├── .nvmrc                                       # Node LTS pin
├── .gitignore
├── .env.example
├── docker-compose.yml                           # production-mode topology
├── docker-compose.override.yml                  # dev overrides: HMR, tsx --watch, Vite dev server
│
├── .github/
│   └── workflows/
│       └── ci.yml                               # GHA pipeline: lint → test → build → e2e
│
├── docs/
│   ├── architecture.md                          # this document, after BMad finalization
│   ├── prd.md                                   # carried over from planning artifacts
│   ├── product-brief.md                         # carried over from planning artifacts
│   └── adr/                                     # optional / deferred — future architecture changes
│
├── apps/
│   ├── backend/
│   │   ├── README.md                            # backend-specific dev docs
│   │   ├── package.json
│   │   ├── tsconfig.json                        # extends ../../tsconfig.base.json
│   │   ├── Dockerfile                           # multi-stage: builder (node:lts) → runtime (node:lts-slim)
│   │   ├── drizzle.config.ts                    # drizzle-kit configuration
│   │   ├── drizzle/                             # generated SQL migrations (committed)
│   │   │   └── <timestamp>_init.sql
│   │   ├── src/
│   │   │   ├── server.ts                        # entry; calls buildApp(), .listen()
│   │   │   ├── app.ts                           # buildApp(): registers plugins, routes; testable
│   │   │   ├── config.ts                        # env-var loader, Zod-validated
│   │   │   ├── errors.ts                        # AppError + subclasses (ValidationError, NotFoundError, …)
│   │   │   ├── logger.ts                        # pino configuration
│   │   │   ├── plugins/
│   │   │   │   ├── cors.ts                      # @fastify/cors
│   │   │   │   ├── helmet.ts                    # @fastify/helmet
│   │   │   │   ├── swagger.ts                   # @fastify/swagger + swagger-ui (dev only)
│   │   │   │   ├── userContext.ts               # auth-readiness seam — stamps request.userId='default-user'
│   │   │   │   └── errorHandler.ts              # setErrorHandler: AppError → JSON envelope
│   │   │   ├── controllers/
│   │   │   │   ├── todoController.ts            # FR1–FR5 routes
│   │   │   │   └── healthController.ts          # FR15, FR16 (registered with logLevel: 'warn')
│   │   │   ├── services/
│   │   │   │   └── todoService.ts               # business logic
│   │   │   ├── repositories/
│   │   │   │   ├── todoRepository.ts            # interface (the non-foreclosure seam)
│   │   │   │   └── postgresTodoRepository.ts    # Drizzle-backed implementation
│   │   │   └── db/
│   │   │       ├── client.ts                    # pg pool + Drizzle instance (singleton); SELECT 1 probe
│   │   │       ├── schema.ts                    # Drizzle schema (todos table)
│   │   │       └── migrate.ts                   # applies pending migrations on startup
│   │   └── tests/
│   │       └── integration/
│   │           ├── todos.test.ts                # against running Postgres test DB
│   │           ├── health.test.ts
│   │           └── setup.ts                     # truncate-between-tests helper
│   │
│   └── frontend/
│       ├── README.md                            # frontend-specific dev docs
│       ├── package.json
│       ├── tsconfig.json                        # extends ../../tsconfig.base.json
│       ├── tsconfig.node.json                   # for vite.config.ts itself
│       ├── vite.config.ts
│       ├── index.html
│       ├── Dockerfile                           # multi-stage: builder (node:lts) → nginx:alpine
│       ├── nginx.conf                           # serves built assets; proxies /api/* to backend
│       ├── public/
│       │   └── favicon.svg
│       └── src/
│           ├── main.tsx                         # entry; mounts <App> inside <ErrorBoundary>
│           ├── App.tsx                          # top-level layout; renders <TodoFeature />
│           ├── vite-env.d.ts
│           ├── features/
│           │   └── todos/
│           │       ├── TodoFeature.tsx          # screen-level orchestration (FR2)
│           │       ├── TodoList.tsx             # renders [TodoItem] (FR2, FR6)
│           │       ├── TodoItem.tsx             # single row with toggle + delete (FR3, FR4, FR5, FR6)
│           │       ├── AddTodoForm.tsx          # input + submit (FR1)
│           │       ├── EmptyState.tsx           # FR8
│           │       ├── LoadingState.tsx         # FR9
│           │       ├── ErrorState.tsx           # FR10 + retry control (FR11)
│           │       ├── useTodos.ts              # data hook: fetch, mutate, status, error
│           │       ├── useTodos.test.ts
│           │       ├── api.ts                   # fetch wrappers, uses shared Zod schemas
│           │       ├── api.test.ts
│           │       ├── todosReducer.ts          # immutable state transitions (todoCreated, etc.)
│           │       ├── todosReducer.test.ts
│           │       ├── TodoList.test.tsx
│           │       ├── TodoItem.test.tsx
│           │       ├── AddTodoForm.test.tsx
│           │       └── todos.module.css
│           ├── shared/
│           │   ├── http.ts                      # generic fetch + error normalization
│           │   ├── http.test.ts
│           │   └── ErrorBoundary.tsx            # last-resort React error catcher
│           └── styles/
│               └── globals.css                  # base typography, layout reset, viewport meta supports
│
├── packages/
│   └── shared/
│       ├── README.md                            # shared-package conventions; "edit-here-first" rule
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                         # barrel re-exports
│           ├── todo.ts                          # Todo, CreateTodoInput, UpdateTodoInput Zod schemas
│           ├── errors.ts                        # ApiError shape, ErrorCode union
│           └── health.ts                        # HealthResponse schema
│
└── e2e/
    ├── README.md                                # how to run E2E locally and in CI
    ├── package.json                             # Playwright, @axe-core/playwright deps
    ├── playwright.config.ts                     # browser projects, baseURL, reporters
    ├── tsconfig.json
    └── tests/
        ├── create-todo.spec.ts                  # NFR20 flow #1
        ├── list-todos.spec.ts                   # NFR20 flow #2
        ├── complete-todo.spec.ts                # NFR20 flow #3
        ├── incomplete-todo.spec.ts              # NFR20 flow #4
        ├── delete-todo.spec.ts                  # NFR20 flow #5
        └── accessibility.spec.ts                # NFR8: axe-core Level A scan
```

### Architectural Boundaries

**API Boundaries (HTTP, the single external surface):**

- Public surface: only `/api/*` routes exposed through the frontend nginx (production) or Vite dev-proxy (development).
- Surface enumerated explicitly: `GET /api/todos`, `POST /api/todos`, `PATCH /api/todos/:id`, `DELETE /api/todos/:id`, `GET /api/health`. Anything else is a 404.
- OpenAPI docs at `/docs` in development only (gated by `NODE_ENV`).
- No internal HTTP boundaries — single backend service.
- No outbound HTTP from backend. No third-party APIs.

**Component Boundaries (frontend):**

- *External (browser ↔ backend):* HTTP/JSON via `apps/frontend/src/features/todos/api.ts` only.
- *Hook ↔ components:* `useTodos` exposes `{ todos, status, error, isMutating, actions }`. Components never call `api.ts` directly.
- *Reducer ↔ hook:* `todosReducer.ts` is a pure function; only `useTodos` dispatches against it.
- *Cross-feature:* none in v1. If introduced, lift shared state to a React Context provider in `App.tsx`.

**Service Boundaries (backend):**

- One-way layering: **controllers → services → repositories → db**. Lower layers do not import upper layers.
- *Controllers:* HTTP-aware. Bind routes, parse / validate via Zod, shape responses, map errors.
- *Services:* business-logic-aware. Operate on domain types from `packages/shared`.
- *Repositories:* persistence-aware. Drizzle queries hidden behind a typed interface.
- *db:* connection management, schema, migrations.
- Plugins (`apps/backend/src/plugins/*`) cross-cut all layers but are owned by the framework boundary, not the domain.

**Data Boundaries:**

- Single Postgres schema, single `todos` table in v1.
- All access through the repository interface — there is no path that writes to Postgres without going through `TodoRepository`.
- Test database: separate logical DB (`bmad_todo_test`) on the same Postgres instance. Backend integration tests truncate between test files; never share state with the dev database.
- No external data sources. No file uploads. No caching layer.

### Requirements to Structure Mapping

| FR group | Files / directories |
|---|---|
| **Todo Management (FR1–FR5)** | `apps/backend/src/controllers/todoController.ts`, `services/todoService.ts`, `repositories/{todoRepository,postgresTodoRepository}.ts`; `apps/frontend/src/features/todos/{TodoFeature,TodoList,TodoItem,AddTodoForm}.tsx`, `useTodos.ts`, `api.ts`, `todosReducer.ts` |
| **State Visualization (FR6, FR7)** | `apps/frontend/src/features/todos/{TodoList,TodoItem}.tsx` + `todos.module.css`; `globals.css` |
| **Application Lifecycle States (FR8–FR11)** | `apps/frontend/src/features/todos/{EmptyState,LoadingState,ErrorState}.tsx`; status field in `todosReducer.ts`; retry control in `ErrorState.tsx` |
| **Persistence & Continuity (FR12–FR14)** | `apps/backend/src/db/{schema,client,migrate}.ts`, `repositories/postgresTodoRepository.ts`; `docker-compose.yml` postgres volume |
| **Operational Health (FR15, FR16)** | `apps/backend/src/controllers/healthController.ts` (registered with `logLevel: 'warn'`), `db/client.ts` SELECT 1 probe; `Dockerfile` `HEALTHCHECK` directive; `docker-compose.yml` Postgres `pg_isready` healthcheck |
| **Responsive Presentation (FR17, FR18)** | `apps/frontend/src/styles/globals.css`, `apps/frontend/src/features/todos/todos.module.css`, `apps/frontend/index.html` viewport meta |
| **Accessibility (FR19, FR20)** | Cross-cutting: semantic HTML and `aria-*` attributes throughout `apps/frontend/src/features/todos/*.tsx`; `e2e/tests/accessibility.spec.ts` enforces NFR8 |
| **Configuration & Deployment (FR21–FR23)** | `docker-compose.yml`, `docker-compose.override.yml`, `.env.example`, `apps/backend/Dockerfile`, `apps/frontend/Dockerfile`, `apps/backend/src/config.ts` |
| **Code coverage (NFR18, NFR19)** | Vitest config in each `apps/*/package.json`; thresholds enforced in CI |
| **E2E suite (NFR20)** | `e2e/tests/{create,list,complete,incomplete,delete}-todo.spec.ts` |
| **Accessibility automation (NFR8)** | `e2e/tests/accessibility.spec.ts` (axe-core Level A scan) |
| **Cross-OS portability (NFR23)** | `docker-compose.yml` volume-mount syntax kept Windows-compatible; `.editorconfig` enforces LF line endings |

**Cross-cutting concerns:**

- *Auth-readiness seam:* `apps/backend/src/plugins/userContext.ts` (the one-line swap point when auth lands). Repository signatures parameterize `userId` from day one.
- *Error format:* `apps/backend/src/errors.ts` (typed errors) + `plugins/errorHandler.ts` (mapping); `packages/shared/errors.ts` (canonical wire format); `apps/frontend/src/shared/http.ts` (parse).
- *Config:* `apps/backend/src/config.ts` (Zod-validated env loader); `.env.example` lists keys; `docker-compose.yml` interpolates.
- *Logging:* `apps/backend/src/logger.ts` (pino); JSON to stdout; captured by Docker. Health-probe logs muted; only state transitions emit (see *Infrastructure & Deployment → Health Checks & Health-Check Logging*).

### Integration Points

**Internal Communication:**

- **Browser ↔ frontend container:** HTTP on port `:8080` (only host-exposed port).
- **Frontend nginx ↔ backend container:** HTTP on internal Docker network. nginx proxies `location /api/` → `http://backend:3000/api/`.
- **Backend ↔ Postgres:** TCP on internal Docker network, via `pg` connection pool wrapped by Drizzle.
- **Frontend ↔ shared package:** TypeScript imports resolved through npm workspaces symlink (no runtime; pure types).
- **Backend ↔ shared package:** same — TypeScript imports, type-only.

**External Integrations:** none.

**Data Flow:**

```
User action (click "Add")
  → AddTodoForm.tsx onSubmit
  → useTodos.ts dispatches mutation
  → api.ts fetch POST /api/todos
  → nginx proxy → backend container
  → Fastify route (todoController.ts)
  → Zod validation (@fastify/type-provider-zod)
  → userContext plugin stamps request.userId='default-user'
  → todoService.createTodo(input, userId)
  → postgresTodoRepository.create(input, userId)
  → Drizzle INSERT into todos
  → row returned up the chain
  → controller serializes Todo (camelCase JSON)
  → 201 response
  → api.ts parses JSON → Zod validation (dev only)
  → useTodos dispatches `todoCreated`
  → todosReducer produces new state
  → React re-renders TodoList with new row
```

### File Organization Patterns

**Configuration files:**

- All build / lint / format / TS / Docker config at the repo root or one level deep in each app.
- No nested config files beyond what tooling demands.
- `.env.example` at root only — services don't have their own `.env` files; they read from the root `docker-compose.yml`'s passed environment.

**Source organization:**

- Backend: layered (`controllers/`, `services/`, `repositories/`, `db/`, `plugins/`).
- Frontend: feature-folder (`features/<feature>/`) + shared (`shared/`) + styles (`styles/`).
- Shared package: domain-grouped (`todo.ts`, `errors.ts`, `health.ts`).

**Test organization:**

- *Unit / component tests:* co-located with source (`*.test.ts(x)` next to `*.ts(x)`). Run by Vitest from each app's package.
- *Backend integration tests:* `apps/backend/tests/integration/` — run separately via `npm run test:integration` (requires Postgres up).
- *E2E tests:* `e2e/tests/` — run separately via `npm run test:e2e` (requires full stack up).

**Asset organization:**

- Frontend static assets in `apps/frontend/public/` (favicon only in v1).
- No backend static assets.

### Development Workflow Integration

**Development server structure:**

- `docker compose up` (with override file auto-applied) starts:
  - `postgres` (data persisted in named volume `bmad_todo_postgres_data`).
  - `backend` running `tsx --watch src/server.ts`, source mounted from host.
  - `frontend` running `vite` dev server with HMR, source mounted from host.
- Frontend available at `http://localhost:8080`. Backend OpenAPI docs at `http://localhost:8080/docs` (proxied through nginx in dev override; or directly at `http://localhost:3000/docs` if backend port temporarily exposed).

**Build process structure:**

- Each app's Dockerfile is multi-stage:
  - *Backend:* `node:lts` builder runs `npm ci --workspaces` and `tsc --build apps/backend`; `node:lts-slim` runtime runs the compiled output.
  - *Frontend:* `node:lts` builder runs `vite build`; `nginx:alpine` runtime serves the built static assets.
- The shared package is built first because both apps depend on it (handled by `tsc --build` workspace ordering).

**Deployment structure:**

- Local-only via `docker compose up`. No production deployment in v1.
- `docker-compose.yml` is the only deployment artifact.
- Cross-OS portability: standard volume-mount syntax (`./path:/path`) works identically on Linux / macOS / Windows; the only OS-specific concern is line endings, handled by `.editorconfig` enforcing LF.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

All technology choices integrate cleanly:

- **Fastify + React + TypeScript + Postgres + Drizzle + Zod** — mainstream 2026 stack, well-supported, no version-incompatibility concerns.
- **`@fastify/type-provider-zod`** is the canonical bridge between Fastify route schemas and Zod, keeping `packages/shared` Zod schemas as the single source of truth — no double-authoring.
- **Drizzle ORM ↔ Postgres** — Drizzle is built natively for Postgres; UUID generation uses `gen_random_uuid()` (Postgres pgcrypto extension, builtin since PG 13).
- **Vite + Vitest + Playwright + axe-core** — all interoperate; Vitest reuses Vite config, Playwright runs against the docker-composed stack, axe integrates into Playwright via `@axe-core/playwright`.
- **ESLint 9 (flat config) + Prettier + TypeScript strict** — modern linting/formatting baseline, no rule conflicts (`eslint-config-prettier` handles overlap).
- **GitHub Actions** — runs the full pipeline (lint → test → build → e2e) on standard ubuntu-latest runners; Docker available out-of-the-box.

No version conflicts identified. No contradictory decisions identified.

**Pattern Consistency:**

- Naming conventions are consistent end-to-end: `snake_case` at the DB, `camelCase` over the wire (Drizzle column aliases handle the bridge), `camelCase` / `PascalCase` per TypeScript norms in code.
- The layered backend (controllers → services → repositories → db) is mirrored in test organization (each layer has unit tests; integration tests sit at the controller-through-DB boundary).
- The frontend feature-folder layout co-locates all FR-mapped code, matching the PRD's *one feature → one folder* mental model.
- Error handling is consistent: typed errors throw on backend, single Fastify handler maps to envelope, frontend `http.ts` parses to typed `ApiError`, `ErrorState` renders.

**Structure Alignment:**

- The project tree supports every architectural decision — every layer named in *Implementation Patterns* has a corresponding directory.
- The `packages/shared` workspace is the explicit seam for non-foreclosure schema evolution.
- Boundaries are enforceable: ESLint can be configured with `import/no-restricted-paths` to enforce one-way layering at lint-time (recommended addition during scaffolding).

### Requirements Coverage Validation ✅

**Functional Requirements (23/23 covered):**

| FR group | Coverage location |
|---|---|
| FR1–FR5 (Todo CRUD) | `controllers/todoController.ts` → `services/todoService.ts` → `repositories/postgresTodoRepository.ts` → Postgres `todos` table |
| FR6 (visual distinction) | `TodoItem.tsx` + `todos.module.css` differentiates active vs completed |
| FR7 (read text) | `TodoItem.tsx` renders `description` |
| FR8 (empty state) | `EmptyState.tsx` rendered when `status === 'loaded' && todos.length === 0` |
| FR9 (loading state) | `LoadingState.tsx` rendered when `status === 'loading'` |
| FR10 (error state) | `ErrorState.tsx` rendered when `status === 'error'`; existing data preserved |
| FR11 (retry) | Retry button in `ErrorState.tsx` re-invokes the failed mutation |
| FR12 (refresh persistence) | Postgres-backed; React state always sourced from API on mount |
| FR13 (container restart persistence) | Named volume `bmad_todo_postgres_data` |
| FR14 (persisted truth) | `useTodos` always fetches on mount; reducer never invents state |
| FR15 (health endpoint) | `healthController.ts` → `GET /api/health` |
| FR16 (persistence-health propagation) | `SELECT 1` probe in `db/client.ts`; reflected in response and state-transition log |
| FR17–FR18 (responsive) | CSS modules + `globals.css` viewport-sized layout |
| FR19 (keyboard) | Semantic HTML throughout; native form controls; verified by axe scan |
| FR20 (WCAG A) | Same; verified by `e2e/tests/accessibility.spec.ts` |
| FR21 (env vars) | `config.ts` Zod-validated env loader |
| FR22 (per-service Dockerfiles) | `apps/backend/Dockerfile`, `apps/frontend/Dockerfile` |
| FR23 (docker compose end-to-end) | `docker-compose.yml` + `docker-compose.override.yml` |

**Non-Functional Requirements (23/23 covered):**

| Category | Coverage |
|---|---|
| Performance (NFR1, NFR2) | No architectural blockers; pessimistic-update model trades sub-second mutation latency for simpler error handling — acceptable under PRD's qualitative bar |
| Security (NFR3–NFR7) | React text-escape (NFR3); Zod request validation (NFR4); `.env` gitignored, `config.ts` validates (NFR5); Postgres port unmapped to host (NFR6); Drizzle parameterized queries (NFR7) |
| Accessibility (NFR8, NFR9) | axe-core in E2E enforces zero Level-A violations; semantic HTML across all components |
| Reliability & Durability (NFR10–NFR13) | Postgres named volume (NFR10); independent containers (NFR11); pessimistic UI + visible error states (NFR12); Postgres ACID transactions (NFR13) |
| Maintainability (NFR14–NFR17) | ESLint+Prettier in CI (NFR14); workspace separation (NFR15); root README NFR16-tested via 15-min first-run; `config.ts` centralizes env-var reading (NFR17) |
| Testability & Quality (NFR18–NFR21) | Vitest coverage thresholds in `package.json` (NFR18, NFR19); Playwright suite covers the five named flows (NFR20); npm scripts documented in README (NFR21) |
| Portability (NFR22, NFR23) | Vanilla Docker, no extras (NFR22); `.editorconfig` enforces LF, standard volume-mount syntax (NFR23) |

### Non-Foreclosure Validation ✅

| Future capability | Architectural seam | Cost to enable later |
|---|---|---|
| Multi-user / auth | `user_id` column with `'default-user'` default; `plugins/userContext.ts` is the swap point; repositories already parameterize `userId` | Add real auth plugin; replace `userId` source in `userContext.ts`; add `users` table — no service / repository / persistence-schema rewrite |
| Per-todo metadata (priority, due_date, tags) | `todos` table extensible with nullable columns; Zod schemas in `packages/shared/todo.ts` extensible with optional fields | One Drizzle migration; one schema edit in `packages/shared`; controllers / services / frontend extend optionally |
| Real-time sync | UUID PKs (collision-safe across clients); repository interface as the interception point; `useTodos` hook contract stable when internals swap to react-query + WS / SSE | Add WS plugin + LISTEN/NOTIFY trigger; swap `useTodos` internals; React components unchanged |
| Audit log | Repository-layer interception or Postgres triggers; `updated_at` already captured; new `audit_events` table with FK to `todos.id` | One migration adding `audit_events`; one repository-decorator (or trigger); existing data flow unchanged |

The architecture **does not pre-build any of these capabilities** (per PRD's *"Architect over-engineers for non-foreclosure"* risk mitigation) but each has a documented, low-cost path.

### Implementation Readiness Validation ✅

- **Decision Completeness:** all critical architectural decisions are documented with rationale and rejected alternatives. Versions are deliberately not pinned in this document — they should be pinned at scaffolding time against current stable releases (per PRD's *learning exercise* framing).
- **Structure Completeness:** every file and directory the implementation needs is enumerated in the project tree. Test locations are specified. Configuration files are placed.
- **Pattern Completeness:** naming, structure, format, communication, and process patterns are all codified with examples and anti-patterns.

### Gap Analysis

**Critical gaps:** none.

**Informational gaps (worth dev-team awareness, not blocking):**

1. *Frontend dev-mode Dockerfile vs production-mode.* The production frontend Dockerfile is multi-stage (`node:lts` builder → `nginx:alpine` runtime). Dev mode runs Vite directly via the override file — the architecture implies a separate dev Dockerfile (or a multi-target single Dockerfile with a `dev` target). Worth explicit handling during scaffolding; the dev team should choose between (a) `Dockerfile.dev` separate file or (b) multi-target Dockerfile with `--target=dev`. **Either is acceptable; mention in the scaffolding story.**

2. *npm workspaces native-module rebuild across host architectures.* Hoisted node_modules between host (e.g. macOS arm64) and Linux container (amd64 by default) can cause native-module breakage if any dep ships a native binary. v1 dependencies (Fastify, React, Drizzle, Zod, Vitest, Playwright, axe) include some native modules indirectly (e.g. `pg`'s optional native bindings, `@swc/core` if used). **Mitigation:** Dockerfiles should `npm ci` *inside* the container, not rely on host-mounted `node_modules`. Already implied by the Dockerfile pattern but worth stating explicitly.

3. *OpenAPI dev-only gating.* `plugins/swagger.ts` must check `config.env === 'development'` before registering swagger-ui — if forgotten, dev-only docs leak into production builds (a security-aesthetic concern, not a real vulnerability for local-only deployment but still drift from intent). **Mitigation:** unit-testable check in the plugin.

**Nice-to-have refinements:**

- ESLint `import/no-restricted-paths` rule to enforce one-way layering at lint-time (controllers → services → repositories → db, no skip).
- Husky pre-commit hooks to run `lint-staged` on changed files. *Not added in v1 — the CI gate is the authoritative check.*
- `commitlint` for conventional commits. *Not added in v1.*

### Architecture Completeness Checklist

**Requirements Analysis** ✅
- Project context thoroughly analyzed (Step 2).
- Scale and complexity assessed (low / medium-low respectively).
- Technical constraints identified (stakeholder-imposed list explicit).
- Cross-cutting concerns mapped (auth-readiness, error format, config, health, portability, test pyramid).

**Architectural Decisions** ✅
- Critical decisions documented with rationale.
- Technology stack fully specified (versions deliberately not pinned — pinned at scaffolding time).
- Integration patterns defined (HTTP REST, internal Docker network, type-only shared package).
- Performance considerations addressed (qualitative-only, per PRD).

**Implementation Patterns** ✅
- Naming conventions established for DB, API, code, files.
- Structure patterns defined (layered backend, feature-folder frontend, domain-grouped shared).
- Communication patterns specified (no events in v1; documented seam for future).
- Process patterns documented (error handling, loading states, retry, validation).

**Project Structure** ✅
- Complete directory structure defined (every file enumerated).
- Component boundaries established (frontend hook ↔ components, backend layer one-way).
- Integration points mapped (browser ↔ frontend ↔ backend ↔ Postgres).
- Requirements-to-structure mapping complete (FR table in Step 6).

### Architecture Readiness Assessment

**Overall Status:** **READY FOR IMPLEMENTATION**

**Confidence Level:** **High.** Coverage is complete (23/23 FRs, 23/23 NFRs, 4/4 non-foreclosure paths). No critical gaps. Three informational gaps documented above for the dev team's awareness; none are blockers.

**Key Strengths:**

- **Honest separation of constraints from decisions.** The architecture document is explicit about what was inherited from the brief versus what was the architect's call — addressing the PRD's *Process Success* criterion directly.
- **Non-foreclosure without pre-building.** Each of the four future capabilities has a documented seam, but none is pre-implemented — addressing the PRD's *over-engineering* risk explicitly.
- **Single source of truth for the API contract.** `packages/shared` Zod schemas drive both runtime validation (backend) and type-safety (frontend), making API evolution mechanical rather than manual.
- **Layered enforcement.** ESLint + TypeScript strict + Prettier + Vitest coverage thresholds + CI gate together create a maintainability ratchet that's hard to ratchet down accidentally.

**Areas for Future Enhancement:**

- ESLint `import/no-restricted-paths` rule for layer enforcement at lint-time.
- Splitting `/api/health` into `/api/health/live` and `/api/health/ready` if deployment topology grows beyond local Docker.
- Cursor-based pagination on `/api/todos` if the dataset grows to where listing all becomes a UX cost.
- ADR directory (`docs/adr/`) populated as architectural changes occur post-v1.

### Implementation Handoff

**AI Agent Guidelines:**

- Follow the architectural decisions in this document exactly. No silent deviations.
- Apply the implementation patterns (naming, layer boundaries, error handling, state shape) consistently across every component.
- Keep one-way layering at the backend; never import "up" the layer stack.
- Author API-contract changes in `packages/shared` first, then update both apps. Run all tests.
- For any architectural change required by an unforeseen constraint, raise via `bmad-correct-course` rather than diverging silently.

**First Implementation Priority:**

The first epic / story should be the **workspace and container scaffold** — directly executes the initialization commands from *Starter Template Evaluation* and produces a runnable `docker compose up` skeleton. Acceptance criteria: empty `apps/backend`, `apps/frontend`, `packages/shared` packages compile cleanly; `docker compose up` returns healthy containers (with placeholder routes); `npm run lint && npm run test` pass on empty test suites.

After scaffolding, the implementation sequence from *Decision Impact Analysis → Implementation Sequence* in Step 4 applies.
