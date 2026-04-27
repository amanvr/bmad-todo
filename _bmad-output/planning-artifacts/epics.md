---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
status: complete
completedAt: '2026-04-27'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/product-brief.md
  - _bmad-output/planning-artifacts/prd-validation-report.md
storyTemplateExtension: 'option-a-test-scenarios-per-story'
---

# bmad-todo — Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for **bmad-todo**, decomposing the requirements from the PRD and Architecture decisions into implementable stories.

**Story-template extension (option a):** every story includes a `**Test Scenarios:**` block with `Unit`, `Integration`, and `E2E` subsections. Layers that don't apply to a given story are explicitly marked `none` so the dev team can verify the omission is deliberate.

## Requirements Inventory

### Functional Requirements

```
FR1:  User can create a todo by providing a text description.
FR2:  User can view the complete list of todos.
FR3:  User can mark an active todo as completed.
FR4:  User can mark a completed todo as active (un-complete it).
FR5:  User can delete a todo, removing it permanently from the list.
FR6:  User can visually distinguish completed todos from active todos at a glance.
FR7:  User can read the full text description of each todo in the list.
FR8:  User sees an empty-state indication when no todos exist.
FR9:  User sees a loading-state indication while todos are being fetched on initial load.
FR10: User sees a clear error-state indication when the application cannot load or save data, without losing visibility of any todos already rendered.
FR11: User can retry a failed action (load, create, complete/un-complete, delete) without reloading the page.
FR12: System persists each todo such that it survives a browser refresh.
FR13: System persists each todo such that it survives a container restart (`docker compose down && docker compose up`).
FR14: System reflects the persisted state on each new load — no client-only state may masquerade as persisted data.
FR15: System exposes a backend health-check endpoint that reports overall service health.
FR16: System's health-check endpoint reflects persistence-layer health when a persistence layer exists.
FR17: User can perform every functional capability at desktop viewport widths (≥ 1024 px) without layout breakage or unreachable controls.
FR18: User can perform every functional capability at mobile viewport widths (≥ 360 px), in both portrait and landscape orientation, without layout breakage or unreachable controls.
FR19: User can interact with every functional capability using keyboard alone — no capability is reachable only via pointer device.
FR20: User can navigate the application with assistive technology consistent with WCAG 2.2 Level A.
FR21: System reads runtime configuration from environment variables — no hard-coded URLs, ports, or secrets in source.
FR22: System provides per-service Dockerfiles enabling each service to be built independently.
FR23: System provides a `docker compose` configuration that brings up the full application end-to-end with a single command.
```

### NonFunctional Requirements

```
NFR1:  User-facing actions feel perceived-instant under normal local-Docker conditions. No formal numeric latency budget.
NFR2:  Initial application load completes in a reasonable time on local conditions; loading-state visibility acceptable.
NFR3:  Application accepts no untrusted input that would be executed as code or rendered as raw HTML — todo text descriptions are safely rendered (no XSS).
NFR4:  Backend rejects malformed, oversized, or otherwise abusive requests with appropriate HTTP error responses rather than crashing.
NFR5:  No secrets, credentials, hostnames, or environment-specific configuration are committed to source.
NFR6:  Backend persistence is not directly exposed to the network — only the Fastify backend is reachable from the browser.
NFR7:  No SQL injection — all user input that reaches a query layer is parameterized.
NFR8:  Application reports zero violations at WCAG 2.2 Level A scope when scanned by an automated accessibility scanner.
NFR9:  All FR1–FR23 capabilities remain accessible via keyboard alone, with no keyboard traps.
NFR10: Persisted todo data survives container restart (`docker compose down && docker compose up`).
NFR11: Persisted todo data survives backend service restart independent of the persistence container.
NFR12: Frontend recovers gracefully from transient backend failures: displayed todos remain visible, errors are presented, retry succeeds when backend recovers.
NFR13: Backend crashes do not corrupt the persistence layer — partial writes either complete atomically or are not persisted.
NFR14: Codebase follows a consistent style enforced by formatter and linter integrated into the test pipeline.
NFR15: Backend, frontend, and persistence concerns are separated such that any one of them can be replaced without rewriting the others.
NFR16: A README or equivalent at the repo root enables a developer unfamiliar with the project to clone, configure (`.env`), and reach a successful `docker compose up` within 15 minutes on a Docker-installed machine.
NFR17: No "magic constants" embedded in source code where environment configuration is appropriate (URLs, ports, connection strings, feature toggles).
NFR18: Backend test coverage ≥ 70% meaningful coverage (excluding generated code, type definitions, configuration scaffolding).
NFR19: Frontend test coverage ≥ 70% meaningful coverage (same exclusions).
NFR20: End-to-end test suite contains ≥ 5 Playwright tests, all passing, collectively covering the five core CRUD flows (create, list, mark complete, mark incomplete, delete). Quantity alone does not satisfy this — flow coverage is the bar.
NFR21: Test suites are runnable via documented commands without manual setup beyond what `docker compose up` provides.
NFR22: Application runs on any host capable of running Docker Engine ≥ a version specified by the architect. No host-OS-specific dependencies beyond Docker itself.
NFR23: Application functions identically on Linux, macOS, and Windows hosts running Docker.
```

### Additional Requirements

(From the Architecture document — these shape implementation but are not user-visible capabilities.)

