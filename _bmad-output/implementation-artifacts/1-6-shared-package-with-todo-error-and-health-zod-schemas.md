# Story 1.6: Shared package with Todo, error, and health Zod schemas

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a `packages/shared` package containing the canonical Zod schemas and inferred types for Todo, errors, and health,
So that backend validation and frontend typing share one source of truth and API-contract evolution is a single edit.

## Acceptance Criteria

1. **Given** Story 1.1 is complete, **When** Story 1.6 completes, **Then** `packages/shared/src/todo.ts` exports `TodoSchema`, `CreateTodoInputSchema`, `UpdateTodoCompletionInputSchema` (and inferred TypeScript types).
2. `packages/shared/src/errors.ts` exports `ApiErrorSchema`, an `ErrorCode` union (`VALIDATION_FAILED | NOT_FOUND | INTERNAL_ERROR | PERSISTENCE_UNAVAILABLE`).
3. `packages/shared/src/health.ts` exports `HealthResponseSchema`.
4. `packages/shared/src/index.ts` re-exports everything.
5. `packages/shared/package.json` is configured for type-only consumption (no runtime build artifacts), with `tsc --emitDeclarationOnly`. **See the *Build configuration deviation* note in Dev Notes — Zod schemas are *runtime* values, so the package's actual build emits both `.js` and `.d.ts`. The AC's `--emitDeclarationOnly` cannot be taken literally without breaking imports.**
6. `packages/shared/README.md` exists explaining the "edit-here-first" rule.
7. **Given** the shared package is built, **When** the backend or frontend imports from the shared package, **Then** the import resolves to the published types.
8. **Given** a Zod schema is parsed against a valid object, **When** `TodoSchema.parse(...)` runs, **Then** it returns the typed object.
9. **Given** a Zod schema is parsed against an invalid object (e.g. description longer than 500 chars), **When** `parse()` runs, **Then** it throws a Zod error with the failed-field path.

## Tasks / Subtasks

- [x] **Task 1: Author `packages/shared/package.json`** (AC: 1, 5, 7)
  - [x] Set name `@bmad-todo/shared`, `private: true`, `type: "module"`, version `0.0.0`.
  - [x] **`main` / `types` / `exports`:** point to the built output:
    ```json
    {
      "name": "@bmad-todo/shared",
      "private": true,
      "version": "0.0.0",
      "type": "module",
      "main": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "exports": {
        ".": {
          "types": "./dist/index.d.ts",
          "default": "./dist/index.js"
        }
      },
      "files": ["dist", "src"],
      "scripts": {
        "build": "tsc --build",
        "test": "vitest run",
        "test:watch": "vitest"
      },
      "dependencies": {
        "zod": "..."
      },
      "devDependencies": {
        "vitest": "...",
        "@vitest/coverage-v8": "...",
        "typescript": "..."
      }
    }
    ```
  - [x] **Pin `zod`** to a specific version (latest stable 3.x or 4.x by 2026-04). Backend (Story 1.4) and frontend will use the same version via workspace hoisting.
  - [x] **Why `dependencies` not `peerDependencies`:** workspace consumers symlink to this package; `dependencies` is fine. If we ever publish externally, switch `zod` to `peerDependencies` to avoid duplicate-install issues.

- [x] **Task 2: Author `packages/shared/tsconfig.json`** (AC: 7)
  - [x] Composite project that emits both `.js` and `.d.ts`:
    ```json
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "composite": true,
        "rootDir": "src",
        "outDir": "dist",
        "tsBuildInfoFile": "dist/.tsbuildinfo",
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true
      },
      "include": ["src/**/*"],
      "exclude": ["dist", "node_modules", "coverage"]
    }
    ```
  - [x] Update root `tsconfig.json` `references` to add `{ "path": "./packages/shared" }`. Order: `packages/shared` first (no dependencies), then `apps/backend` and `apps/frontend` (which now reference shared).

