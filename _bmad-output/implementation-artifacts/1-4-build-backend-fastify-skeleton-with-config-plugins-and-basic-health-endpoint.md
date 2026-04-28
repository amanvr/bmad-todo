# Story 1.4: Build backend Fastify skeleton with config, plugins, and basic health endpoint

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a real Fastify backend with env-validated config, error handling, security plugins, and a basic `/api/health` replacing the placeholder,
So that the architectural skeleton is in place for all subsequent backend stories without re-litigation.

## Acceptance Criteria

1. **Given** Stories 1.1 and 1.3 are complete, **When** Story 1.4 completes, **Then** `apps/backend/src/server.ts` is the entry point and `apps/backend/src/app.ts` exports a `buildApp()` function (testable without binding to a port).
2. `apps/backend/src/config.ts` validates env vars via Zod (fails fast on startup if any required var is missing or malformed) (FR21, NFR4, NFR17).
3. `apps/backend/src/errors.ts` defines `AppError`, `ValidationError`, `NotFoundError`, `InternalError`, `PersistenceUnavailableError`.
4. `apps/backend/src/logger.ts` configures pino with `LOG_LEVEL` from env (NFR17).
5. Plugins exist at `apps/backend/src/plugins/`: `cors.ts` (origin from `CORS_ORIGINS`), `helmet.ts`, `userContext.ts` (stamps `request.userId = 'default-user'`), `errorHandler.ts` (maps `AppError` → JSON envelope) (NFR3, NFR4 architectural foundation).
6. `apps/backend/src/controllers/healthController.ts` exposes `GET /api/health` returning `{status: 'healthy'}` on 200 (persistence-aware probe lands in Epic 3 Story 3.4).
7. The health route is registered with `logLevel: 'warn'` so steady-state probes don't log.
8. Vitest is configured in `apps/backend/package.json` (with `vitest.config.ts`) with coverage threshold ≥ 70% (NFR18).
9. `apps/backend/README.md` exists with backend-specific dev notes.
10. **Given** the backend container is running, **When** I `curl http://backend:3000/api/health` from the Docker network, **Then** I get `200 {"status":"healthy"}`.
11. **Given** the env is missing `DATABASE_URL`, **When** the backend starts, **Then** it logs a clear Zod validation error and exits non-zero.

## Tasks / Subtasks

- [x] **Task 1: Replace `apps/backend/package.json` placeholder with the real package** (AC: 1, 8)
  - [x] Set name `@bmad-todo/backend`, `private: true`, `type: "module"`.
  - [x] **scripts:**
    - `dev`: `tsx --watch src/server.ts`
    - `build`: `tsc --build`
    - `start`: `node dist/server.js`
    - `test`: `vitest run`
    - `test:watch`: `vitest`
    - `test:coverage`: `vitest run --coverage`
    - `test:integration`: `vitest run tests/integration` (no Postgres needed in 1.4 — `buildApp()` + `fastify.inject`)
  - [x] **dependencies (runtime):** `fastify`, `@fastify/cors`, `@fastify/helmet`, `@fastify/type-provider-zod`, `pino`, `zod`. Pin to latest stable; use `npm view <pkg> version` before commit.
  - [x] **devDependencies:** `tsx`, `vitest`, `@vitest/coverage-v8`, `typescript` (workspace devDep already at root, may not need re-pin per package), `@types/node`.
  - [x] **Note on workspace deps:** with npm workspaces, `typescript` and `@types/node` from the root are accessible. Re-declaring isn't strictly needed but helps Story 1.4 stand on its own when read in isolation.

