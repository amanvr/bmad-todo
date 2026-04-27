# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo state

This repository is currently a **BMad-method planning repository** — the application code has not been written yet. There is no `package.json`, no source tree, and no build / test / lint commands to run. The implementation is queued behind a fully-validated planning chain.

Once Story 1.1 from `_bmad-output/planning-artifacts/epics.md` is executed, the layout described in the *Project Structure & Boundaries* section of `architecture.md` will materialize (`apps/backend`, `apps/frontend`, `packages/shared`, `e2e/`, `docker-compose.yml`, etc.). At that point the commands listed in the *Once implementation has started* section below become real.

## Authoritative planning artifacts

These five files are the source of truth. **Read them in order if you need full context** — each consumes the prior:

1. `_bmad-output/planning-artifacts/product-brief.md` — strategic framing, scope discipline, stakeholder constraints.
2. `_bmad-output/planning-artifacts/prd.md` — binding capability contract: 23 FRs (`FR1`–`FR23`) and 23 NFRs (`NFR1`–`NFR23`).
3. `_bmad-output/planning-artifacts/prd-validation-report.md` — Pass / 5-of-5 holistic.
4. `_bmad-output/planning-artifacts/architecture.md` — every architectural decision with rationale, alternatives, layering rules, naming conventions, anti-patterns.
5. `_bmad-output/planning-artifacts/epics.md` — 4 epics, 18 stories, sequenced 1.1 → 4.3. Each story ships with Given/When/Then ACs **plus** explicit `Test Scenarios` blocks (Unit / Integration / E2E).

## Implementation pattern (story-driven)

Implementation runs **one story at a time**, sequentially through `epics.md` (Story 1.1, then 1.2, …). Each story:

- Cites the FRs and/or NFRs it implements — never invent capabilities outside that list.
- Lists exact files to create/modify in its acceptance criteria.
- Names which Test Scenarios (Unit / Integration / E2E) to write, and at which layer.

**Do not:**

- Skip ahead or implement multiple stories' worth of code in one pass — the story is the review unit.
- Add features outside the FR list. The PRD is binding; anything not in it does not ship in v1.
- Pre-build any of the four architecturally-non-foreclosed capabilities (multi-user/auth, per-todo metadata, real-time sync, audit log). The architecture deliberately leaves seams without populating them.

If a story's AC is ambiguous or contradicts an architectural decision, **raise it via `bmad-correct-course`** — do not silently diverge. The PRD's *Process Success* metric explicitly counts "did the dev team need to ask for clarification?" as a measurement; surfacing ambiguity is the correct path.

## Stakeholder-imposed constraints (not up for re-litigation)

From the brief and architecture, fixed:

- Backend runtime: **Fastify** (Node.js, TypeScript strict).
- Frontend framework: **React** (TypeScript strict, Vite, CSS modules, no state-management library — `useReducer` + Context only).
- Persistence: **PostgreSQL 16+** in a sidecar container, accessed via **Drizzle ORM** + Drizzle Kit. Postgres port **not** exposed to the host.
- Validation: **Zod** schemas authored once in `packages/shared/`, applied via `@fastify/type-provider-zod` on the backend and as types on the frontend.
- E2E: **Playwright** + `@axe-core/playwright`. Five named flows covering the full CRUD set (create / list / complete / incomplete / delete).
- Unit / component / integration tests: **Vitest** on both backend and frontend (single tool, single config story). Coverage threshold ≥ 70% meaningful, enforced per package.
- Lint / format: **ESLint 9 (flat config) + Prettier**.
- CI: **GitHub Actions** — pipeline `lint → typecheck → test → build → e2e`.
- Deployment: **local-only, Dockerized**, single-command `docker compose up`. No cloud.
- Accessibility: **WCAG 2.2 Level A**, automated-scanner-verified, zero violations.
- Browser matrix: latest 2 stable Chrome / Firefox / Safari / Edge.
- Cross-OS: Linux / macOS / Windows hosts via Docker.

## Architectural disciplines that apply throughout implementation