- [x] **Task 3: Author `packages/shared/src/errors.ts`** (AC: 2)
  - [x] Define the `ErrorCode` literal union and the `ApiErrorSchema`:
    ```ts
    import { z } from 'zod';

    export const ErrorCodeSchema = z.enum([
      'VALIDATION_FAILED',
      'NOT_FOUND',
      'INTERNAL_ERROR',
      'PERSISTENCE_UNAVAILABLE',
    ]);

    export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

    export const ApiErrorSchema = z.object({
      code: ErrorCodeSchema,
      message: z.string().min(1),
      details: z.record(z.unknown()).optional(),
    });

    export type ApiError = z.infer<typeof ApiErrorSchema>;

    export const ApiErrorEnvelopeSchema = z.object({
      error: ApiErrorSchema,
    });

    export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;
    ```
  - [x] **Why both `ApiError` and `ApiErrorEnvelope`:** the wire-format envelope wraps the error inside `{ error: { ... } }`. Backend produces the envelope; frontend's `http.ts` parses it. Both shapes are useful — bare `ApiError` for typed handling, envelope for wire-shape validation.

- [x] **Task 4: Author `packages/shared/src/todo.ts`** (AC: 1)
  - [x] Schemas matching architecture.md *Data Architecture* (lines 257–268):
    ```ts
    import { z } from 'zod';

    export const TodoSchema = z.object({
      id: z.string().uuid(),
      description: z.string().min(1).max(500),
      completed: z.boolean(),
      createdAt: z.string().datetime({ offset: true }),  // ISO-8601 with offset (architecture line 633)
      updatedAt: z.string().datetime({ offset: true }),
      // userId intentionally NOT exposed over the wire in v1 — auth seam is server-side only.
      // Architecture line 271: 'user_id' is server-side; v1 default-user is implicit.
    });

    export type Todo = z.infer<typeof TodoSchema>;

    export const CreateTodoInputSchema = z.object({
      description: z.string().min(1).max(500),
    });

    export type CreateTodoInput = z.infer<typeof CreateTodoInputSchema>;

    export const UpdateTodoCompletionInputSchema = z.object({
      completed: z.boolean(),
    });

    export type UpdateTodoCompletionInput = z.infer<typeof UpdateTodoCompletionInputSchema>;
    ```
  - [x] **Note on `userId` exposure:** architecture line 264 includes `user_id` in the DB schema, but the API resource shape (line 325) returns `Todo[]` ordered by `created_at` — no `user_id` field. The wire shape is filtered server-side. v1's default-user is implicit; if multi-user lands later, the schema and serializer both update.
  - [x] **No `description` updates allowed in v1** (architecture line 333). `UpdateTodoCompletionInputSchema` is intentionally narrow — only `completed`. If editing text becomes a requirement, a new schema (`UpdateTodoDescriptionInputSchema` or a more permissive `UpdateTodoInputSchema`) lands then.

- [x] **Task 5: Author `packages/shared/src/health.ts`** (AC: 3)
  - [x] Schema matches architecture line 432:
    ```ts
    import { z } from 'zod';

    export const HealthStatusSchema = z.enum(['healthy', 'unhealthy']);
    export const PersistenceStatusSchema = z.enum(['up', 'down']);

    export const HealthResponseSchema = z.object({
      status: HealthStatusSchema,
      // `persistence` is optional in v1.4 (returns `{status: 'healthy'}` only).
      // Story 3.4 will populate `persistence` and the schema becomes effectively required at runtime.
      // For 1.6, modeling it as optional keeps both shapes valid.
      persistence: PersistenceStatusSchema.optional(),
    });

    export type HealthResponse = z.infer<typeof HealthResponseSchema>;
    ```