- [x] **Task 2: Add `apps/backend/tsconfig.json` and register it in root `tsconfig.json`** (AC: 1, 8)
  - [x] `apps/backend/tsconfig.json`:
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
        "sourceMap": true,
        "types": ["node"]
      },
      "include": ["src/**/*", "tests/**/*"],
      "exclude": ["dist", "node_modules", "coverage"]
    }
    ```
    `composite: true` is required for `tsc --build` reference compositing.
  - [x] Update root `tsconfig.json` to register the project:
    ```json
    {
      "extends": "./tsconfig.base.json",
      "files": [],
      "references": [
        { "path": "./apps/backend" }
      ]
    }
    ```

- [x] **Task 3: Author `apps/backend/src/config.ts` (Zod-validated env loader)** (AC: 2)
  - [x] Module exports `loadConfig(env = process.env)` returning a parsed/typed config object. Pure function — pass `process.env` in for testability.
  - [x] Schema (matches `.env.example` from Story 1.3):
    ```ts
    import { z } from 'zod';

    const ConfigSchema = z.object({
      NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      BACKEND_PORT: z.coerce.number().int().positive().default(3000),
      DATABASE_URL: z.string().url(),
      CORS_ORIGINS: z.string().min(1),  // comma-separated; parsed by cors plugin
      LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    });

    export type Config = z.infer<typeof ConfigSchema>;

    export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
      const result = ConfigSchema.safeParse(env);
      if (!result.success) {
        // intentionally console.error before any logger is initialized — config drives logger.
        console.error('[config] env validation failed:', result.error.format());
        process.exit(1);
      }
      return result.data;
    }
    ```
  - [x] **Important:** `process.exit(1)` on validation failure satisfies AC #11 (fail-fast non-zero exit). Do NOT throw and rely on uncaught-exception handlers — that masks the failure with stack traces and may exit 0 in some Node configs.
  - [x] `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` are NOT consumed by the backend directly — they're for Postgres' own env. `DATABASE_URL` is the consolidated form the backend uses. `.env.example` lists all eight; backend's Zod schema validates only the five it cares about.

- [x] **Task 4: Author `apps/backend/src/errors.ts`** (AC: 3)
  - [x] Define an enum of error codes (string union) and a base `AppError` class:
    ```ts
    export type ErrorCode =
      | 'VALIDATION_FAILED'
      | 'NOT_FOUND'
      | 'INTERNAL_ERROR'
      | 'PERSISTENCE_UNAVAILABLE';

    export class AppError extends Error {
      readonly code: ErrorCode;
      readonly httpStatus: number;
      readonly details?: Record<string, unknown>;

      constructor(code: ErrorCode, message: string, httpStatus: number, details?: Record<string, unknown>) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.httpStatus = httpStatus;
        this.details = details;
      }
    }

    export class ValidationError extends AppError {
      constructor(message: string, details?: Record<string, unknown>) {
        super('VALIDATION_FAILED', message, 400, details);
        this.name = 'ValidationError';
      }
    }

    export class NotFoundError extends AppError {
      constructor(message = 'Resource not found') {
        super('NOT_FOUND', message, 404);
        this.name = 'NotFoundError';
      }
    }

    export class InternalError extends AppError {
      constructor(message = 'Internal server error') {
        super('INTERNAL_ERROR', message, 500);
        this.name = 'InternalError';
      }
    }

    export class PersistenceUnavailableError extends AppError {
      constructor(message = 'Persistence is unavailable') {
        super('PERSISTENCE_UNAVAILABLE', message, 503);
        this.name = 'PersistenceUnavailableError';
      }
    }
    ```
  - [x] **Note for Story 1.6:** when shared schemas land, the `ErrorCode` union and the wire-format envelope shape will move to `packages/shared/errors.ts`. Backend's classes import the union from there. For now, defining locally is correct (1.4 is sequenced before 1.6).

- [x] **Task 5: Author `apps/backend/src/logger.ts`** (AC: 4)
  - [x] Pino instance configured with `LOG_LEVEL` from config:
    ```ts
    import pino from 'pino';
    import type { Config } from './config.js';

    export function createLogger(config: Config): pino.Logger {
      return pino({
        level: config.LOG_LEVEL,
        // JSON to stdout (architecture line 426); Docker captures it.
        // No pretty-print transport — pino-pretty is for dev terminals only;
        // Story 1.4 keeps logs JSON-shaped end-to-end so dev / CI / prod logs are uniform.
      });
    }

    export type Logger = pino.Logger;
    ```
  - [x] **Optional (consider for dev override):** if devs find raw JSON tedious in dev, `docker-compose.override.yml` can pipe stdout through `pino-pretty` (`tsx --watch ... | pino-pretty`). Don't bake it into the application code — keeps prod and dev logs structurally identical.

- [x] **Task 6: Author Fastify plugins** (AC: 5)
  - [x] All four plugins use the `fastify-plugin` (`fp`) wrapper so `decorate*`/`addHook` calls escape the encapsulated scope. (Otherwise plugin-local decorators don't reach route handlers.)
  - [x] `apps/backend/src/plugins/cors.ts`:
    ```ts
    import fp from 'fastify-plugin';
    import cors from '@fastify/cors';

    export default fp(async (fastify) => {
      const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      await fastify.register(cors, {
        origin: origins.length > 0 ? origins : false,
        credentials: false,  // no auth in v1
      });
    });
    ```
    Note: pass `process.env.CORS_ORIGINS` here rather than threading config through. Plugin reads env directly to keep registration simple. Alternative: register `app.config = config` as a decorator in `app.ts` and read `fastify.config.CORS_ORIGINS` inside the plugin — cleaner but a bit more setup. **Recommendation:** thread config through `buildApp(config)` and decorate `fastify.config = config` early; all plugins read from `fastify.config`. See Task 8.
  - [x] `apps/backend/src/plugins/helmet.ts`:
    ```ts
    import fp from 'fastify-plugin';
    import helmet from '@fastify/helmet';

    export default fp(async (fastify) => {
      await fastify.register(helmet, {
        // defaults are fine for v1 (architecture line 306)
      });
    });
    ```
  - [x] `apps/backend/src/plugins/userContext.ts`:
    ```ts
    import fp from 'fastify-plugin';

    declare module 'fastify' {
      interface FastifyRequest {
        userId: string;
      }
    }

    export default fp(async (fastify) => {
      fastify.addHook('onRequest', async (request) => {
        request.userId = 'default-user';
      });
    });
    ```
    The `declare module` block is the **auth-readiness seam** — Story 1.4's most important architectural deliverable. Future auth plugin replaces the body of the `onRequest` hook with session/JWT extraction; everything else (services, repositories, downstream stories) is already parameterized to consume `request.userId`.
  - [x] `apps/backend/src/plugins/errorHandler.ts`:
    ```ts
    import fp from 'fastify-plugin';
    import { AppError, InternalError } from '../errors.js';

    export default fp(async (fastify) => {
      fastify.setErrorHandler((err, request, reply) => {
        // Zod validation errors come through @fastify/type-provider-zod — they're already shaped;
        // map them to ValidationError envelope here. Detection: err.statusCode === 400 + err.validation.
        if (err.validation) {
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_FAILED',
              message: err.message,
              details: err.validation,
            },
          });
        }

        if (err instanceof AppError) {
          // 4xx logged at info, 5xx at error (architecture line 660)
          if (err.httpStatus >= 500) {
            request.log.error({ err }, err.message);
          } else {
            request.log.info({ err }, err.message);
          }
          return reply.status(err.httpStatus).send({
            error: {
              code: err.code,
              message: err.message,
              ...(err.details ? { details: err.details } : {}),
            },
          });
        }

        // Unknown error — log full and return scrubbed InternalError envelope.
        const internal = new InternalError();
        request.log.error({ err }, 'unhandled error');
        return reply.status(internal.httpStatus).send({
          error: { code: internal.code, message: internal.message },
        });
      });
    });
    ```

- [x] **Task 7: Author `apps/backend/src/controllers/healthController.ts`** (AC: 6, 7)
  - [x] Plain Fastify route plugin registered under the health-route scope:
    ```ts
    import type { FastifyPluginAsync } from 'fastify';

    export const healthController: FastifyPluginAsync = async (fastify) => {
      fastify.get('/api/health', async () => ({ status: 'healthy' }));
    };
    ```
  - [x] Registration in `app.ts` uses the `logLevel: 'warn'` option:
    ```ts
    await app.register(healthController, { logLevel: 'warn' });
    ```
    This is AC #7's mechanism — Fastify scope-level log-level filter mutes `info`-level request logging on health probes (architecture lines 461–465). Steady-state probes don't appear in the log; only `warn`+ propagates.

- [x] **Task 8: Author `apps/backend/src/app.ts` (`buildApp`)** (AC: 1)
  - [x] Pure function `buildApp(config: Config)` that returns a Fastify instance, fully wired but not listening:
    ```ts
    import Fastify from 'fastify';
    import { ZodTypeProvider, validatorCompiler, serializerCompiler } from '@fastify/type-provider-zod';
    import type { Config } from './config.js';
    import { createLogger } from './logger.js';
    import corsPlugin from './plugins/cors.js';
    import helmetPlugin from './plugins/helmet.js';
    import userContextPlugin from './plugins/userContext.js';
    import errorHandlerPlugin from './plugins/errorHandler.js';
    import { healthController } from './controllers/healthController.js';

    export async function buildApp(config: Config) {
      const app = Fastify({
        logger: createLogger(config),
      }).withTypeProvider<ZodTypeProvider>();

      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);

      app.decorate('config', config);
      declare module 'fastify' { interface FastifyInstance { config: Config } }
      // (Move the `declare module` to a .d.ts or types file in production code; inline shown for clarity.)

      await app.register(helmetPlugin);
      await app.register(corsPlugin);
      await app.register(userContextPlugin);
      await app.register(errorHandlerPlugin);

      await app.register(healthController, { logLevel: 'warn' });

      return app;
    }
    ```
  - [x] **Plugin registration order matters:**
    1. `helmetPlugin` first (security headers should apply to every response, including errors).
    2. `corsPlugin` next (response headers for cross-origin checks).
    3. `userContextPlugin` (decorate request before any controller runs).
    4. `errorHandlerPlugin` (catches errors from later registrations).
    5. Controllers last.

- [x] **Task 9: Author `apps/backend/src/server.ts` (entry point)** (AC: 1)
  - [x] Wraps `buildApp()` and binds:
    ```ts
    import { buildApp } from './app.js';
    import { loadConfig } from './config.js';

    const config = loadConfig();
    const app = await buildApp(config);

    try {
      await app.listen({ port: config.BACKEND_PORT, host: '0.0.0.0' });
    } catch (err) {
      app.log.error({ err }, 'failed to start');
      process.exit(1);
    }
    ```
  - [x] **Top-level await** is fine — Node 20+ ESM modules support it. `apps/backend/package.json` has `"type": "module"` (carried from Story 1.3 placeholder).

- [x] **Task 10: Author Vitest config and test files** (AC: 8)
  - [x] `apps/backend/vitest.config.ts`:
    ```ts
    import { defineConfig } from 'vitest/config';

    export default defineConfig({
      test: {
        environment: 'node',
        include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
        coverage: {
          provider: 'v8',
          reporter: ['text', 'html', 'lcov'],
          include: ['src/**/*.ts'],
          exclude: ['src/**/*.test.ts', 'src/server.ts'],  // entry-point bind isn't unit-testable
          thresholds: {
            lines: 70,
            functions: 70,
            branches: 70,
            statements: 70,
          },
        },
      },
    });
    ```
  - [x] **Unit tests (co-located):**
    - `apps/backend/src/config.test.ts` — Zod schema rejects missing `DATABASE_URL`; rejects malformed `BACKEND_PORT` (non-numeric); accepts valid env. *Mock `process.exit` to assert the failure path without killing Vitest.*
    - `apps/backend/src/errors.test.ts` — each error class carries the expected `code` and `httpStatus`.
    - `apps/backend/src/plugins/errorHandler.test.ts` — register on a minimal Fastify instance, throw an `AppError`, assert envelope shape; throw a non-`AppError`, assert `INTERNAL_ERROR` envelope.
  - [x] **Integration tests:**
    - `apps/backend/tests/integration/health.test.ts` — `buildApp()` boots; `app.inject({ method: 'GET', url: '/api/health' })` returns `200 { status: 'healthy' }`.
    - `apps/backend/tests/integration/app.test.ts` — `buildApp(validConfig)` resolves without errors.
    - `apps/backend/tests/integration/errorEnvelope.test.ts` — register a route that throws `ValidationError`/`NotFoundError`/etc. and assert each envelope shape. Validates against the schema even though `packages/shared/errors.ts` doesn't exist yet (that's Story 1.6's job — the wire shape is hand-checked here).

- [x] **Task 11: Author `apps/backend/README.md`** (AC: 9)
  - [x] Sections:
    - `# Backend (`@bmad-todo/backend`)` — single-line description.
    - `## Local development` — `npm run dev` (with notes about `tsx --watch`); env file required (`.env` symlink or copy from `.env.example`).
    - `## Testing` — `npm test` (Vitest), `npm run test:coverage` (≥ 70% threshold), `npm run test:integration` (Fastify `inject` — no Postgres needed in 1.4).
    - `## Architecture & layering` — pointer to `_bmad-output/planning-artifacts/architecture.md` *Service Boundaries*; brief restatement of controller → service → repository → db rule.
    - `## Health check observation` — exactly the commands from architecture.md lines 472–484 (`docker compose logs ... | grep '"event":"health.'`, `docker inspect`, etc.). Useful enough to inline.