```
- STARTER TEMPLATE (Epic 1, Story 1.1): workspace-based monorepo with `apps/backend`, `apps/frontend`, `packages/shared`. Initialization via `npm create vite@latest apps/frontend -- --template react-ts` for frontend; hand-rolled Fastify scaffold for backend; npm workspaces; shared TS-types-only package.
- Repository layout fixed: `apps/{backend,frontend}/`, `packages/shared/`, `e2e/`, `docs/`, `.github/workflows/`.
- TypeScript strict mode (`strict: true`, `noUncheckedIndexedAccess: true`) across all packages.
- Persistence: PostgreSQL 16+ in sidecar container, named volume `bmad_todo_postgres_data`, port not exposed to host.
- ORM / migrations: Drizzle ORM + Drizzle Kit. Schema in `apps/backend/src/db/schema.ts`. Migrations applied at backend startup.
- Validation: Zod schemas in `packages/shared/`, applied via `@fastify/type-provider-zod`.
- Backend layering (one-way): controllers → services → repositories → db. Repository interface (`TodoRepository`) is the persistence seam.
- Auth-readiness seam: `apps/backend/src/plugins/userContext.ts` stamps `request.userId = 'default-user'`. Services parameterized by `userId` from day one.
- Schema includes `user_id` column with default `'default-user'` (auth non-foreclosure), `updated_at` (audit-log non-foreclosure), UUID PKs (real-time-sync non-foreclosure).
- Security middleware: `@fastify/cors`, `@fastify/helmet`. No rate-limiter in v1.
- Error envelope: `{ error: { code, message, details? } }`. Codes: `VALIDATION_FAILED`, `NOT_FOUND`, `INTERNAL_ERROR`, `PERSISTENCE_UNAVAILABLE`.
- API documentation: `@fastify/swagger` + `@fastify/swagger-ui` at `/docs` in development only (gated by `NODE_ENV`).
- Frontend: Vite + React + CSS modules + plain `useReducer`/`useEffect` (no state library). Feature-folder layout under `src/features/todos/`. Pessimistic updates only.
- API resource shape: `GET/POST /api/todos`, `PATCH/DELETE /api/todos/:id`, `GET /api/health`.
- Naming conventions: `snake_case` DB; `camelCase` over the wire; `PascalCase` components; `camelCase` files for hooks/utilities.
- Test runners: Vitest both sides; `node:test` not used.
- E2E: Playwright + `@axe-core/playwright`. Five named flows (create / list / complete / incomplete / delete) plus accessibility scan.
- Lint / format: ESLint 9 (flat config) + Prettier; integrated into CI as pre-test gates.
- Container topology: three services (frontend nginx, backend Fastify, postgres). Only frontend port 8080 exposed to host. Backend port 3000 internal only. Postgres port 5432 internal only.
- Backend Dockerfile: multi-stage `node:lts` builder → `node:lts-slim` runtime; includes `HEALTHCHECK` directive (interval=30s, timeout=3s, start-period=10s, retries=3).
- Frontend Dockerfile: multi-stage `node:lts` builder → `nginx:alpine` runtime; nginx config rewrites `/api/*` to backend.
- `docker-compose.yml` Postgres healthcheck: `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` (interval=10s, retries=5, start-period=5s).
- Backend `depends_on:` postgres with `condition: service_healthy`.
- Health-probe logging: route registered with `logLevel: 'warn'`. Only state-transition log lines (down→up `info`, up→down `warn`); no log on steady-state probes.
- Logging: pino default, JSON to stdout, captured by Docker. `LOG_LEVEL` env var (`info` dev, `warn` prod).
- Backend integration-test strategy: tests run against the docker-compose Postgres on a separate logical DB (`bmad_todo_test`); truncate-between-tests in `apps/backend/tests/integration/setup.ts`.
- CI (GitHub Actions, `.github/workflows/ci.yml`): lint → test (Vitest, coverage thresholds enforced ≥ 70%) → build (Docker images) → e2e (Playwright in headless container with axe). Triggers: PR + push to main.
- Cross-OS portability: `.editorconfig` enforces LF line endings; standard volume-mount syntax in `docker-compose.yml`.
- README structure: root `README.md` (NFR16 first-run target); per-package READMEs at `apps/backend/`, `apps/frontend/`, `packages/shared/`, `e2e/`.
- Non-foreclosure paths must be preserved (auth-readiness seam, metadata-extensible schema, UUID PKs, repository-interface seam) — every story must verify it doesn't close any of these seams.
```

### UX Design Requirements

**N/A** — no UX design document was produced for this engagement. The PRD's deliberate "doesn't look broken" UX bar (no undo, no shortcuts, no animations, no skeletons) means UX requirements are absorbed into the architecture's *Implementation Patterns* (visual distinction via CSS modules, semantic HTML for accessibility, responsive viewport floors at ≥1024 px / ≥360 px). If a UX document is added later, UX-DRs would be extracted here.

### FR Coverage Map

| FR | Epic |
|---|---|
| FR1 (create todo) | Epic 1 |
| FR2 (view list) | Epic 1 |
| FR3 (mark complete) | Epic 2 |
| FR4 (mark active / un-complete) | Epic 2 |
| FR5 (delete) | Epic 2 |
| FR6 (visual distinction) | Epic 2 |
| FR7 (read full text) | Epic 1 |
| FR8 (empty state) | Epic 1 |
| FR9 (loading state) | Epic 3 |
| FR10 (error state) | Epic 3 |
| FR11 (retry without reload) | Epic 3 |
| FR12 (browser refresh persistence) | Epic 3 |
| FR13 (container restart persistence) | Epic 3 |
| FR14 (persisted truth on load) | Epic 3 |
| FR15 (health endpoint) | Epic 3 |
| FR16 (persistence-health propagation) | Epic 3 |
| FR17 (desktop ≥ 1024 px) | Epic 4 |
| FR18 (mobile ≥ 360 px) | Epic 4 |
| FR19 (keyboard accessibility) | Epic 4 |
| FR20 (WCAG 2.2 Level A) | Epic 4 |
| FR21 (env-var config) | Epic 1 |
| FR22 (per-service Dockerfiles) | Epic 1 |
| FR23 (`docker compose` end-to-end) | Epic 1 |

23/23 FRs mapped.

**NFR / Additional-Requirements landing pattern (cross-cutting; verified by stories within each epic):**

- Lint / format / TS strict / Vitest config / coverage thresholds / GitHub Actions CI / root README scaffold: **Epic 1** (foundation).
- NFR3, NFR4, NFR5, NFR6, NFR7 (security baseline): mostly **Epic 1** (architectural decisions baked into the scaffold), verified throughout.
- NFR8, NFR9 (accessibility automation): **Epic 4**.
- NFR10–NFR13 (durability): **Epic 3**.
- NFR14–NFR17 (maintainability): **Epic 1** establishes; all epics maintain.
- NFR18–NFR21 (testability): **Epic 1** sets up; each epic contributes coverage.
- NFR20 (≥ 5 Playwright flows): spread across all four epics — Epic 1 contributes create + the E2E baseline; Epic 2 contributes complete / un-complete / delete; Epic 3 contributes persistence + error flows; Epic 4 contributes the accessibility scan.
- NFR22, NFR23 (portability): **Epic 1** establishes; all epics inherit.
- Per-package READMEs: added at the package's first scaffolding story; finalized in a closing story.

## Epic List

### Epic 1: Capture and View Todos

A user can run `docker compose up` on a fresh machine, open the app in a browser, add a todo by typing a description, and see it appear in their list. The first add is the first end-to-end exercise of the full stack — frontend + backend + persistence + container orchestration all proven by one user action.

**FRs covered:** FR1, FR2, FR7, FR8, FR21, FR22, FR23.

**Implementation notes:** This epic carries the bootstrap. Stories sequence the workspace scaffold → Docker topology → Postgres schema → backend skeleton (controller / service / repository) → frontend skeleton → first end-to-end "add todo and see it" story. Lint / Prettier / TypeScript strict / Vitest config / GitHub Actions CI baseline land here too.

**Standalone:** Yes. At the end of this epic the app is runnable, has a real backend with a real database, and the user can add and see todos. Epics 2, 3, 4 extend; none is required.

### Epic 2: Track Todo Progress

A user can mark active todos as complete, un-complete them if they change their mind, and delete them when no longer relevant. Completed todos are visually distinct from active ones at a glance.

**FRs covered:** FR3, FR4, FR5, FR6.

**Implementation notes:** Builds on Epic 1's CRUD foundation. Each FR maps cleanly to a backend `PATCH` / `DELETE` endpoint + frontend interaction story. Visual distinction (FR6) is a CSS-modules story tied to `TodoItem`'s rendering.

**Standalone:** Yes. Epic 1 + Epic 2 together = the complete personal todo-management user journey. Epics 3 and 4 are not required.

### Epic 3: Trust the App's Reliability

The app behaves predictably when things go wrong (transient network blip, backend restart, container restart, persistence outage) and gives the user clear feedback about state. Operators can verify health from outside the app.

**FRs covered:** FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16.

**Implementation notes:** This is the largest epic by FR count. Some FRs (FR12, FR13, FR14) are *verifications* of architectural invariants rather than separate features — they appear as integration / E2E test stories rather than feature-build stories. Loading / error / retry are real frontend stories. Health endpoint + persistence probe + state-transition logging are real backend stories.

**Standalone:** Yes. Could ship without Epic 4 and still be a credible reliable app at desktop width.

### Epic 4: Universal Access — Responsive & Accessible

The app works correctly at desktop and mobile viewport sizes (in both orientations on mobile) and is fully usable with keyboard alone and with assistive technology consistent with WCAG 2.2 Level A.

**FRs covered:** FR17, FR18, FR19, FR20.

**Implementation notes:** Final cross-cutting layer. Stories include a responsive-layout pass on `TodoFeature` / `TodoList` / `TodoItem` / `AddTodoForm`; semantic-HTML / ARIA pass for accessibility; integration of `@axe-core/playwright` accessibility scan into the E2E suite; final NFR20 coverage check (the five named Playwright flows).

**Standalone:** Yes. Builds on the full feature set from Epics 1–3 and finishes the v1 commitment.

## Epic 1: Capture and View Todos

A user can run `docker compose up` on a fresh machine, open the app in a browser, add a todo by typing a description, and see it appear in their list. The first add is the first end-to-end exercise of the full stack.

### Story 1.1: Scaffold the workspace monorepo and shared tooling

As a developer joining the project,
I want a workspace monorepo skeleton with shared lint, format, type-checking, and test-runner configuration,
So that I can clone the repo and have a consistent baseline for every package without per-package setup drift.

**Acceptance Criteria:**

**Given** an empty repository,
**When** Story 1.1 completes,
**Then** the repo contains `package.json` with `"workspaces": ["apps/*", "packages/*"]`,
**And** `tsconfig.base.json` enforces `strict: true` and `noUncheckedIndexedAccess: true`,
**And** `.editorconfig` enforces LF line endings (NFR23),
**And** `.nvmrc` pins Node LTS,
**And** `.gitignore` excludes `node_modules/`, `dist/`, `.env`, `coverage/`,
**And** ESLint 9 flat config (`eslint.config.js`) at the root with the TypeScript ruleset,
**And** Prettier + `eslint-config-prettier` integration,
**And** root `README.md` skeleton exists with placeholder sections for prerequisites and quick start (refined progressively).

**Given** the scaffolded workspace,
**When** I run `npm ci` followed by `npm run lint`, `npm run format:check`, and `npm run test`,
**Then** all four pass on the empty scaffold.

**Test Scenarios:**

*Unit:* none — no source code yet.
*Integration:* none.
*E2E:* none.
*Verification:* `npm ci && npm run lint && npm run format:check && npm run test && tsc --build` exits 0.

### Story 1.2: Set up GitHub Actions CI baseline

As a developer landing changes,
I want a CI workflow that runs lint, type-check, and test on every PR,
So that broken code never reaches `main` and the dev team has a fast feedback signal.

**Acceptance Criteria:**

**Given** Story 1.1 is complete,
**When** Story 1.2 completes,
**Then** `.github/workflows/ci.yml` exists with stages `lint`, `typecheck`, `test`, `build` (E2E job is a stubbed placeholder added in Story 1.5),
**And** the workflow triggers on `pull_request` and `push` to `main`,
**And** the workflow runs on `ubuntu-latest`,
**And** Node version is read from `.nvmrc`,
**And** the workflow uses `npm ci` for reproducibility.

**Given** a PR is opened,
**When** the CI workflow runs,
**Then** it reports pass/fail on the PR within ~5 minutes (no time SLA committed; observation only).

**Given** a deliberate lint break is pushed,
**When** the workflow runs,
**Then** the `lint` stage fails clearly in the GHA UI.

**Test Scenarios:**

*Unit:* none (declarative YAML).
*Integration:* the workflow itself functions as continuous-integration verification for every subsequent story.
*E2E:* none in this story.

### Story 1.3: Provision Docker Compose topology with persistent Postgres

As a developer,
I want a `docker-compose.yml` that starts frontend, backend, and Postgres with healthchecks and named-volume persistence,
So that I can `docker compose up` on a fresh machine and have a runnable, persistent environment without setup beyond `.env`. (Delivers FR21, FR22, FR23 at the architectural level.)

**Acceptance Criteria:**

**Given** Story 1.1 is complete,
**When** Story 1.3 completes,
**Then** `docker-compose.yml` defines three services: `frontend`, `backend`, `postgres`,
**And** Postgres uses an official `postgres:16-alpine` (or current pinned LTS) image,
**And** Postgres has a named volume `bmad_todo_postgres_data` mounted at `/var/lib/postgresql/data`,
**And** the Postgres healthcheck is `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` (interval 10s, timeout 3s, retries 5, start_period 5s),
**And** Postgres port `5432` is **not** exposed to the host (NFR6),
**And** the backend container has `depends_on: postgres` with `condition: service_healthy`,
**And** the backend Dockerfile is a multi-stage build (`node:lts` builder → `node:lts-slim` runtime) with a `HEALTHCHECK` directive (`wget -qO- http://localhost:3000/api/health || exit 1`, interval 30s, timeout 3s, start_period 10s, retries 3),
**And** the backend container ships a placeholder script answering `GET /api/health` with `{status: 'healthy'}` (real Fastify replaces this in Story 1.4),
**And** the frontend Dockerfile is a multi-stage build (`node:lts` builder → `nginx:alpine` runtime) with `nginx.conf` proxying `/api/*` to the backend service,
**And** the frontend exposes only port `8080` to the host (FR23),
**And** `.env.example` lists all required keys (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `BACKEND_PORT`, `CORS_ORIGINS`, `NODE_ENV`, `LOG_LEVEL`) (FR21, NFR5),
**And** `.env` is gitignored (NFR5),
**And** `docker-compose.override.yml` is committed for development (Vite dev server with HMR, `tsx --watch` for backend, source-mounted from host).

**Given** a fresh machine with only Docker installed and a populated `.env`,
**When** I run `docker compose up --wait`,
**Then** all three services reach healthy state.

**Given** the stack is running,
**When** I run `docker compose down && docker compose up -d`,
**Then** the Postgres data volume persists across restarts (NFR10 architectural foundation; full FR13 verification lands in Epic 3).

**Test Scenarios:**

*Unit:* none (compose / Dockerfile are declarative).
*Integration:* a smoke script (`scripts/smoke.sh` or equivalent) that runs `docker compose up --wait`, curls `localhost:8080/api/health`, then `docker compose down`. Exit 0 = pass.
*E2E:* none (no real feature surface yet).

### Story 1.4: Build backend Fastify skeleton with config, plugins, and basic health endpoint

As a developer,
I want a real Fastify backend with env-validated config, error handling, security plugins, and a basic `/api/health` replacing the placeholder,
So that the architectural skeleton is in place for all subsequent backend stories without re-litigation.

**Acceptance Criteria:**

**Given** Stories 1.1 and 1.3 are complete,
**When** Story 1.4 completes,
**Then** `apps/backend/src/server.ts` is the entry point and `apps/backend/src/app.ts` exports a `buildApp()` function (testable without binding to a port),
**And** `apps/backend/src/config.ts` validates env vars via Zod (fails fast on startup if any required var is missing or malformed) (FR21, NFR4, NFR17),
**And** `apps/backend/src/errors.ts` defines `AppError`, `ValidationError`, `NotFoundError`, `InternalError`, `PersistenceUnavailableError`,
**And** `apps/backend/src/logger.ts` configures pino with `LOG_LEVEL` from env (NFR17),
**And** plugins exist at `apps/backend/src/plugins/`: `cors.ts` (origin from `CORS_ORIGINS`), `helmet.ts`, `userContext.ts` (stamps `request.userId = 'default-user'`), `errorHandler.ts` (maps `AppError` → JSON envelope) (NFR3, NFR4 architectural foundation),
**And** `apps/backend/src/controllers/healthController.ts` exposes `GET /api/health` returning `{status: 'healthy'}` on 200 (persistence-aware probe lands in Epic 3 Story 3.7),
**And** the health route is registered with `logLevel: 'warn'` so steady-state probes don't log,
**And** Vitest is configured in `apps/backend/package.json` with coverage threshold ≥ 70% (NFR18),
**And** `apps/backend/README.md` exists with backend-specific dev notes.

**Given** the backend container is running,
**When** I `curl http://backend:3000/api/health` from the Docker network,
**Then** I get `200 {"status":"healthy"}`.

**Given** the env is missing `DATABASE_URL`,
**When** the backend starts,
**Then** it logs a clear Zod validation error and exits non-zero.

**Test Scenarios:**

*Unit:*
- `config.ts`: rejects missing `DATABASE_URL`; rejects malformed `BACKEND_PORT` (non-numeric); accepts a valid env.
- `errors.ts`: each error class carries the expected `code` and `httpStatus`.
- `plugins/errorHandler.ts`: an `AppError` produces the envelope shape; a non-`AppError` produces an `INTERNAL_ERROR` envelope.

*Integration:*
- `app.ts`'s `buildApp()` boots Fastify without errors given a valid config.
- `GET /api/health` returns 200 with the expected body shape (in-memory test; no Postgres required).
- The error-handler plugin emits responses matching the envelope schema (validated against `packages/shared/errors.ts` from Story 1.6).

*E2E:* none in this story.

### Story 1.5: Frontend skeleton with placeholder UI, Vite config, and Playwright baseline

As a developer,
I want a Vite + React frontend skeleton with placeholder content, a Vitest config, and a Playwright baseline configuration,
So that subsequent feature stories have a working render pipeline and test infrastructure to plug into.

**Acceptance Criteria:**

**Given** Stories 1.1 and 1.3 are complete,
**When** Story 1.5 completes,
**Then** `apps/frontend/src/main.tsx` mounts `<App>` inside `<ErrorBoundary>`,
**And** `apps/frontend/src/App.tsx` renders a placeholder `<h1>bmad-todo</h1>` and a placeholder `<TodoFeature />` slot,
**And** `apps/frontend/src/shared/{http.ts, ErrorBoundary.tsx}` exist with the contracts described in `architecture.md`,
**And** `apps/frontend/src/styles/globals.css` includes a base reset and a viewport meta-supporting reset,
**And** `apps/frontend/index.html` includes a `<title>bmad-todo</title>` and a viewport meta tag (NFR8 page-title floor),
**And** `apps/frontend/vite.config.ts` is configured with the Vitest plugin and React Testing Library setup,
**And** Vitest coverage threshold ≥ 70% is configured in `apps/frontend/package.json` (NFR19),
**And** `e2e/` workspace package exists with `playwright.config.ts`, an empty `tests/` directory, and `@axe-core/playwright` installed (real specs land in Story 1.8 onward),
**And** the GHA `ci.yml` `e2e` job is updated from a stub to a real (but currently empty) Playwright run that passes,
**And** `apps/frontend/README.md` exists with frontend-specific dev notes,
**And** `e2e/README.md` exists with E2E run instructions.

**Given** the stack is running via `docker compose up`,
**When** I open `http://localhost:8080`,
**Then** the placeholder page renders without console errors.

**Test Scenarios:**

*Unit:*
- `<ErrorBoundary>` catches a thrown error in a child and renders a fallback.
- `shared/http.ts`: maps a non-2xx response body to a typed `ApiError`; maps a network failure to `ApiError` with `code: 'INTERNAL_ERROR'`.

*Integration:* none in this story.
*E2E:* placeholder Playwright spec verifies the page loads and `<title>` is "bmad-todo".

### Story 1.6: Shared package with Todo, error, and health Zod schemas

As a developer,
I want a `packages/shared` package containing the canonical Zod schemas and inferred types for Todo, errors, and health,
So that backend validation and frontend typing share one source of truth and API-contract evolution is a single edit.

**Acceptance Criteria:**

**Given** Story 1.1 is complete,
**When** Story 1.6 completes,
**Then** `packages/shared/src/todo.ts` exports `TodoSchema`, `CreateTodoInputSchema`, `UpdateTodoCompletionInputSchema` (and inferred TypeScript types),
**And** `packages/shared/src/errors.ts` exports `ApiErrorSchema`, an `ErrorCode` union (`VALIDATION_FAILED | NOT_FOUND | INTERNAL_ERROR | PERSISTENCE_UNAVAILABLE`),
**And** `packages/shared/src/health.ts` exports `HealthResponseSchema`,
**And** `packages/shared/src/index.ts` re-exports everything,
**And** `packages/shared/package.json` is configured for type-only consumption (no runtime build artifacts), with `tsc --emitDeclarationOnly`,
**And** `packages/shared/README.md` exists explaining the "edit-here-first" rule.

**Given** the shared package is built,
**When** the backend or frontend imports from the shared package,
**Then** the import resolves to the published types.

**Given** a Zod schema is parsed against a valid object,
**When** `TodoSchema.parse(...)` runs,
**Then** it returns the typed object.

**Given** a Zod schema is parsed against an invalid object (e.g. description longer than 500 chars),
**When** `parse()` runs,
**Then** it throws a Zod error with the failed-field path.

**Test Scenarios:**

*Unit:*
- `TodoSchema`: accepts a valid todo; rejects empty description; rejects 501-char description; rejects missing `createdAt`; rejects bad UUID.
- `CreateTodoInputSchema`: accepts a 1-char description; rejects empty; rejects 501-char.
- `ApiErrorSchema`: accepts each `ErrorCode` value; rejects an unknown code.

*Integration:* none.
*E2E:* none.

### Story 1.7: Todo persistence layer (todos table + repository)

As a developer,
I want a `todos` table in Postgres with a typed `TodoRepository` interface and a Drizzle-backed implementation,
So that backend services can read/write todos without coupling to SQL details, and the persistence non-foreclosure seam is in place from day one.

**Acceptance Criteria:**

**Given** Stories 1.4 and 1.6 are complete,
**When** Story 1.7 completes,
**Then** `apps/backend/src/db/schema.ts` defines the `todos` table per architecture (UUID PK with `gen_random_uuid()` default, `description` text 1–500 chars CHECK constraint, `completed` boolean NOT NULL default false, `created_at` and `updated_at` TIMESTAMPTZ NOT NULL default now(), `user_id` TEXT NOT NULL default `'default-user'`, indexes on `user_id` and `created_at`),
**And** `apps/backend/drizzle.config.ts` is configured to generate migrations into `apps/backend/drizzle/`,
**And** the first migration `<timestamp>_init.sql` is generated and committed,
**And** `apps/backend/src/db/migrate.ts` applies pending migrations on backend startup,
**And** `apps/backend/src/db/client.ts` exports a singleton pg pool + Drizzle instance,
**And** `apps/backend/src/repositories/todoRepository.ts` defines the `TodoRepository` interface (`list(userId)`, `create(input, userId)`, `setCompleted(id, completed, userId)`, `delete(id, userId)`),
**And** `apps/backend/src/repositories/postgresTodoRepository.ts` implements the interface using Drizzle queries (parameterized — NFR7).

**Given** a fresh database,
**When** the backend starts,
**Then** the migration runs and creates the `todos` table.

**Given** a populated database,
**When** I call `repository.create(...)`,
**Then** a row with `user_id = 'default-user'` is inserted and the typed Todo is returned.

**Test Scenarios:**

*Unit:*
- Schema-as-code in `schema.ts`: Drizzle introspection produces the expected table shape (or skip if covered by integration).

*Integration:* (against the docker-compose Postgres test DB)
- `postgresTodoRepository.create()` inserts a row with `user_id = 'default-user'`; returned object matches `TodoSchema`.
- `postgresTodoRepository.list(userId)` returns inserted rows ordered by `created_at DESC`.
- `postgresTodoRepository.setCompleted(id, true, userId)` flips the boolean and updates `updated_at`.
- `postgresTodoRepository.setCompleted(id, ...)` for a non-existent id throws `NotFoundError`.
- `postgresTodoRepository.delete(id, userId)` removes the row; second `delete` of the same id throws `NotFoundError`.
- Inserting a 501-char description fails the DB CHECK constraint (defense-in-depth alongside Zod).
- A SQL-injection-shaped string in `description` is stored literally, not executed (NFR7).

*E2E:* none in this story (no UI yet for these operations).

### Story 1.8: End-to-end "add and view first todo" with empty state

As an end user,
I want to type a task description, submit it, and see it appear in my list — and see an obvious "empty" message before I add my first one,
So that I can use the app for personal task management without onboarding. (Delivers FR1, FR2, FR7, FR8.)

**Acceptance Criteria:**

**Given** Stories 1.4, 1.5, 1.6, 1.7 are complete,
**When** Story 1.8 completes,
**Then** `apps/backend/src/services/todoService.ts` exists with `createTodo(input, userId)` and `listTodos(userId)` calling the repository,
**And** `apps/backend/src/controllers/todoController.ts` registers `POST /api/todos` and `GET /api/todos` using `@fastify/type-provider-zod` for validation,
**And** `POST /api/todos` returns 201 with the created Todo; invalid input returns 400 with `code: 'VALIDATION_FAILED'`,
**And** `GET /api/todos` returns `Todo[]` ordered by `createdAt DESC`,
**And** `apps/frontend/src/features/todos/` contains `TodoFeature.tsx`, `TodoList.tsx`, `TodoItem.tsx`, `AddTodoForm.tsx`, `EmptyState.tsx`, `useTodos.ts`, `api.ts`, `todosReducer.ts`, `todos.module.css`,
**And** `useTodos` fetches on mount and dispatches `todosLoaded` / `loadingFailed` actions; `todosReducer` produces immutable state transitions,
**And** `AddTodoForm` calls `useTodos.actions.create(...)` which does **not** insert until the server confirms (pessimistic per architecture),
**And** `<EmptyState>` renders when `status === 'loaded' && todos.length === 0`,
**And** `<TodoList>` renders `<TodoItem>` per todo, showing the full `description` text (FR7).

**Given** a fresh app on a clean database,
**When** I open `http://localhost:8080`,
**Then** I see the empty-state message ("No todos yet" or equivalent).

**Given** an empty list,
**When** I type "Buy milk" and submit,
**Then** the todo persists in Postgres,
**And** the list re-renders with one item showing "Buy milk".

**Given** an attempt to submit an empty description,
**When** the submit fires,
**Then** the form rejects locally (button disabled) AND the backend returns 400 if a request reaches it (defense-in-depth).

**Test Scenarios:**

*Unit:*
- `todosReducer.test.ts`: `todosLoaded` produces a new state with the loaded array; `todoCreated` appends immutably; `loadingFailed` sets `status: 'error'` with the error.
- `useTodos.test.ts`: on mount, calls `api.list()`; on success, state is `{status: 'loaded', todos: [...]}`; on failure, state is `{status: 'error', error: ...}`.
- `api.test.ts`: serializes / deserializes against the shared Zod schemas; non-2xx responses produce a typed `ApiError`.
- `AddTodoForm.test.tsx`: empty description disables the submit button; valid description enables it.
- `TodoItem.test.tsx`: renders the description text.
- `EmptyState.test.tsx`: renders when given `todos.length === 0`.

*Integration:* (backend, against the docker-compose Postgres test DB)
- `POST /api/todos` with valid body inserts a row and returns 201 + the created Todo.
- `POST /api/todos` with invalid body returns 400 with `code: 'VALIDATION_FAILED'`.
- `GET /api/todos` returns inserted rows ordered by `createdAt DESC`.

*E2E:* (Playwright, NFR20 flow #1 — *create-todo*)
- Open `localhost:8080`; assert empty-state message visible; type "Buy milk"; submit; assert "Buy milk" appears in the list within ~1s; reload the page; assert "Buy milk" still visible (architectural smoke for persistence — full Epic 3 verification later).

## Epic 2: Track Todo Progress

A user can mark active todos as complete, un-complete them if they change their mind, and delete them when no longer relevant. Completed todos are visually distinct from active ones at a glance.

### Story 2.1: Toggle todo completion (mark complete and un-complete)

As an end user,
I want to mark a todo complete by clicking on it, and un-complete it if I change my mind,
So that I can track which tasks I've finished and reverse a mistake without re-creating the todo. (Delivers FR3, FR4.)

**Acceptance Criteria:**

**Given** Story 1.8 is complete,
**When** Story 2.1 completes,
**Then** `apps/backend/src/services/todoService.ts` adds `setCompletion(id, completed, userId)`,
**And** `apps/backend/src/controllers/todoController.ts` registers `PATCH /api/todos/:id` validated against `UpdateTodoCompletionInputSchema` from `packages/shared`,
**And** `PATCH /api/todos/:id` returns 200 with the updated Todo on success; 400 `code: 'VALIDATION_FAILED'` on invalid body; 404 `code: 'NOT_FOUND'` on missing id,
**And** the backend updates `updated_at` on each toggle (audit-log non-foreclosure seam),
**And** `apps/frontend/src/features/todos/TodoItem.tsx` renders a checkbox-shaped control bound to `completed`,
**And** clicking the toggle calls `useTodos.actions.setCompleted(id, completed)` which calls the API and only updates UI after server confirmation (pessimistic),
**And** `useTodos.ts` exposes `isMutating` (boolean per-item or global) and the toggle control is disabled while mutation is in flight.

**Given** an active todo,
**When** I click its toggle,
**Then** the backend persists `completed = true`, returns the updated Todo, and the UI re-renders with the toggle in the "complete" state.

**Given** a completed todo,
**When** I click its toggle,
**Then** the backend persists `completed = false` and the UI re-renders with the toggle in the "active" state.

**Given** a todo whose id no longer exists (e.g. deleted in another tab),
**When** I click its toggle,
**Then** the backend returns 404 with `code: 'NOT_FOUND'` and the frontend dispatches `mutationFailed` (full error-state UX in Epic 3; this story just ensures the failure doesn't crash the app).

**Test Scenarios:**

*Unit:*
- `todoService.setCompletion()`: delegates to `repository.setCompleted` with the right args; rethrows `NotFoundError`.
- `todosReducer.test.ts`: `todoCompletionToggled` updates the matching todo immutably; other todos unchanged.
- `TodoItem.test.tsx`: clicking the toggle invokes the supplied callback with the inverse `completed` value; toggle disabled while `isMutating`.

*Integration:* (backend, against test DB)
- `PATCH /api/todos/:id` with `{completed: true}` flips the value; response matches `TodoSchema`; `updated_at` is later than `created_at`.
- `PATCH /api/todos/:id` with `{completed: false}` flips back.
- `PATCH /api/todos/:id` against a non-existent id returns 404 with `code: 'NOT_FOUND'`.
- `PATCH /api/todos/:id` with a missing `completed` field returns 400 with `code: 'VALIDATION_FAILED'`.

*E2E:* (Playwright, NFR20 flow #3 — *complete-todo*, and NFR20 flow #4 — *incomplete-todo*)
- Add a todo "Read book"; click its toggle; assert it visually marks complete; reload page; assert state persists. *(complete-todo flow.)*
- With a completed todo present; click its toggle; assert it returns to active; reload; assert state persists. *(incomplete-todo flow.)*

### Story 2.2: Delete a todo

As an end user,
I want to delete a todo I no longer need,
So that my list stays focused on what's still relevant. (Delivers FR5.)

**Acceptance Criteria:**

**Given** Story 1.8 is complete,
**When** Story 2.2 completes,
**Then** `apps/backend/src/services/todoService.ts` adds `deleteTodo(id, userId)`,
**And** `apps/backend/src/controllers/todoController.ts` registers `DELETE /api/todos/:id`,
**And** `DELETE /api/todos/:id` returns 204 (no body) on success; 404 `code: 'NOT_FOUND'` on missing id,
**And** `apps/frontend/src/features/todos/TodoItem.tsx` renders a delete control (button with accessible label),
**And** clicking delete calls `useTodos.actions.delete(id)` which calls the API and only removes from UI after server confirmation (pessimistic),
**And** the delete control is disabled while the mutation is in flight.

**Given** a todo in the list,
**When** I click its delete control,
**Then** the backend removes the row,
**And** the frontend dispatches `todoDeleted` and the row is removed from the rendered list.

**Given** a todo whose id no longer exists,
**When** delete is clicked,
**Then** the backend returns 404 and the frontend dispatches `mutationFailed` (full UX in Epic 3).

**Given** a list with one todo remaining,
**When** I delete the last todo,
**Then** the empty-state component (FR8) re-appears.

**Test Scenarios:**

*Unit:*
- `todoService.deleteTodo()`: delegates to `repository.delete`; rethrows `NotFoundError`.
- `todosReducer.test.ts`: `todoDeleted` removes the matching todo immutably; other todos unchanged.
- `TodoItem.test.tsx`: clicking delete invokes the supplied callback with the todo id; control disabled while `isMutating`.
- `TodoFeature.test.tsx` (or `TodoList`): when the last todo is removed, `<EmptyState>` renders.

*Integration:* (backend, against test DB)
- `DELETE /api/todos/:id` removes the row; subsequent `GET /api/todos` does not include it.
- `DELETE /api/todos/:id` returns 204 with no body.
- `DELETE /api/todos/:id` against a non-existent id returns 404 with `code: 'NOT_FOUND'`.

*E2E:* (Playwright, NFR20 flow #5 — *delete-todo*)
- Add two todos; delete the first; assert it disappears and the second remains; delete the second; assert empty-state visible; reload; assert empty-state persists.

### Story 2.3: Visual distinction between active and completed todos

As an end user,
I want completed todos to look obviously different from active ones at a glance,
So that I can scan my list and instantly see what's done versus what's still to do. (Delivers FR6.)

**Acceptance Criteria:**

**Given** Story 2.1 is complete,
**When** Story 2.3 completes,
**Then** `apps/frontend/src/features/todos/todos.module.css` defines distinct visual treatments for active vs completed todos (e.g. completed todos have a strikethrough on description text and reduced contrast; active todos render at default contrast),
**And** the visual treatment is achieved via a CSS class applied conditionally based on the `completed` field (no inline styles),
**And** the visual distinction is observable without color alone (uses strikethrough / icon / weight, not hue alone — accessibility floor),
**And** the visual treatment is applied within `<TodoItem>` and respects `:focus-visible` styling (foundation for Epic 4).

**Given** a list with both active and completed todos,
**When** the page renders,
**Then** completed todos are visually distinguishable from active ones at a glance,
**And** a user with grayscale vision (or a color-blind-simulator filter) can still tell them apart.

**Test Scenarios:**

*Unit:*
- `TodoItem.test.tsx`: rendering with `completed: true` applies the expected CSS-modules class; rendering with `completed: false` does not.

*Integration:* none.
*E2E:* extends the *complete-todo* and *incomplete-todo* flows from Story 2.1 with an assertion that the toggled state's element has the completed-class applied (DOM assertion, not visual diff). No new Playwright spec file; assertion added to existing flow specs.

## Epic 3: Trust the App's Reliability

The app behaves predictably when things go wrong (transient network blip, backend restart, container restart, persistence outage) and gives the user clear feedback about state. Operators can verify health from outside the app.

### Story 3.1: Loading-state UI on initial fetch

As an end user,
I want to see a clear "loading" indication while my todos are being fetched on first open,
So that I know the app is alive and working, not broken or frozen. (Delivers FR9.)

**Acceptance Criteria:**

**Given** Story 1.8 is complete,
**When** Story 3.1 completes,
**Then** `apps/frontend/src/features/todos/LoadingState.tsx` renders a clearly visible loading indicator (text or spinner — UX/architect call within "doesn't look broken"),
**And** `<TodoFeature>` renders `<LoadingState>` while `useTodos` `status === 'loading'`,
**And** the loading state is **not** displayed during in-flight mutations (those use the per-control disabled state from Epic 2),
**And** the `<LoadingState>` does not require artificial delays — if the fetch returns instantly, the user briefly sees the loading state and then the loaded list, which is acceptable.

**Given** a fresh app load,
**When** the GET /api/todos request is in flight,
**Then** the loading state renders (not the empty state, not a blank page).

**Given** the request resolves with todos,
**When** the response is received,
**Then** the loading state is replaced by the todo list.

**Given** the request resolves with an empty array,
**When** the response is received,
**Then** the loading state is replaced by the empty state (FR8).

**Test Scenarios:**

*Unit:*
- `LoadingState.test.tsx`: renders the loading text/indicator.
- `TodoFeature.test.tsx`: with `useTodos` mocked to return `status: 'loading'`, renders `<LoadingState>`; with `status: 'loaded' && todos.length === 0`, renders `<EmptyState>`; with `status: 'loaded' && todos.length > 0`, renders `<TodoList>`.

*Integration:* none in this story.
*E2E:* extends the *create-todo* flow (Story 1.8) with an assertion that the loading state appears before the empty state on initial page load. No new spec file.

### Story 3.2: Error-state UI with retry on load and mutation failures

As an end user,
I want to see a clear error message when something goes wrong (network blip, backend down, etc.) and a "Try again" button to recover,
So that I trust the app fails visibly rather than silently and I can recover without reloading. (Delivers FR10, FR11.)

**Acceptance Criteria:**

**Given** Story 1.8 is complete,
**When** Story 3.2 completes,
**Then** `apps/frontend/src/features/todos/ErrorState.tsx` renders a clearly visible error message (using `error.message`, never `error.code`) and a "Try again" button,
**And** `<TodoFeature>` renders `<ErrorState>` when `useTodos` `status === 'error'` (initial-load failure) — without unmounting any todos that were already rendered before the failure,
**And** mutation failures (create / setCompleted / delete) populate `useTodos` `error` state without changing `status` from `'loaded'`, so existing todos remain visible while a small inline error is shown,
**And** clicking "Try again" on a load failure re-invokes the failed `list` operation,
**And** clicking "Try again" / dismiss on a mutation failure clears the inline error,
**And** the frontend never displays raw stack traces or `error.code` strings to the user (NFR12).

**Given** the backend is down at first load,
**When** I open `localhost:8080`,
**Then** the loading state renders briefly,
**And** the error state renders with a "Try again" button.

**Given** the error state is visible and the backend has recovered,
**When** I click "Try again",
**Then** the request retries, succeeds, and the list renders normally.

**Given** I have todos rendered and the backend goes down,
**When** I attempt to add a new todo,
**Then** the existing todos remain visible (NFR12),
**And** an inline error indicates the create failed,
**And** the existing list is **not** unmounted or replaced by `<ErrorState>`.

**Test Scenarios:**

*Unit:*
- `ErrorState.test.tsx`: renders `error.message` (not `error.code`); "Try again" button invokes the supplied callback.
- `todosReducer.test.ts`: `loadingFailed` sets `status: 'error'`; `mutationFailed` sets `error` but leaves `status: 'loaded'`.
- `useTodos.test.ts`: on load failure, exposes `{status: 'error', error}`; on mutation failure, exposes `{status: 'loaded', error}` with the existing todo array intact.

*Integration:* (backend, against test DB)
- (No new backend integration tests — error responses already tested in Epic 1 / 2.)

*E2E:* (Playwright, error path)
- Spin up the stack; stop the backend container mid-test (or use route mocking to inject a 500); assert error state appears; restart backend; click "Try again"; assert recovery. *(This contributes to flow coverage but doesn't count as a sixth NFR20 named flow — it strengthens the existing `create-todo` and `list-todos` flows with error-path branches.)*

### Story 3.3: Verify durability across refresh and container restart

As a developer,
I want integration and E2E tests that prove todos persist across browser refreshes and `docker compose down && docker compose up`,
So that the architecture's durability guarantees are continuously verified, not just hoped for. (Delivers FR12, FR13, FR14, plus NFR20 flow #2 — *list-todos*.)

**Acceptance Criteria:**

**Given** Stories 1.8 and 2.1 are complete,
**When** Story 3.3 completes,
**Then** `e2e/tests/list-todos.spec.ts` exists as the named NFR20 flow #2,
**And** the spec covers: open the app with a pre-seeded set of todos in the DB; assert the list renders all of them in `created_at DESC` order; reload the page; assert the same list is rendered (FR12 verification),
**And** a `tests/integration/persistence.test.ts` (backend) exists verifying: insert a row; close the pg pool; re-open it; row is still readable (FR13 simulation at the SQL level — does not actually restart Postgres),
**And** a documented manual verification step in `e2e/README.md` describes the full container-restart proof: `docker compose up`, add todos, `docker compose down`, `docker compose up`, reload, observe todos persist (FR13 — full verification is manual because automating `docker compose down/up` mid-Playwright is fragile),
**And** `useTodos.test.ts` is extended to verify FR14: state on mount always sources from the API response, never from a cached local-only value; if the API returns a different list than the previous render, state is replaced wholesale (no stale ghost rows).

**Given** a clean Postgres with three pre-seeded todos,
**When** the Playwright `list-todos` spec runs,
**Then** all three render in correct order and survive a page reload.

**Given** the developer follows the manual verification step in `e2e/README.md`,
**When** they perform `docker compose down && docker compose up` between adding and reading,
**Then** the todos persist (FR13).

**Test Scenarios:**

*Unit:*
- `useTodos.test.ts`: a second `list()` call with different data fully replaces local state; no merge / dedup logic that could mask stale ghost rows (FR14 invariant).

*Integration:* (backend, against test DB)
- `persistence.test.ts`: insert N todos via repository; close pg pool; re-create pg pool; query — all N rows present (FR13 simulation at the SQL level).

*E2E:* (Playwright)
- *list-todos* (NFR20 flow #2): pre-seed DB, open app, assert rendered list matches DB, reload, assert unchanged.
- Manual `docker compose` restart procedure documented in `e2e/README.md` (not automated; FR13 full verification).

### Story 3.4: Persistence-aware health endpoint with state-transition logging

As an operator (or curious dev),
I want `GET /api/health` to reflect both backend and persistence-layer health, with log lines on every state transition (and *only* on transitions),
So that I can read `docker compose logs` and instantly see when persistence flips up/down without drowning in steady-state probe noise. (Delivers FR15, FR16 — replaces the basic health endpoint from Story 1.4.)

**Acceptance Criteria:**

**Given** Story 1.4 is complete,
**When** Story 3.4 completes,
**Then** `apps/backend/src/db/client.ts` exports a `probePersistence()` function that runs `SELECT 1` and resolves to `'up' | 'down'`,
**And** `apps/backend/src/controllers/healthController.ts` is upgraded to call `probePersistence()` on each `/api/health` request,
**And** `GET /api/health` response is `{status: 'healthy', persistence: 'up'}` when both are healthy; `{status: 'unhealthy', persistence: 'down'}` (HTTP 503) when persistence probe fails,
**And** the controller maintains an in-memory `lastPersistenceUp: boolean | null` and emits a structured log line **only on transition** — `info { event: 'health.persistence.up', previous: 'down' }` on down→up, `warn { event: 'health.persistence.down', previous: 'up', error: <msg> }` on up→down,
**And** steady-state probes emit no log lines (the `logLevel: 'warn'` registration from Story 1.4 stays in place; transition log lines bypass it via direct logger usage),
**And** the response body is validated against `HealthResponseSchema` from `packages/shared`.

**Given** Postgres is healthy,
**When** I `curl http://backend:3000/api/health` repeatedly,
**Then** I get `200 {"status":"healthy","persistence":"up"}` each time,
**And** **no** new log lines appear in `docker compose logs backend` for those probes.

**Given** Postgres is stopped,
**When** the backend's next `/api/health` probe runs (Docker's interval),
**Then** the probe returns `503 {"status":"unhealthy","persistence":"down"}`,
**And** **one** `warn` log line `health.persistence.down` is emitted on the first failed probe; subsequent failed probes are silent.

**Given** Postgres is restarted (back to healthy),
**When** the next probe runs,
**Then** **one** `info` log line `health.persistence.up` is emitted,
**And** subsequent probes are silent again.

**Given** the documented log-grep recipes (architecture doc),
**When** I run `docker compose logs backend | grep 'health.persistence'`,
**Then** I see only the transition events, not steady-state noise.

**Test Scenarios:**

*Unit:*
- `healthController.test.ts`: state-transition logic — given `lastPersistenceUp: null` and probe `up`, emits an `info` line; given `lastPersistenceUp: true` and probe `up`, emits no line; given `lastPersistenceUp: true` and probe `down`, emits a `warn` line; given `lastPersistenceUp: false` and probe `down`, emits no line.
- `db/client.test.ts`: `probePersistence` returns `'up'` when `SELECT 1` resolves; returns `'down'` when it throws.

*Integration:* (backend, against test DB)
- `GET /api/health` with Postgres up returns `200 {status:'healthy', persistence:'up'}`.
- `GET /api/health` with Postgres connection broken (e.g. point `DATABASE_URL` at an unreachable host) returns `503 {status:'unhealthy', persistence:'down'}`.
- Log capture verifies a single `health.persistence.down` entry on first failure; no further entries on subsequent failures.

*E2E:* none directly (health endpoint is operator-facing, not user-facing). The Docker-level healthcheck verifies it indirectly — when persistence is down, the backend container becomes unhealthy in `docker compose ps`.

## Epic 4: Universal Access — Responsive & Accessible

The app works correctly at desktop and mobile viewport sizes (in both orientations on mobile) and is fully usable with keyboard alone and with assistive technology consistent with WCAG 2.2 Level A.

### Story 4.1: Responsive layout for desktop (≥ 1024 px) and mobile (≥ 360 px)

As an end user,
I want the app to render and function correctly on my desktop browser and on my phone (in either orientation),
So that I can use the app wherever I am without controls being unreachable or layouts breaking. (Delivers FR17, FR18.)

**Acceptance Criteria:**

**Given** Stories 1.8, 2.1, 2.2, 2.3 are complete,
**When** Story 4.1 completes,
**Then** `apps/frontend/src/styles/globals.css` includes a fluid-but-bounded layout that adapts to the viewport,
**And** `apps/frontend/src/features/todos/todos.module.css` defines responsive rules (CSS Grid / Flexbox / container queries — architect's call) such that all controls remain reachable and visible at viewport widths from 360 px to ≥ 1024 px,
**And** `<TodoFeature>`, `<TodoList>`, `<TodoItem>`, `<AddTodoForm>`, `<EmptyState>`, `<LoadingState>`, `<ErrorState>` all render without horizontal scrollbars at 360 px width,
**And** all interactive controls remain reachable (no controls clipped off-screen, no overlapping elements blocking clicks/taps) at 360 px width,
**And** the same is true at 1024 px width and at common intermediate widths (768 px tablet),
**And** mobile portrait (e.g. 360 × 640) and mobile landscape (e.g. 640 × 360) both render functionally,
**And** the layout uses `rem` / `em` or relative units rather than fixed `px` for typography (supports user-controlled text scaling),
**And** no inline styles are used for layout (CSS modules / globals only).

**Given** a viewport of 360 px width,
**When** I render the app with several todos and the AddTodoForm,
**Then** all elements fit on screen without horizontal scrolling,
**And** the AddTodoForm's input + submit button are both reachable and usable.

**Given** a viewport of 1024 px width,
**When** I render the same content,
**Then** the layout uses the additional space sensibly (e.g. wider list, larger touch targets, comfortable padding) without becoming unreadably stretched.

**Given** a mobile viewport in portrait that I rotate to landscape,
**When** the orientation change fires,
**Then** the app re-flows and remains usable in landscape.

**Test Scenarios:**

*Unit:*
- `TodoFeature.test.tsx`: a snapshot or DOM-assertion test asserts the responsive class structure is applied (the *behavior* — actual visual fidelity — is covered by E2E viewport tests).

*Integration:* none.

*E2E:* (Playwright)
- New spec `e2e/tests/responsive.spec.ts`: for each named viewport (`desktop` 1280×720, `tablet` 768×1024, `mobile-portrait` 360×640, `mobile-landscape` 640×360), open the app with seeded data, assert no horizontal scrollbar on `body`, assert all critical controls (`AddTodoForm` input, submit, each `TodoItem` toggle, each delete button) are visible and clickable.
- Existing flow specs (`create-todo`, `list-todos`, `complete-todo`, `incomplete-todo`, `delete-todo`) gain a `mobile-portrait` project in `playwright.config.ts` so each flow runs at both desktop and mobile width.

### Story 4.2: Keyboard accessibility and WCAG 2.2 Level A automated verification

As an end user with a keyboard or assistive technology,
I want the app to be fully usable without a pointer device and to pass automated WCAG 2.2 Level A checks,
So that I can use the app regardless of input modality or assistive tooling. (Delivers FR19, FR20, NFR8, NFR9.)

**Acceptance Criteria:**

**Given** Stories 1.8, 2.1, 2.2, 2.3, 3.2 are complete,
**When** Story 4.2 completes,
**Then** every interactive control in the app is reachable via the Tab key in a sensible order (no focus traps, no controls reachable only via pointer),
**And** every interactive control has a visible `:focus-visible` indicator (foundation laid in 2.3; this story confirms it across all controls),
**And** semantic HTML is used throughout (`<form>`, `<button>`, `<input>`, `<label>`, `<ul>` / `<li>` for the list, etc.) — not generic `<div>` with click handlers,
**And** every interactive control has an accessible name (`<label>` for inputs, button text or `aria-label` for icon-only buttons, etc.),
**And** the page has a meaningful `<title>` (already established in Story 1.5) and a single `<h1>` (e.g. "bmad-todo"),
**And** images (favicon excluded) carry `alt` text or `alt=""` per their semantic role,
**And** no keyboard traps exist (Tab + Shift-Tab cycle works in both directions across all components),
**And** `e2e/tests/accessibility.spec.ts` exists and runs `@axe-core/playwright` against the app at the `loaded` state (with todos present), at the empty state, at the loading state (mocked), and at the error state (mocked),
**And** the axe scan asserts **zero violations** at WCAG 2.2 Level A scope across all four states,
**And** the GHA `e2e` job runs `accessibility.spec.ts` and fails the pipeline on any Level A violation.

**Given** the app is rendered with three todos,
**When** I navigate using only the Tab key,
**Then** focus moves in order: AddTodoForm input → AddTodoForm submit → TodoItem 1 toggle → TodoItem 1 delete → TodoItem 2 toggle → … (or another sensible reading order),
**And** each focused element shows a visible focus ring,
**And** I can activate every control using Enter (buttons) or Space (toggles).

**Given** the axe-core scan runs,
**When** it finishes scanning each of the four states (loaded, empty, loading, error),
**Then** zero violations at WCAG 2.2 Level A scope are reported.

**Test Scenarios:**

*Unit:*
- `AddTodoForm.test.tsx`: input has an associated `<label>`; submit button has accessible text.
- `TodoItem.test.tsx`: toggle has accessible name including the todo's description (e.g. `aria-label="Mark 'Buy milk' as complete"`); delete button has accessible name (e.g. `aria-label="Delete 'Buy milk'"`).
- `EmptyState.test.tsx`, `LoadingState.test.tsx`, `ErrorState.test.tsx`: each renders semantic content (heading or status role as appropriate) rather than untagged `<div>` text.

*Integration:* none.

*E2E:* (Playwright + axe-core)
- `e2e/tests/accessibility.spec.ts`: scans the four states, asserts zero Level A violations each.
- Keyboard-only flow spec: `e2e/tests/keyboard.spec.ts` — open app, navigate with Tab to AddTodoForm, type a description, press Enter, assert todo created; Tab to its toggle, Space, assert completed; Tab to delete, Enter, assert deleted. (No new NFR20 named flow — strengthens existing flows with keyboard-only assertions.)

### Story 4.3: Final NFR20 acceptance run and README finalization

As Aman (project sponsor),
I want a final check that the v1 commitment holds — five Playwright flows pass, accessibility scan passes, coverage thresholds met, and the README's 15-minute first-run claim is verified by an actual fresh-machine run,
So that I can sign off on v1 with confidence the artifact chain matches what was promised. (Delivers NFR16's testable claim and NFR20's full coverage tally; closes v1.)

**Acceptance Criteria:**

**Given** all prior stories (1.1 through 4.2) are complete,
**When** Story 4.3 completes,
**Then** the root `README.md` is fully populated per the layered-README plan in the architecture document — Quick Start, Prerequisites, env-var reference, common commands (`docker compose up`, `npm test`, `npm run lint`, etc.), a Troubleshooting section,
**And** `apps/backend/README.md`, `apps/frontend/README.md`, `packages/shared/README.md`, `e2e/README.md` are each finalized (they were stubbed during their package's first scaffolding story; this story polishes them),
**And** a documented "fresh-machine first-run" verification procedure is included in the root README (steps: prerequisite check, clone, populate `.env` from `.env.example`, run `docker compose up --wait`, open `localhost:8080`),
**And** the verification procedure is timed by a developer unfamiliar with the project (Aman or a teammate) and the elapsed time is ≤ 15 minutes (NFR16),
**And** all five named NFR20 Playwright flows exist and pass: `create-todo`, `list-todos`, `complete-todo`, `incomplete-todo`, `delete-todo`,
**And** `accessibility.spec.ts` passes at WCAG 2.2 Level A,
**And** Vitest coverage reports show ≥ 70% on both backend and frontend,
**And** `npm run lint && npm run format:check` pass at the workspace root,
**And** the GHA pipeline is green on `main`.

**Given** a fresh machine with only Docker installed,
**When** I follow the README's first-run procedure end-to-end,
**Then** I reach `docker compose up --wait` succeeding within 15 minutes (NFR16 acceptance).

**Given** the CI pipeline runs on `main`,
**When** all jobs complete,
**Then** lint, typecheck, test, build, and e2e are all green,
**And** Vitest coverage reports for backend and frontend each show ≥ 70% meaningful coverage,
**And** Playwright reports all 6+ specs passing (5 NFR20 flows + accessibility + responsive + keyboard).

**Test Scenarios:**

*Unit:* none new — coverage thresholds enforced by Vitest config established in Stories 1.4 and 1.5.

*Integration:* none new.

*E2E:* this story does not add new specs. It verifies the existing suite's completeness:
- All five named NFR20 flows pass (create / list / complete / incomplete / delete).
- `accessibility.spec.ts` passes at Level A.
- `responsive.spec.ts` passes at all four named viewports.
- `keyboard.spec.ts` passes for the keyboard-only flow.

*Manual acceptance:*
- Fresh-machine first-run timing verifies NFR16.