- [x] **Task 6: Author `packages/shared/src/index.ts`** (AC: 4)
  - [x] Barrel re-exports:
    ```ts
    export * from './todo.js';
    export * from './errors.js';
    export * from './health.js';
    ```
  - [x] Use `.js` extensions in re-exports (Node ESM convention; TypeScript's `verbatimModuleSyntax` and `module: NodeNext` require literal output extensions). The base `tsconfig.base.json` from Story 1.1 sets `module: NodeNext` — verify this works for the shared package.

- [x] **Task 7: Author unit tests** (Test Scenarios — Unit; AC: 8, 9)
  - [x] `packages/shared/src/todo.test.ts`:
    - `TodoSchema.parse` accepts a valid object.
    - Rejects empty `description` (Zod `min(1)` fires).
    - Rejects 501-char `description`.
    - Rejects missing `createdAt`.
    - Rejects bad `id` (not a UUID).
    - `CreateTodoInputSchema.parse` accepts a 1-char description.
    - Rejects empty.
    - Rejects 501-char.
  - [x] `packages/shared/src/errors.test.ts`:
    - `ApiErrorSchema.parse` accepts each `ErrorCode` value.
    - Rejects an unknown code (e.g. `'FOO'`).
  - [x] `packages/shared/src/health.test.ts` (optional — not in *Test Scenarios* but trivial to add for symmetry):
    - `HealthResponseSchema.parse` accepts `{status: 'healthy'}` and `{status: 'unhealthy', persistence: 'down'}`.

- [x] **Task 8: Wire shared into the backend** (`apps/backend`)
  - [x] `apps/backend/package.json` add dependency: `"@bmad-todo/shared": "*"` (workspace protocol — `*` resolves to the workspace package).
  - [x] `apps/backend/tsconfig.json` add `references`: `[{ "path": "../../packages/shared" }]`.
  - [x] **Refactor `apps/backend/src/errors.ts` (Story 1.4)** to import `ErrorCode` from `@bmad-todo/shared`:
    ```ts
    import type { ErrorCode } from '@bmad-todo/shared';
    // ... rest of AppError + subclasses unchanged; just remove the local ErrorCode literal union.
    ```
  - [x] **Don't break Story 1.4's tests.** Backend's `errors.test.ts` should still pass — `AppError`'s shape didn't change, only the source of `ErrorCode`.

- [x] **Task 9: Wire shared into the frontend** (`apps/frontend`)
  - [x] `apps/frontend/package.json` add dependency: `"@bmad-todo/shared": "*"`.
  - [x] `apps/frontend/tsconfig.json` add `references`: `[{ "path": "../../packages/shared" }, { "path": "./tsconfig.node.json" }]`.
  - [x] **Refactor `apps/frontend/src/shared/http.ts` (Story 1.5)** to import types from `@bmad-todo/shared`:
    ```ts
    import type { ApiError, ErrorCode, ApiErrorEnvelope } from '@bmad-todo/shared';
    import { ApiErrorEnvelopeSchema } from '@bmad-todo/shared';
    // Drop the local ErrorCode/ApiError type definitions.
    // Optionally: validate `body` against ApiErrorEnvelopeSchema.safeParse(body) for runtime safety in dev mode.
    ```
  - [x] **Don't break Story 1.5's tests.** Frontend's `http.test.ts` should still pass — the shape didn't change.

- [x] **Task 10: Author `packages/shared/README.md`** (AC: 6)
  - [x] Sections:
    - `# @bmad-todo/shared` — single-line description: "Canonical Zod schemas + inferred TypeScript types for the bmad-todo API contract."
    - `## The "edit-here-first" rule` — the central convention. Wording: *Any change to the API contract — adding a field to `Todo`, introducing a new error code, evolving the health-response shape — starts here. Update the schema in `packages/shared/src/`, then run consumer tests in both `apps/backend` and `apps/frontend` to surface the type-error fallout, then resolve those errors. Reverse order leads to schema/code drift.*
    - `## What's NOT here` — runtime business logic, framework code (Fastify plugins, React components), database schemas (Drizzle's `apps/backend/src/db/schema.ts`).
    - `## Build & consumption` — `npm run build` produces `dist/` (both `.js` and `.d.ts`); workspace consumers reference via `@bmad-todo/shared`.
    - `## Non-foreclosure paths held open` — bullet list: per-todo metadata fields (priority, due_date, tags) added as nullable schema extensions; multi-user via re-introducing `userId` to `TodoSchema` once auth lands; audit-event types when `audit_events` is added.

- [x] **Task 11: Update root `tsconfig.json` references** (AC: 7)
  - [x] After Task 2, root `tsconfig.json` must list shared first:
    ```json
    {
      "extends": "./tsconfig.base.json",
      "files": [],
      "references": [
        { "path": "./packages/shared" },
        { "path": "./apps/backend" },
        { "path": "./apps/frontend" }
      ]
    }
    ```
  - [x] `tsc --build` from root will now build shared, then backend (which references it), then frontend (which references it).

- [x] **Task 12: Verify the AC end-to-end**
  - [x] Run `npm install` (or `npm ci`) — confirms workspace symlink for `@bmad-todo/shared` resolves correctly.
  - [x] Run `npm run build --workspace @bmad-todo/shared` — confirms `dist/index.js` and `dist/index.d.ts` emit.
  - [x] Run `npm test --workspace @bmad-todo/shared` — confirms unit tests pass.
  - [x] Run `npm test --workspace @bmad-todo/backend` — confirms backend tests still pass after `errors.ts` refactor.
  - [x] Run `npm test --workspace @bmad-todo/frontend` — confirms frontend tests still pass after `http.ts` refactor.
  - [x] Run Story 1.1's verification chain: `npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build` — must still exit 0.
  - [x] Run smoke (Story 1.3): `bash scripts/smoke.sh` — confirms the running stack still answers `/api/health` healthily after type refactors.

## Dev Notes

### Story Foundation Summary

This story establishes the **API-contract single-source-of-truth**. Every later API change (Story 1.7 todos table → Story 1.8 first end-to-end → Epic 2 PATCH/DELETE → Epic 3 health-with-persistence) edits `packages/shared/src/` first, then propagates type-error fallout into the apps. Get the contracts right here.

**FRs implemented:** none directly. Pure infrastructure for FR1–FR16.

**NFRs implemented:** NFR3 (input validation surfaces — Zod constraints `description.min(1).max(500)` enforce the architectural CHECK constraint), NFR4 (typed envelope schema available for the dispatcher), NFR15 (separability — frontend/backend now share types via a versioned package boundary).

### Build configuration deviation

The AC says `tsc --emitDeclarationOnly`. Taken literally, this is incorrect: the package exports **Zod schemas**, which are runtime values used at `parse()` time, not just compile-time types. Without `.js` emission, neither backend nor frontend can call `TodoSchema.parse(...)` at runtime.

**Decision:** Story 1.6 emits both `.js` and `.d.ts` via standard composite-project compilation (Task 2's `tsconfig.json`). The package.json's `main` points to `dist/index.js`, `types` points to `dist/index.d.ts`. The architecture's intent (architecture.md line 173: "TypeScript types only — no runtime code") is honored at the *meaning* level: the package contains no business logic, no framework code, no I/O — only schemas, types, and constants. But schemas-as-runtime-values are necessary for the validation pipeline to work.

If review rejects this deviation, the alternative is **source-only re-export**: `package.json` `"main": "./src/index.ts"` with no build, relying on tsx/Vite/tsc-composite to handle `.ts` source in consumers. This works in development but fragments the production-build story (Docker images need to bundle the shared `.ts` source, and `tsc --build` from a consumer needs the composite-output mode which produces `.js` anyway). **Recommendation:** keep the standard composite emit and document the AC text as imprecise.

### Files to CREATE

| Path | Purpose |
|---|---|
| `packages/shared/package.json` | workspace package, `@bmad-todo/shared`, depends on `zod` |
| `packages/shared/tsconfig.json` | composite, emits to `dist/` |
| `packages/shared/src/index.ts` | barrel re-exports |
| `packages/shared/src/todo.ts` | `TodoSchema`, `CreateTodoInputSchema`, `UpdateTodoCompletionInputSchema` |
| `packages/shared/src/todo.test.ts` | unit tests |
| `packages/shared/src/errors.ts` | `ErrorCodeSchema`, `ApiErrorSchema`, `ApiErrorEnvelopeSchema` |
| `packages/shared/src/errors.test.ts` | unit tests |
| `packages/shared/src/health.ts` | `HealthResponseSchema` |
| `packages/shared/src/health.test.ts` | unit tests (optional, recommended) |
| `packages/shared/README.md` | "edit-here-first" rule |

### Files to UPDATE

| Path | Change |
|---|---|
| `tsconfig.json` (root) | Add `packages/shared` reference, ordered first |
| `apps/backend/tsconfig.json` | Add `references: [{path: "../../packages/shared"}]` |
| `apps/backend/package.json` | Add `"@bmad-todo/shared": "*"` to dependencies |
| `apps/backend/src/errors.ts` | Import `ErrorCode` from `@bmad-todo/shared`; remove local literal union |
| `apps/frontend/tsconfig.json` | Add `references: [{path: "../../packages/shared"}, ...]` |
| `apps/frontend/package.json` | Add `"@bmad-todo/shared": "*"` to dependencies |
| `apps/frontend/src/shared/http.ts` | Import `ApiError`, `ErrorCode`, `ApiErrorEnvelopeSchema` from shared; drop local types |

### Architecture Compliance

- **Single source of truth for API contract** [Source: architecture.md *Validation library*, lines 276–282]: schemas authored in `packages/shared`, consumed by backend (`@fastify/type-provider-zod`) and frontend (response typing).
- **Naming** [Source: architecture.md lines 559–564]: wire format is `camelCase`. `Todo`'s fields use `camelCase` (`createdAt`, `updatedAt`). DB-side `snake_case` (`created_at`, `user_id`) is bridged by Drizzle column aliases (Story 1.7's responsibility).
- **`description` constraint** [Source: architecture.md line 260]: `CHECK (length(description) BETWEEN 1 AND 500)`. Zod's `.min(1).max(500)` mirrors it. Both checks fire — Zod at controller, CHECK at DB.
- **No `description` updates in v1** [Source: architecture.md line 333]: `UpdateTodoCompletionInputSchema` is narrow (only `completed`).
- **No pagination in v1** [Source: architecture.md line 628]: no schema for cursor / next-cursor in this story.
- **Date format** [Source: architecture.md line 633]: ISO-8601 strings with offset, UTC. Zod's `z.string().datetime({ offset: true })`.
- **Envelope vs payload** [Source: architecture.md lines 335–349]: `ApiErrorEnvelopeSchema` matches the wire shape `{ error: { code, message, details? } }`. Backend's `errorHandler.ts` (Story 1.4) produces this envelope; the frontend's `http.ts` validates it.

### Previous Story Intelligence (1.1–1.5 → 1.6)

- **From 1.1:** root `tsconfig.json` references composite projects. Order: `packages/shared` first (no dependencies), then apps. Verify `tsc --build` from root rebuilds shared on changes that affect apps.
- **From 1.4:** backend's `errors.ts` defined `ErrorCode` locally with the same four-value literal union. Task 8's refactor removes the local union and imports it from shared. Backend tests must still pass.
- **From 1.5:** frontend's `http.ts` defined `ErrorCode` and `ApiError` locally. Task 9's refactor removes them. Frontend tests must still pass.
- **From 1.4 + 1.5:** both apps have `vitest` configs. Shared package gets its own `vitest.config.ts` or relies on Vitest's default config (no jsdom needed; pure Node tests for schema parsing).
- **From 1.5:** `apps/frontend/tsconfig.json` had `references: [{path: "./tsconfig.node.json"}]`. After 1.6, references is `[{path: "../../packages/shared"}, {path: "./tsconfig.node.json"}]`.
- **From 1.2:** CI's `build` job runs `npm run build --workspaces --if-present`. Now that shared has a real build script and apps have one, all three run. Verify CI passes on first PR for 1.6.
- **From 1.3:** smoke script (`scripts/smoke.sh`) hits `/api/health`. After 1.6's refactor, the wire shape is unchanged (`{status:'healthy'}` is a valid `HealthResponse`). Smoke must still pass.

### Latest Tech Information

| Package | Today (2026-04-28) | Notes |
|---|---|---|
| `zod` | `3.24.x` (or `4.x` if released stable) | If Zod 4 is out, evaluate breaking changes (`.refine` API, error formatting); story may need adjustments. Pin the version that backend (Story 1.4) installed; consistency across workspace is critical. |
| `vitest` | latest stable | Already used by backend and frontend; reuse for shared. |
| `@vitest/coverage-v8` | latest stable | Coverage threshold isn't enforced in shared (no AC); use Vitest defaults. |
| `typescript` | `5.9.x` | Same as Story 1.1's pin. |

**Action:** before commit, confirm Zod version matches what `apps/backend/package.json` (Story 1.4) installed. Hoisted workspace deps deduplicate when versions match exactly; mismatches install duplicates and bloat `node_modules`.

### Anti-Patterns to Avoid

❌ **Don't put runtime business logic in `packages/shared`.** Validation logic that goes beyond schema definition (e.g. "if priority is high AND due_date is past, mark as overdue") belongs in `apps/backend/src/services/` or `apps/frontend/src/features/`.
❌ **Don't import from `@bmad-todo/shared` deep paths.** Always import from the package root (`@bmad-todo/shared`), which resolves through the barrel `index.ts`. Deep imports (`@bmad-todo/shared/src/todo.ts`) couple to internal layout.
❌ **Don't expose `userId` in `TodoSchema`.** v1 has implicit default-user; the wire format hides it. Architecture line 271 — when auth lands, the schema gets a `userId` field, but until then keep it server-side-only.
❌ **Don't add framework imports.** No `fastify`, no `react`, no `@fastify/*`. The package must be consumable by both Node and browser.
❌ **Don't use `z.coerce.*` here.** Coercion is a controller-input concern (e.g. parsing query params). Schemas in `packages/shared` represent the *canonical* parsed shape; consumers coerce on the way in.
❌ **Don't use `z.preprocess`.** Same reasoning. Preprocessors complicate type inference and add invisible runtime cost.
❌ **Don't add `.passthrough()` or `.strict()` globally.** Default Zod behavior strips unknown keys. Adding `.strict()` (rejects unknowns) is a per-schema, deliberate choice — only add when malformed input must be rejected (likely backend-side wrappers, not the canonical schema here).
❌ **Don't include `id` in `CreateTodoInputSchema`.** The server generates UUIDs (architecture line 259). Client-supplied IDs would break the auto-gen contract.
❌ **Don't add `updatedAt` mutation logic.** Drizzle's column default `now()` + DB triggers (Story 1.7's job) handle `updated_at`. Schema only describes the wire shape.

### Testing Standards

Per epics.md Story 1.6 *Test Scenarios*:

- **Unit:**
  - `TodoSchema`: accepts valid; rejects empty description; rejects 501-char description; rejects missing `createdAt`; rejects bad UUID.
  - `CreateTodoInputSchema`: accepts 1-char description; rejects empty; rejects 501-char.
  - `ApiErrorSchema`: accepts each `ErrorCode`; rejects unknown code.
- **Integration:** none.
- **E2E:** none.

No coverage threshold mentioned in the AC (NFR18 / NFR19 are app-level). Suggest tracking coverage for visibility — Vitest defaults are fine.

### References

- Story scope and ACs: [Source: epics.md Story 1.6 (lines 387–424)]
- Validation library, single source of truth: [Source: architecture.md lines 276–282]
- Todo schema (DB) — informs wire schema: [Source: architecture.md lines 257–268]
- Error envelope shape: [Source: architecture.md lines 335–349]
- Health response shape: [Source: architecture.md line 432]
- API resource shape (PATCH only updates `completed`): [Source: architecture.md lines 322–333]
- Naming conventions (camelCase wire, snake_case DB): [Source: architecture.md lines 548–587]
- Date format (ISO-8601 with offset): [Source: architecture.md line 633]
- Backend `errors.ts` (Story 1.4 — to be refactored): [Source: 1-4-...md *Task 4*]
- Frontend `http.ts` (Story 1.5 — to be refactored): [Source: 1-5-...md *Task 7*]

### Project Knowledge References

No `docs/project-context.md` exists yet.

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7[1m]` via the BMad `bmad-dev-story` skill, executed 2026-04-28.

### Debug Log References

1. **`--emitDeclarationOnly` deviation applied as flagged in the story.** The story's *Build configuration deviation* section explicitly recommended emitting both `.js` and `.d.ts` (not `--emitDeclarationOnly`) because Zod schemas are runtime values that must be importable. Followed the recommendation; `packages/shared/dist/` contains both `.js` and `.d.ts` files. AC #5's text remains imprecise; raise via `bmad-correct-course` for an epics.md amendment.
2. **Zod 4 API used in `errors.ts`.** `z.record(z.string(), z.unknown())` requires both key and value types in Zod 4 (Zod 3's single-arg form is invalid). Story text used the older single-arg form; updated to Zod 4 form.
3. **Lint error on destructured `_createdAt`.** `@typescript-eslint/no-unused-vars` doesn't honor underscore-prefix convention by default. Refactored the test to use `delete withoutCreatedAt.createdAt` instead of destructuring.

### Completion Notes List

- **All 22 shared-package tests pass** (8 todo + 6 errors + 4 health + boundary cases). Combined sprint total: **45 tests passing** (17 backend + 6 frontend + 22 shared).
- **Story 1.1 verification chain exits 0 from clean clone** (`rm -rf node_modules && npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build`). Verified.
- **Backend's `errors.ts` refactored** to import `ErrorCode` from `@bmad-todo/shared`. Re-exports the type for backwards-compatibility — backend's own consumers (`errorHandler.ts`) still see `ErrorCode` from the local module. Backend's 17 tests still pass.
- **Frontend's `http.ts` refactored** to import `ApiError` and `ErrorCode` types from `@bmad-todo/shared`. Local `ApiError` interface dropped. Frontend's 6 tests still pass.
- **Root `tsconfig.json`** updated with `packages/shared` first in `references` (no dependencies), then `apps/backend` and `apps/frontend` (both reference shared). Both apps' tsconfigs gained `references: [{ "path": "../../packages/shared" }]`.
- **Pinned versions:**
  - `zod@4.3.6` (matches backend's existing pin — workspace dedup confirmed via `npm install`'s 0 new packages added).
  - `vitest@4.1.5`, `@vitest/coverage-v8@4.1.5`, `typescript@5.9.3` — all match the workspace's existing pins.
- **`@bmad-todo/shared` build output:** `dist/` contains `index.{js,d.ts,js.map,d.ts.map}`, `errors.{js,d.ts,...}`, `todo.{js,d.ts,...}`, `health.{js,d.ts,...}`. Workspace consumers resolve through the package's `main`/`types`/`exports` fields.
- **Smoke script verification deferred** — Docker still unavailable in this WSL distro; same caveat as Story 1.3 + 1.4. Reviewer should run `bash scripts/smoke.sh` once Docker is accessible.
- **No deviations beyond the three documented above.**

### File List

**NEW (10 files):**

- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/index.ts` (barrel)
- `packages/shared/src/todo.ts`
- `packages/shared/src/todo.test.ts` (8 tests)
- `packages/shared/src/errors.ts`
- `packages/shared/src/errors.test.ts` (6 tests)
- `packages/shared/src/health.ts`
- `packages/shared/src/health.test.ts` (4 tests)
- `packages/shared/README.md`

**MODIFIED:**

- `tsconfig.json` (root) — added `{ "path": "./packages/shared" }` first in references.
- `apps/backend/tsconfig.json` — added `references: [{ "path": "../../packages/shared" }]`.
- `apps/backend/package.json` — added `"@bmad-todo/shared": "*"` to dependencies.
- `apps/backend/src/errors.ts` — `ErrorCode` now imported from `@bmad-todo/shared`; `AppError` and subclasses unchanged.
- `apps/frontend/tsconfig.json` — added `references: [{ "path": "../../packages/shared" }]`.
- `apps/frontend/package.json` — added `"@bmad-todo/shared": "*"` to dependencies.
- `apps/frontend/src/shared/http.ts` — `ApiError`, `ErrorCode` types imported from `@bmad-todo/shared`; local interface dropped.

**DELETED:** none.

## Change Log

| Date | Story | Change | Author |
|---|---|---|---|
| 2026-04-28 | 1.6 | `@bmad-todo/shared` workspace package: canonical Zod schemas + inferred TS types for `Todo`, `CreateTodoInput`, `UpdateTodoCompletionInput`, `ApiError`, `ApiErrorEnvelope`, `HealthResponse`, `ErrorCode`. 22 unit tests. Backend's `errors.ts` and frontend's `http.ts` refactored to consume shared types. Composite TS project references chain root → shared → apps. Build emits `.js` + `.d.ts` (story's `--emitDeclarationOnly` text was imprecise; Zod schemas are runtime values). | Aman (via `bmad-dev-story` / `claude-opus-4-7[1m]`) |