Codified in `architecture.md` *Implementation Patterns & Consistency Rules* — the rules every story must respect:

- **Backend layering is one-way:** controllers → services → repositories → db. **Never** import "up" the stack. Controllers do HTTP only; services hold business logic with no SQL/HTTP awareness; repositories isolate persistence behind a typed interface (`TodoRepository`). The repository interface is the non-foreclosure seam — caching, audit-log capture, and future real-time triggers all land here.
- **Frontend feature-folder layout:** `apps/frontend/src/features/<feature>/`. Components consume the feature's hook (`useTodos`); the hook consumes `api.ts`; nothing else should call `fetch` directly.
- **Shared package authoring rule:** API-contract changes (Zod schemas) edit `packages/shared/` **first**, then both apps update. The shared package is types-only — no runtime code.
- **Auth-readiness seam from day one:** every service-layer call is parameterized by `userId: string`. Story 1.4 ships a Fastify plugin that hard-codes `request.userId = 'default-user'`. When auth lands later, only that plugin changes — no service / repository / persistence rewrite.
- **Naming conventions:** `snake_case` at the DB; `camelCase` over the wire (Drizzle column aliases bridge); `PascalCase` for React components and TypeScript types; `camelCase` for hooks (`useFoo`) and utility files.
- **Errors are typed and thrown** (`AppError` and subclasses); a single Fastify `setErrorHandler` maps them to the `{ error: { code, message, details? } }` envelope. Codes enumerated in `packages/shared/errors.ts`. Never return error objects, never use null-as-error.
- **State updates are immutable.** Reducer actions are past-tense (`todoCreated`, `todosLoaded`) — never command-style.
- **Pessimistic UI updates only in v1.** Wait for server confirmation before reflecting in the UI. (Optimistic updates are non-foreclosed for later.)

## Once implementation has started

After Story 1.1 (`Scaffold the workspace monorepo and shared tooling`) ships, the standard development commands will be available at the repo root:

- `npm ci` — install workspace dependencies.
- `npm run lint` — ESLint across all workspaces.
- `npm run format:check` — Prettier check.
- `npm run typecheck` — TypeScript across all workspaces (`tsc --build`).
- `npm run test` — Vitest unit + component tests across all workspaces.
- `npm run test:integration` — backend integration tests (requires `docker compose up postgres -d`).
- `npm run test:e2e` — Playwright E2E suite (requires `docker compose up --wait`).
- `docker compose up --wait` — local stack: `frontend` (nginx :8080), `backend` (Fastify, internal :3000), `postgres` (sidecar, internal :5432).

To run a single test file in any package, use Vitest's filter directly: `npm test -- path/to/file.test.ts` (or `npx vitest run path/to/file.test.ts` from inside the package).

## BMad workflow tooling

The `.claude/skills/` directory holds the BMad-method skill scaffolds. Common entry points relevant to implementation:

- `/bmad-agent-dev` — Amelia (developer persona). Story execution.
- `/bmad-dev-story` — direct story implementation, expects a story id (e.g. `1.1`, `1.2`).
- `/bmad-correct-course` — when an architectural assumption no longer holds and the plan needs revision before continuing.
- `/bmad-check-implementation-readiness` — pre-implementation cross-artifact alignment check (recommended before Story 1.1).
- `/bmad-sprint-status` — read-only status snapshot across the epics.
- `/bmad-help` — what's still available in the BMad workflow.

The `_bmad/_config/manifest.yaml` `ides:` array lists which IDEs the BMad adapters target (currently `[claude-code]`). The `customize.toml` files in each skill are regenerated by the installer — don't hand-edit them; use `_bmad/custom/*.toml` for overrides.

## What's deliberately out of scope for v1

From `prd.md` *Product Scope* — features that are non-foreclosed at the architecture level but **must not be built** in v1: multi-user / authentication, per-todo metadata (priority / due date / tags), real-time sync / collaboration, audit log of changes. Implementing any of these in a v1 story is a scope violation; raise via `bmad-correct-course` if the need surfaces.