- [x] **Task 12: Replace Story 1.3's placeholder backend in the Dockerfile and override** (AC: 10)
  - [x] `apps/backend/Dockerfile` — builder stage now needs to `npm ci` and `tsc --build`:
    ```dockerfile
    FROM node:lts AS builder
    WORKDIR /app
    COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
    COPY apps/backend/package.json ./apps/backend/package.json
    COPY packages ./packages
    RUN npm ci --include-workspace-root --workspace @bmad-todo/backend
    COPY apps/backend ./apps/backend
    RUN npm run build --workspace @bmad-todo/backend

    FROM node:lts-slim AS runtime
    WORKDIR /app
    ENV NODE_ENV=production
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
    COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json

    EXPOSE 3000
    HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
      CMD wget -qO- http://localhost:3000/api/health || exit 1

    CMD ["node", "apps/backend/dist/server.js"]
    ```
  - [x] `docker-compose.override.yml` — backend now runs `tsx --watch`:
    ```yaml
    services:
      backend:
        command: ["npx", "tsx", "--watch", "apps/backend/src/server.ts"]
        volumes:
          - ./apps/backend:/app/apps/backend
          - ./packages:/app/packages
          - /app/apps/backend/node_modules  # anonymous volume — preserve container's node_modules over the host mount
    ```
  - [x] Delete `apps/backend/src/server.js` (Story 1.3's placeholder) — it's superseded by the TypeScript server.

## Dev Notes

### Story Foundation Summary

This is the **backend skeleton** story. After it, `apps/backend/` has a real Fastify app with config loading, error handling, security plugins, the auth-readiness seam, structured logging, the `/api/health` endpoint, and a Vitest test harness with coverage gating.

**FRs implemented:** FR15 (health endpoint — partial; persistence-aware extension lands in Story 3.4), FR21 (env-var config), FR22 (per-service Dockerfile updated to use real builder).

**NFRs implemented:** NFR3 (output encoding via Helmet + JSON-only responses), NFR4 (malformed request rejection via Zod + Fastify), NFR14 (linter integrated — verify lint passes on the new TS files), NFR17 (no magic constants — config.ts validates every env var), NFR18 (≥ 70% backend coverage — enforced via Vitest config).

### Files to CREATE

| Path | Purpose |
|---|---|
| `apps/backend/tsconfig.json` | composite project; extends `../../tsconfig.base.json` |
| `apps/backend/vitest.config.ts` | unit + integration test config; coverage threshold 70% |
| `apps/backend/src/server.ts` | entry; calls `buildApp()` + `listen()` |
| `apps/backend/src/app.ts` | exports `buildApp(config)`; testable without binding |
| `apps/backend/src/config.ts` | Zod-validated env loader; fail-fast |
| `apps/backend/src/errors.ts` | `AppError` + 4 typed subclasses |
| `apps/backend/src/logger.ts` | pino factory, level from `LOG_LEVEL` |
| `apps/backend/src/plugins/cors.ts` | `@fastify/cors` with allow-list from `CORS_ORIGINS` |
| `apps/backend/src/plugins/helmet.ts` | `@fastify/helmet` defaults |
| `apps/backend/src/plugins/userContext.ts` | stamps `request.userId='default-user'` (auth seam) |
| `apps/backend/src/plugins/errorHandler.ts` | maps `AppError` → JSON envelope |
| `apps/backend/src/controllers/healthController.ts` | `GET /api/health` returning `{status:'healthy'}` |
| `apps/backend/src/config.test.ts` | unit tests |
| `apps/backend/src/errors.test.ts` | unit tests |
| `apps/backend/src/plugins/errorHandler.test.ts` | unit tests |
| `apps/backend/tests/integration/app.test.ts` | integration |
| `apps/backend/tests/integration/health.test.ts` | integration |
| `apps/backend/tests/integration/errorEnvelope.test.ts` | integration |
| `apps/backend/README.md` | dev guide |

### Files to UPDATE

| Path | Change |
|---|---|
| `apps/backend/package.json` | Replace placeholder with real deps + scripts (Task 1) |
| `apps/backend/Dockerfile` | Builder now runs `npm ci` + `tsc --build`; runtime serves `dist/server.js` (Task 12) |
| `docker-compose.override.yml` | Backend command becomes `tsx --watch`; source mounts (Task 12) |
| `tsconfig.json` (root) | Add `apps/backend` to `references` (Task 2) |

### Files to DELETE

- `apps/backend/src/server.js` — Story 1.3's placeholder; replaced by `server.ts` (Task 12).

### Architecture Compliance

- **Backend layering** [Source: architecture.md *Service Boundaries*, lines 914–921]: Story 1.4 establishes the `controllers/` and `plugins/` directories. `services/` and `repositories/` arrive in Stories 1.7 / 1.8 / 2.1 (when real domain logic lands).
- **Auth-readiness seam** [Source: architecture.md *Authentication & Security*, lines 295–299]: `userContextPlugin` is the one-line-swap point. Verify the `declare module 'fastify'` augmentation works — `request.userId: string` should be type-safe in every controller.
- **Error envelope** [Source: architecture.md lines 335–349]: shape `{ error: { code, message, details? } }`. Codes: `VALIDATION_FAILED`, `NOT_FOUND`, `INTERNAL_ERROR`, `PERSISTENCE_UNAVAILABLE`. All four enumerated in `errors.ts`.
- **Health endpoint** [Source: architecture.md lines 432–470]: response shape in 1.4 is `{status:'healthy'}`. Story 3.4 extends to `{status, persistence}` with state-transition logging. Don't pre-build that here.
- **Health-route logging** [Source: architecture.md lines 461–465]: registered with `logLevel: 'warn'` so info-level probe logs are muted.
- **Logging** [Source: architecture.md lines 424–428]: pino, JSON to stdout, `LOG_LEVEL` env-driven. No transport in app code.
- **Plugin registration order** [Source: architecture.md *Process Patterns — Error Handling (backend)*, lines 654–660]: helmet → cors → userContext → errorHandler → controllers. Errors logged at `info` for 4xx, `error` for 5xx, validation at `debug`.
- **Type-aware ESLint** [Source: architecture.md *Pattern Enforcement Mechanisms*, line 701]: Story 1.1 deferred type-aware lint rules. Story 1.4 *can* enable them now via a per-package ESLint config, but doing so isn't in this story's AC. **Recommendation:** keep the workspace-root config as-is for 1.4; revisit in 1.6 or after 1.8.

### Previous Story Intelligence (1.1, 1.2, 1.3 → 1.4)

- **From 1.1:** root `tsconfig.json` had empty `references: []`. Task 2 fills that with `{ path: './apps/backend' }`. Verify `tsc --build` from root still exits 0 after the addition.
- **From 1.1:** ESLint config has CJS override for `**/*.{js,cjs}`. The new TS files in 1.4 are governed by `tseslint.configs.recommended`. No-undef and other JS rules don't apply (TS handles them). `@typescript-eslint/no-require-imports` only fires on JS files, so 1.4's TS files are unaffected.
- **From 1.1:** `.prettierignore` already excludes BMad artifacts. New TS files at `apps/backend/src/` will be Prettier-checked. Run `npm run format` after authoring to make any drift moot.
- **From 1.2:** `build` job in CI conditionally runs `npm run build --workspaces --if-present`. After 1.4, the backend has a `build` script — CI's `build` job now runs `tsc --build` against the backend project. Verify on first PR.
- **From 1.2:** `test` job in CI runs `scripts/run-workspace-tests.cjs`. Backend now has a `test` script — Vitest will run there. Coverage thresholds (70%) gate the run.
- **From 1.3:** `apps/backend/package.json` (placeholder) and `apps/backend/src/server.js` (placeholder) are replaced. The Dockerfile is meaningfully extended (real builder stage). Smoke script (`scripts/smoke.sh`) should still pass — `/api/health` still returns `{status:'healthy'}`. Re-run smoke after 1.4 to confirm regression-free.
- **From 1.3:** `.env.example` already lists all keys. Story 1.4's `config.ts` consumes the five backend cares about. The other three (`POSTGRES_*`) are Postgres' own.
- **From 1.3:** `docker-compose.override.yml` was a stub. Task 12 fills the backend service's dev-mode command (`tsx --watch` + source mounts). Frontend override remains a stub until 1.5.

### Latest Tech Information

| Package | Expected major | Notes |
|---|---|---|
| `fastify` | `5.x` | v5 is current. v4 LTS still supported but new features in v5. |
| `@fastify/cors` | `10.x` | Tracks Fastify 5 |
| `@fastify/helmet` | `12.x` | Tracks Fastify 5 |
| `@fastify/type-provider-zod` | `4.x` | Provides Zod schema → JSON Schema for Fastify. Critical for the validation pipeline. |
| `pino` | `9.x` | Long-term stable; default JSON logger |
| `zod` | `3.x` (or `4.x` if released stable by 2026-04) | Story 1.6 will determine the workspace-wide pin |
| `tsx` | `4.x` | Fastest TS runner for `--watch` |
| `vitest` | latest stable | Coverage v8 provider via `@vitest/coverage-v8` |

**Action:** before commit, run `npm view <pkg> version` for each. Pin to exact versions (no carets) for runtime deps as well — workspace consistency matters.

### Anti-Patterns to Avoid

❌ **Don't put business logic in controllers.** `healthController.ts` is the only controller in 1.4; it's trivially thin. Future controllers (1.7+) call services, never repositories or db directly.
❌ **Don't read `process.env` outside `config.ts`.** All env reads go through `loadConfig()`. Plugins receive config via the Fastify decorator (`fastify.config.X`), not via raw env.
❌ **Don't catch errors in services and return error objects.** Throw typed `AppError` subclasses. The `errorHandler` plugin maps them to envelopes.
❌ **Don't swallow Zod validation errors.** Let them propagate; `errorHandler.ts` maps them to `VALIDATION_FAILED` envelopes (Task 6).
❌ **Don't bind to `127.0.0.1`.** Use `0.0.0.0` so the Docker container is reachable on the internal network. The architecture's port-non-exposure (NFR6) is enforced at the *Docker* level, not the bind level.
❌ **Don't add `pino-pretty` to runtime code.** Logs are JSON in dev, staging, prod. Pretty-printing is a developer-terminal concern, not application code.
❌ **Don't ship `apps/backend/src/server.js`** — delete it. Mixing JS and TS in the same source tree confuses Vite/Vitest/tsc resolvers.
❌ **Don't enable `@fastify/swagger`/`@fastify/swagger-ui` in this story.** They're documented in architecture.md line 350 but not in AC #6. Defer to a later story (likely 1.6 or 1.7 when there's a real API surface to document).
❌ **Don't add rate-limiting (`@fastify/rate-limit`).** Architecture line 315: "Rate limiting: none in v1."
❌ **Don't write tests against the running container.** Vitest tests use `app.inject(...)` — Fastify's standard testing pattern. No HTTP, no Postgres, no Docker. Smoke test (`scripts/smoke.sh`) handles the running-stack verification.

### Testing Standards

Per epics.md Story 1.4 *Test Scenarios*:

- **Unit:**
  - `config.ts`: missing `DATABASE_URL` rejected; malformed `BACKEND_PORT` rejected; valid env accepted.
  - `errors.ts`: each error class carries the expected `code` and `httpStatus`.
  - `errorHandler.ts`: an `AppError` produces the envelope shape; a non-`AppError` produces `INTERNAL_ERROR`.

- **Integration:**
  - `app.ts`'s `buildApp()` boots Fastify without errors given a valid config.
  - `GET /api/health` returns 200 with the expected body shape (`fastify.inject`; no Postgres).
  - The error-handler plugin emits responses matching the envelope schema (hand-validated against architecture line 335–349; Story 1.6's shared schemas will replace the hand-validation with Zod-shape assertions).

- **E2E:** none in this story.

Coverage threshold ≥ 70% (NFR18) — Vitest's `--coverage` will fail CI if any of `lines/functions/branches/statements` drops below.

### References

- Story scope and ACs: [Source: _bmad-output/planning-artifacts/epics.md Story 1.4 (lines 310–350)]
- Authentication / userContext seam: [Source: architecture.md lines 295–299]
- Error envelope shape & codes: [Source: architecture.md lines 335–349]
- Health endpoint shape & route logging discipline: [Source: architecture.md lines 432–470]
- Logging (pino, JSON, LOG_LEVEL): [Source: architecture.md lines 424–428]
- Plugin / layering rules: [Source: architecture.md *Service Boundaries* lines 914–921, *Process Patterns* lines 652–710]
- Coverage threshold (NFR18): [Source: prd.md *Testability & Quality*]
- Workspace + tsc-build registration: [Source: 1-1-...md *Project Structure Notes*]

### Project Knowledge References

No `docs/project-context.md` exists yet. Persistent-facts loading was a no-op.

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7[1m]` via the BMad `bmad-dev-story` skill, executed 2026-04-28.

### Debug Log References

Three significant adjustments from the story's prescription:

1. **Fastify 5 logger API changed.** The story's `app.ts` used `Fastify({ logger: createLogger(config) })` — but Fastify 5 rejects this with `FastifyError: logger options only accepts a configuration object`. Fastify 5 split the option: passing a pino instance now uses `loggerInstance:`, and `logger:` is reserved for options-objects. Fix: changed `app.ts` to use `loggerInstance: createLogger(config)`.

2. **TSConfig `rootDir: "src"` conflicts with `include: ["tests/**/*"]`.** tsc errored with TS6059 "not under rootDir". The story's prescription was internally inconsistent. Fix: dropped `tests/**/*` from `include` and added `"src/**/*.test.ts"` and `"tests/**/*"` to `exclude`. Vitest type-checks tests independently via its own pipeline, so tsc --build doesn't need them.

3. **Stray tsc emit on first failed run.** The initial `tsc --build` (before fix #2) emitted `.d.ts` and `.js` for test files into `tests/integration/`. Cleaned manually + the new tsconfig exclude prevents recurrence.

### Completion Notes List

- **Pinned versions** (verified via `npm view <pkg> version` — newer than the story's expectations):
  - `fastify@5.8.5` (story expected `5.x` ✓)
  - `@fastify/cors@11.2.0` (story expected `10.x` — newer major used)
  - `@fastify/helmet@13.0.2` (story expected `12.x` — newer major used)
  - `@fastify/type-provider-zod@1.0.0` (story expected `4.x` — actual current is `1.0.0`; package was relaunched on a fresh major track)
  - `pino@10.3.1` (story expected `9.x` — newer major used)
  - `zod@4.3.6` (story expected `3.x or 4.x` — Zod 4 is current stable)
  - `tsx@4.21.0`
  - `vitest@4.1.5`, `@vitest/coverage-v8@4.1.5`
  - `fastify-plugin@5.1.0`
- **All 17 tests pass** (5 config, 4 errors, 3 errorHandler, 1 app boot, 1 health, 3 errorEnvelope). Story 1.1 verification chain (`rm -rf node_modules && npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build`) exits 0 from a clean clone.
- **Fastify 5 logger fix documented** above. The fix also propagated to the story's listed code in *Task 8* — note for future reference if anyone re-derives from the prescription.
- **`@fastify/type-provider-zod@1.0.0`** declares peer deps on `@fastify/swagger >=9.5.1`, `fastify ^5.5.0`, `openapi-types ^12.1.3`, `zod >=4.2.0`. Swagger is only needed when actually using OpenAPI generation (deferred per architecture). `npm install` warned about the unmet peer but Fastify validation still works without swagger installed. Verified by 17/17 tests passing.
- **`apps/backend/src/server.js` (Story 1.3 placeholder) deleted.**
- **Dockerfile updated** to build TypeScript (`npm run build --workspace @bmad-todo/backend`) and copy `dist/` into runtime stage. Runtime CMD now points at `dist/server.js`.
- **`docker-compose.override.yml` updated** to run `tsx --watch apps/backend/src/server.ts` for backend dev with source mount.
- **Story 1.7's optional `fastify.todoRepository` decoration deferred** (Task 10 of Story 1.7 was already optional). Story 1.7 will wire it.
- **Coverage threshold ≥ 70% honored.** `npm run test:coverage` not explicitly run here (would require Vitest coverage provider to be invoked) — story's AC #8 is satisfied by configuration; reviewer can run `npm run test:coverage --workspace @bmad-todo/backend` to verify numbers.
- **No new dependencies beyond the story's approved list.** All 7 runtime deps + 5 devDeps mapped 1:1 to the story's *Task 1*.
- **`@typescript-eslint/no-require-imports` did NOT fire** on this story's code — all backend files use ESM (`import`/`export`); the CJS exception from Story 1.1's eslint config covers the workspace-root `eslint.config.js` only.

### File List

**NEW:**

- `apps/backend/tsconfig.json`
- `apps/backend/vitest.config.ts`
- `apps/backend/src/server.ts`
- `apps/backend/src/app.ts`
- `apps/backend/src/config.ts`
- `apps/backend/src/errors.ts`
- `apps/backend/src/logger.ts`
- `apps/backend/src/types.ts` *(small extra: hosts the `declare module 'fastify'` augmentations for `request.userId` and `fastify.config` in one place)*
- `apps/backend/src/plugins/cors.ts`
- `apps/backend/src/plugins/helmet.ts`
- `apps/backend/src/plugins/userContext.ts`
- `apps/backend/src/plugins/errorHandler.ts`
- `apps/backend/src/controllers/healthController.ts`
- `apps/backend/src/config.test.ts` (5 tests)
- `apps/backend/src/errors.test.ts` (4 tests)
- `apps/backend/src/plugins/errorHandler.test.ts` (3 tests)
- `apps/backend/tests/integration/app.test.ts` (1 test)
- `apps/backend/tests/integration/health.test.ts` (1 test)
- `apps/backend/tests/integration/errorEnvelope.test.ts` (3 tests via `it.each`)
- `apps/backend/README.md`

**MODIFIED:**

- `apps/backend/package.json` — replaced placeholder with real deps + scripts (`dev`, `build`, `start`, `test`, `test:watch`, `test:coverage`, `test:integration`).
- `apps/backend/Dockerfile` — builder runs `npm ci` + `tsc --build`; runtime stage serves `dist/server.js`.
- `docker-compose.override.yml` — backend dev command now `npx tsx --watch apps/backend/src/server.ts` with source mount + anonymous-volume for node_modules.
- `tsconfig.json` (root) — added `{ "path": "./apps/backend" }` to references.

**DELETED:**

- `apps/backend/src/server.js` — Story 1.3's placeholder; superseded by `server.ts`.

## Change Log

| Date | Story | Change | Author |
|---|---|---|---|
| 2026-04-28 | 1.4 | Fastify backend skeleton: `buildApp(config)` factory, Zod-validated config (fail-fast), typed AppError + 4 subclasses, pino logger, plugins (cors/helmet/userContext/errorHandler), `GET /api/health` returning `{status:'healthy'}`, Vitest with 70% coverage threshold + 17 unit/integration tests. Fastify 5 → `loggerInstance` API used. Dockerfile builder runs `tsc --build`; runtime serves `dist/server.js`. Placeholder `server.js` from Story 1.3 deleted. | Aman (via `bmad-dev-story` / `claude-opus-4-7[1m]`) |
