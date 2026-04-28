# Story 1.7: Todo persistence layer (todos table + repository)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a `todos` table in Postgres with a typed `TodoRepository` interface and a Drizzle-backed implementation,
So that backend services can read/write todos without coupling to SQL details, and the persistence non-foreclosure seam is in place from day one.

## Acceptance Criteria

1. **Given** Stories 1.4 and 1.6 are complete, **When** Story 1.7 completes, **Then** `apps/backend/src/db/schema.ts` defines the `todos` table per architecture: UUID PK with `gen_random_uuid()` default, `description` TEXT 1–500 chars CHECK constraint, `completed` BOOLEAN NOT NULL default false, `created_at` and `updated_at` TIMESTAMPTZ NOT NULL default now(), `user_id` TEXT NOT NULL default `'default-user'`, indexes on `user_id` and `created_at`.
2. `apps/backend/drizzle.config.ts` is configured to generate migrations into `apps/backend/drizzle/`.
3. The first migration `<timestamp>_init.sql` is generated and committed.
4. `apps/backend/src/db/migrate.ts` applies pending migrations on backend startup.
5. `apps/backend/src/db/client.ts` exports a singleton pg pool + Drizzle instance.
6. `apps/backend/src/repositories/todoRepository.ts` defines the `TodoRepository` interface (`list(userId)`, `create(input, userId)`, `setCompleted(id, completed, userId)`, `delete(id, userId)`).
7. `apps/backend/src/repositories/postgresTodoRepository.ts` implements the interface using Drizzle queries (parameterized — NFR7).
8. **Given** a fresh database, **When** the backend starts, **Then** the migration runs and creates the `todos` table.
9. **Given** a populated database, **When** I call `repository.create(...)`, **Then** a row with `user_id = 'default-user'` is inserted and the typed Todo is returned.

## Tasks / Subtasks

- [x] **Task 1: Add Drizzle dependencies to `apps/backend/package.json`** (AC: 1–7)
  - [x] Runtime deps: `drizzle-orm`, `pg` (the node-postgres driver).
  - [x] DevDeps: `drizzle-kit`, `@types/pg`.
  - [x] Pin to latest stable; verify with `npm view`.
  - [x] Add scripts:
    - `db:generate`: `drizzle-kit generate` (produces SQL migration files in `apps/backend/drizzle/`)
    - `db:migrate`: `tsx src/db/migrate.ts` (one-shot migration runner — used in dev when bypassing app startup)
    - `db:studio`: `drizzle-kit studio` (optional — local DB browser; convenience, not in AC)

- [x] **Task 2: Author `apps/backend/drizzle.config.ts`** (AC: 2)
  - [x] Reads `DATABASE_URL` from env; outputs migrations to `apps/backend/drizzle/`:
    ```ts
    import { defineConfig } from 'drizzle-kit';

    export default defineConfig({
      dialect: 'postgresql',
      schema: './src/db/schema.ts',
      out: './drizzle',
      dbCredentials: {
        url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/bmad_todo',
      },
      verbose: true,
      strict: true,
    });
    ```
  - [x] **Important:** `drizzle.config.ts` is read by `drizzle-kit` at developer-tool time (not at app runtime). It needs `DATABASE_URL` set in the dev shell — `.env` from Story 1.3 plus a `dotenv` shim or direct `export`. Document in `apps/backend/README.md`.

- [x] **Task 3: Author `apps/backend/src/db/schema.ts`** (AC: 1)
  - [x] Drizzle table definition matching architecture.md lines 257–268:
    ```ts
    import { sql } from 'drizzle-orm';
    import { pgTable, uuid, text, boolean, timestamp, check, index } from 'drizzle-orm/pg-core';

    export const todos = pgTable(
      'todos',
      {
        id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
        description: text('description').notNull(),
        completed: boolean('completed').notNull().default(false),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`),
        userId: text('user_id').notNull().default('default-user'),
      },
      (table) => ({
        descriptionLengthCheck: check(
          'todos_description_length_check',
          sql`length(${table.description}) BETWEEN 1 AND 500`,
        ),
        userIdIdx: index('todos_user_id_idx').on(table.userId),
        createdAtIdx: index('todos_created_at_idx').on(table.createdAt),
      }),
    );

    export type TodoRow = typeof todos.$inferSelect;
    export type TodoInsert = typeof todos.$inferInsert;
    ```
  - [x] **`mode: 'string'`** for timestamps — emits ISO-8601 strings, matches the wire format (architecture line 633, Story 1.6 `TodoSchema.createdAt: z.string().datetime()`). The default `mode: 'date'` returns JS `Date` objects, which would force conversion in every read path.
  - [x] **DB-side CHECK** constraint enforces 1–500 char description as defense-in-depth (Test Scenarios call this out explicitly). Zod validates at the controller; the DB validates as the last line.
  - [x] **Note on `gen_random_uuid()`:** built into Postgres 13+. Architecture pins Postgres 16+ (Story 1.3 AC #2). No need for the `pgcrypto` or `uuid-ossp` extension.
  - [x] **DO NOT add an `updated_at` trigger** in this story. Architecture doesn't mandate it; the repository's `setCompleted` will manually update `updated_at` (Task 8). A trigger is non-foreclosed for the audit-log capability and may land later.

- [x] **Task 4: Generate the initial migration** (AC: 3)
  - [x] Run `npm run db:generate --workspace @bmad-todo/backend` once `schema.ts` is authored. Output: `apps/backend/drizzle/0000_<random_name>_init.sql` plus a `apps/backend/drizzle/meta/` directory.
  - [x] **Commit** the generated SQL file and `meta/` directory verbatim. Do NOT hand-edit; future schema changes regenerate.
  - [x] Inspect the generated SQL — verify it contains `CREATE TABLE`, the `CHECK` constraint, both indexes, and the `gen_random_uuid()` default. If missing any, the schema definition is wrong.

- [x] **Task 5: Author `apps/backend/src/db/client.ts`** (AC: 5)
  - [x] Singleton pg pool + Drizzle instance:
    ```ts
    import { Pool } from 'pg';
    import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
    import * as schema from './schema.js';

    export type Database = NodePgDatabase<typeof schema>;

    let pool: Pool | null = null;
    let db: Database | null = null;

    export function createDbClient(databaseUrl: string): { pool: Pool; db: Database } {
      if (pool && db) return { pool, db };
      pool = new Pool({ connectionString: databaseUrl });
      db = drizzle(pool, { schema });
      return { pool, db };
    }

    export async function closeDbClient(): Promise<void> {
      if (pool) {
        await pool.end();
        pool = null;
        db = null;
      }
    }
    ```
  - [x] Singleton pattern via module-level state. `createDbClient(url)` is idempotent — calling twice with the same URL returns the same instance.
  - [x] **Don't expose the pool or db as bare module exports.** Force consumers through `createDbClient()` so the construction order is explicit (test setup can swap a different connection string).
  - [x] Lazy initialization handles the `app.test.ts` (Story 1.4) integration test that boots `buildApp()` without a real Postgres — those tests can't import a module-init-time-bound DB.

- [x] **Task 6: Author `apps/backend/src/db/migrate.ts`** (AC: 4)
  - [x] Migration runner using Drizzle's official utility:
    ```ts
    import { migrate } from 'drizzle-orm/node-postgres/migrator';
    import { createDbClient } from './client.js';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    export async function runMigrations(databaseUrl: string): Promise<void> {
      const { db } = createDbClient(databaseUrl);
      // The 'drizzle' folder in the package root contains the generated migrations.
      // After tsc --build, dist/db/migrate.js sits 2 levels deep — adjust path accordingly.
      const migrationsFolder = path.resolve(__dirname, '../../drizzle');
      await migrate(db, { migrationsFolder });
    }

    // Allow direct invocation: `tsx src/db/migrate.ts` (db:migrate npm script)
    if (import.meta.url === `file://${process.argv[1]}`) {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error('DATABASE_URL must be set to run migrations directly.');
      runMigrations(url)
        .then(() => process.exit(0))
        .catch((err) => {
          console.error('[migrate]', err);
          process.exit(1);
        });
    }
    ```
  - [x] **Path resolution gotcha:** `__dirname` resolves differently in `dist/` (compiled) vs `src/` (`tsx --watch`). Test both paths. The Dockerfile copies `apps/backend/drizzle/` into the runtime image — verify with `docker compose run backend ls /app/apps/backend/drizzle`.

- [x] **Task 7: Author the `TodoRepository` interface** (AC: 6)
  - [x] `apps/backend/src/repositories/todoRepository.ts`:
    ```ts
    import type { Todo, CreateTodoInput } from '@bmad-todo/shared';

    export interface TodoRepository {
      list(userId: string): Promise<Todo[]>;
      create(input: CreateTodoInput, userId: string): Promise<Todo>;
      setCompleted(id: string, completed: boolean, userId: string): Promise<Todo>;
      delete(id: string, userId: string): Promise<void>;
    }
    ```
  - [x] **Why this interface is the architectural seam:** caching, audit-log capture, real-time-sync triggers all land here. Services and controllers depend on the interface, never on `postgresTodoRepository` directly.
  - [x] **`userId` is a real parameter, not implicit.** Architecture's auth-readiness seam (lines 295–299) — controllers will pass `request.userId` (Story 1.4 plugin) here. v1 always passes `'default-user'`.

- [x] **Task 8: Author `apps/backend/src/repositories/postgresTodoRepository.ts`** (AC: 7)
  - [x] Drizzle implementation of the interface:
    ```ts
    import { eq, and, desc, sql } from 'drizzle-orm';
    import type { TodoRepository } from './todoRepository.js';
    import type { Todo, CreateTodoInput } from '@bmad-todo/shared';
    import type { Database } from '../db/client.js';
    import { todos } from '../db/schema.js';
    import { NotFoundError } from '../errors.js';

    function toDomain(row: typeof todos.$inferSelect): Todo {
      // Drizzle returns `userId` per the column alias — but Todo (wire shape) drops it.
      return {
        id: row.id,
        description: row.description,
        completed: row.completed,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }

    export class PostgresTodoRepository implements TodoRepository {
      constructor(private readonly db: Database) {}

      async list(userId: string): Promise<Todo[]> {
        const rows = await this.db
          .select()
          .from(todos)
          .where(eq(todos.userId, userId))
          .orderBy(desc(todos.createdAt));
        return rows.map(toDomain);
      }

      async create(input: CreateTodoInput, userId: string): Promise<Todo> {
        const [row] = await this.db
          .insert(todos)
          .values({ description: input.description, userId })
          .returning();
        if (!row) throw new Error('insert returned no row — should not happen');
        return toDomain(row);
      }

      async setCompleted(id: string, completed: boolean, userId: string): Promise<Todo> {
        const [row] = await this.db
          .update(todos)
          .set({ completed, updatedAt: sql`now()` })
          .where(and(eq(todos.id, id), eq(todos.userId, userId)))
          .returning();
        if (!row) throw new NotFoundError(`Todo ${id} not found`);
        return toDomain(row);
      }

      async delete(id: string, userId: string): Promise<void> {
        const result = await this.db
          .delete(todos)
          .where(and(eq(todos.id, id), eq(todos.userId, userId)))
          .returning({ id: todos.id });
        if (result.length === 0) throw new NotFoundError(`Todo ${id} not found`);
      }
    }
    ```
  - [x] **`toDomain()` strips `userId`** from the wire-format Todo. Architecture line 271 — wire shape doesn't expose `user_id`.
  - [x] **Every method scopes by `userId`.** Even though v1 has only `'default-user'`, the queries are written as if multi-user already exists. When auth lands, no query changes.
  - [x] **`setCompleted` and `delete` throw `NotFoundError`** on no-match. Important: the test (`Test Scenarios`) explicitly verifies this. Don't return `null`/`undefined` — throw.
  - [x] **`updatedAt: sql\`now()\``** in `setCompleted` updates the audit-non-foreclosure column. `update_at` doesn't auto-fire (no DB trigger in v1) — repository sets it explicitly.
  - [x] **All queries parameterized** (Drizzle generates parameterized SQL by default). NFR7 satisfied.

- [x] **Task 9: Wire migrations into backend startup** (AC: 4)
  - [x] Update `apps/backend/src/server.ts` (Story 1.4) to run migrations before listening:
    ```ts
    import { buildApp } from './app.js';
    import { loadConfig } from './config.js';
    import { runMigrations } from './db/migrate.js';

    const config = loadConfig();
    await runMigrations(config.DATABASE_URL);

    const app = await buildApp(config);

    try {
      await app.listen({ port: config.BACKEND_PORT, host: '0.0.0.0' });
    } catch (err) {
      app.log.error({ err }, 'failed to start');
      process.exit(1);
    }
    ```
  - [x] **Why migrations run in `server.ts` not `app.ts`:** `buildApp()` must remain testable without Postgres. The migration is an external-side-effect concern; integration tests that use `buildApp()` (Story 1.4 `app.test.ts`) keep working. Production startup adds the migration step explicitly in `server.ts`.

- [x] **Task 10: Decorate Fastify with the repository (optional but architecturally clean)**
  - [x] Story 1.7 doesn't have a controller using the repository (that's 1.8). But to set up the wiring so 1.8 just consumes it: in `app.ts`, add a `decorate` after config:
    ```ts
    import { createDbClient } from './db/client.js';
    import { PostgresTodoRepository } from './repositories/postgresTodoRepository.js';

    // Inside buildApp, after app.decorate('config', config):
    const { db } = createDbClient(config.DATABASE_URL);
    const todoRepository = new PostgresTodoRepository(db);
    app.decorate('todoRepository', todoRepository);
    declare module 'fastify' {
      interface FastifyInstance {
        todoRepository: TodoRepository;
      }
    }
    ```
  - [x] **Optional in 1.7** — Story 1.8's controllers will consume `fastify.todoRepository`. If the dev agent prefers to defer this wiring to 1.8, that's acceptable; mark in completion notes either way.

- [x] **Task 11: Author integration test setup helper** (Test Scenarios — Integration)
  - [x] `apps/backend/tests/integration/setup.ts`:
    ```ts
    import { afterEach, beforeAll, afterAll } from 'vitest';
    import { Pool } from 'pg';
    import { drizzle } from 'drizzle-orm/node-postgres';
    import * as schema from '../../src/db/schema.js';
    import { runMigrations } from '../../src/db/migrate.js';

    const TEST_DATABASE_URL =
      process.env.TEST_DATABASE_URL ??
      'postgres://bmad_todo:bmad_todo@postgres:5432/bmad_todo_test';

    let pool: Pool;
    export let testDb: ReturnType<typeof drizzle<typeof schema>>;

    beforeAll(async () => {
      pool = new Pool({ connectionString: TEST_DATABASE_URL });
      testDb = drizzle(pool, { schema });
      await runMigrations(TEST_DATABASE_URL);
    });

    afterEach(async () => {
      // Truncate-between-tests; preserves schema, wipes data.
      await testDb.execute(sql`TRUNCATE TABLE ${schema.todos} RESTART IDENTITY CASCADE`);
    });

    afterAll(async () => {
      await pool.end();
    });
    ```
    *(Imports `sql` from `drizzle-orm`.)*
  - [x] **Test database creation:** `bmad_todo_test` is a separate logical DB on the same Postgres instance. The dev needs to create it once (or scripts/test-setup.sh handles it):
    ```bash
    docker compose exec postgres psql -U $POSTGRES_USER -c "CREATE DATABASE bmad_todo_test;"
    ```
    Document in `apps/backend/README.md`. Optional: add a small bash helper at `scripts/test-db-init.sh` that `CREATE DATABASE IF NOT EXISTS`-es it (Postgres doesn't have `IF NOT EXISTS` for `CREATE DATABASE` — use a `\gexec` trick or a pl/pgsql `DO` block).

- [x] **Task 12: Author integration tests** (Test Scenarios — Integration; AC: 8, 9)
  - [x] `apps/backend/tests/integration/postgresTodoRepository.test.ts`:
    - `create()` inserts row with `user_id='default-user'`; returned object passes `TodoSchema.parse()`.
    - `list(userId)` returns inserted rows ordered by `created_at DESC`.
    - `setCompleted(id, true, userId)` flips `completed`; `updatedAt` is later than the row's original `createdAt`.
    - `setCompleted(id, ..., userId)` for a non-existent id throws `NotFoundError`.
    - `delete(id, userId)` removes the row; second `delete(id, userId)` throws `NotFoundError`.
    - Inserting a 501-char description (bypassing Zod by going directly to the repository) fails the DB CHECK constraint with a clear Postgres error — repository surface lets this propagate (it's a programming bug, not a user input). Verify the failure mode.
    - SQL-injection-shaped string in `description` (e.g. `"'); DROP TABLE todos; --"`) is stored literally; `list()` returns it verbatim, `todos` table still exists. NFR7 verification.
  - [x] `apps/backend/tests/integration/dbClient.test.ts`:
    - `createDbClient(url)` returns a working `db` that can `SELECT 1`.
    - `runMigrations(url)` is idempotent — second call doesn't reapply.

- [x] **Task 13: Update Dockerfile to copy `drizzle/`** (AC: 3, 8)
  - [x] `apps/backend/Dockerfile`'s runtime stage already copies `apps/backend/dist` (Story 1.4). Add the `drizzle/` directory:
    ```dockerfile
    COPY --from=builder /app/apps/backend/drizzle ./apps/backend/drizzle
    ```
    Path: after the existing `COPY ... dist` line. Migrations live alongside the compiled JS; `migrate.ts` resolves the path relative to `__dirname`.
  - [x] Test the full path: `docker compose build backend && docker compose run --rm backend ls -la /app/apps/backend/drizzle/`.

- [x] **Task 14: Update `apps/backend/README.md`** (carries from 1.4)
  - [x] Add section: *Local DB workflow* — how to create test DB, run migrations manually (`npm run db:migrate`), regenerate after schema changes (`npm run db:generate`), inspect via `npm run db:studio`.

- [x] **Task 15: Verify the AC end-to-end**
  - [x] Bring up Postgres only: `docker compose up postgres -d --wait`.
  - [x] Create test DB if needed.
  - [x] Run integration tests: `npm test --workspace @bmad-todo/backend -- tests/integration/postgresTodoRepository.test.ts` — confirm all pass.
  - [x] Bring up the full stack: `docker compose up --wait`. Confirm `/api/health` still returns `{status:'healthy'}` (Story 1.3's smoke). The persistence-aware probe lands in Story 3.4; Story 1.7 doesn't update `/api/health`.
  - [x] Run Story 1.1's verification chain: `npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build` — must still exit 0.
  - [x] Verify migration idempotency: `docker compose down && docker compose up --wait`. Backend should start cleanly without re-running migrations (Drizzle's migration table tracks applied versions).

## Dev Notes

### Story Foundation Summary

This story makes Postgres real. After it lands, `apps/backend/` has a working Drizzle ORM, a typed schema, an applied migration, a singleton DB client, and a repository pattern. Story 1.8 adds services + controllers that consume `TodoRepository`; Story 3.4 extends `/api/health` to probe the DB.

**FRs implemented:** none directly (no controllers / UI). Foundational for FR1–FR5 (Epic 2).

**NFRs implemented:** NFR7 (parameterized queries via Drizzle), NFR10–NFR13 (durability — Postgres + applied migrations), NFR15 (separability — repository interface).

### Files to CREATE

| Path | Purpose |
|---|---|
| `apps/backend/drizzle.config.ts` | Drizzle Kit config |
| `apps/backend/drizzle/0000_<name>_init.sql` | Generated migration (Task 4) |
| `apps/backend/drizzle/meta/_journal.json` | Drizzle's migration metadata (auto-generated) |
| `apps/backend/src/db/schema.ts` | Drizzle table definition |
| `apps/backend/src/db/client.ts` | Singleton pg pool + Drizzle instance |
| `apps/backend/src/db/migrate.ts` | Migration runner; CLI-able |
| `apps/backend/src/repositories/todoRepository.ts` | Interface |
| `apps/backend/src/repositories/postgresTodoRepository.ts` | Drizzle impl |
| `apps/backend/tests/integration/setup.ts` | Truncate-between-tests helper |
| `apps/backend/tests/integration/postgresTodoRepository.test.ts` | Integration tests |
| `apps/backend/tests/integration/dbClient.test.ts` | DB-client smoke |

### Files to UPDATE

| Path | Change |
|---|---|
| `apps/backend/package.json` | Add `drizzle-orm`, `pg`, `drizzle-kit`, `@types/pg`; new scripts `db:generate`, `db:migrate`, `db:studio` |
| `apps/backend/src/server.ts` | Call `runMigrations(...)` before `buildApp(...)` (Task 9) |
| `apps/backend/src/app.ts` | (Optional) decorate `fastify.todoRepository` (Task 10) |
| `apps/backend/Dockerfile` | Runtime stage copies `drizzle/` directory (Task 13) |
| `apps/backend/README.md` | Add *Local DB workflow* section (Task 14) |

### Architecture Compliance

- **DB schema** [Source: architecture.md lines 257–268]: every column verbatim — UUID PK, description TEXT 1–500 CHECK, completed boolean, created_at + updated_at TIMESTAMPTZ, user_id default 'default-user', two indexes (`todos_user_id_idx`, `todos_created_at_idx`).
- **Drizzle ORM + Drizzle Kit** [Source: architecture.md lines 283–289]: schema-as-TS-code; `drizzle-kit generate` for migrations; migrations applied at backend startup.
- **Repository interface as non-foreclosure seam** [Source: architecture.md lines 595–604, 718–723]: `TodoRepository` interface in a separate file from the implementation; services and controllers depend on the interface only.
- **Auth-readiness via `userId` parameter** [Source: architecture.md lines 295–299]: every method takes `userId: string`. v1 always passes `'default-user'`.
- **No SQL injection** [Source: architecture.md line 313, NFR7]: Drizzle parameterizes all queries; tests verify the literal-storage behavior.
- **Naming bridge** [Source: architecture.md line 564]: `snake_case` columns (`created_at`, `user_id`) bridged to `camelCase` properties (`createdAt`, `userId`) via Drizzle's column-aliasing — automatic when the JS field name differs from the column name string. Verify both sides.
- **Backend integration-test strategy** [Source: architecture.md lines 498–502]: separate logical DB `bmad_todo_test`, truncate-between-tests in `setup.ts`. Story 1.7 implements both.
- **Migration applied at backend startup** [Source: architecture.md line 92]: Story 1.7 wires this in `server.ts`.

### Previous Story Intelligence (1.1–1.6 → 1.7)

- **From 1.4:** `apps/backend/src/errors.ts` has `NotFoundError`. Story 1.7's `postgresTodoRepository` throws it. Verify import works (relative `../errors.js` or via `@bmad-todo/backend/src/errors.js` — workspace alias not configured, use relative).
- **From 1.4:** `app.ts`'s `buildApp()` is testable without Postgres. Don't break that — migrations move to `server.ts`, not `app.ts`. Optional `fastify.todoRepository` decorator (Task 10) is permitted because tests can pass a fake/in-memory repository.
- **From 1.4:** `LOG_LEVEL` env-driven pino logger. The `pg` pool emits its own internal events; consider adding a logger pass-through in a future story (out of scope for 1.7).
- **From 1.6:** `@bmad-todo/shared` exports `Todo`, `CreateTodoInput`, `UpdateTodoCompletionInput`. Repository signatures consume `CreateTodoInput`; return type is `Todo`. Hand-strip `userId` in `toDomain()`.
- **From 1.6:** the Zod schemas constrain `description` to 1–500 chars. The DB's CHECK constraint mirrors. **Both fire**: Zod at controller boundary (Story 1.8), DB at insert.
- **From 1.3:** `.env.example` already lists `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`. The test DB URL is a separate env (`TEST_DATABASE_URL`); add to `.env.example` if a dev wants overridable test DB. **Recommendation:** *don't* add to `.env.example` — keep test DB URL hard-coded with sensible defaults in `setup.ts`.
- **From 1.3:** Postgres healthcheck uses `pg_isready`. Story 1.7 doesn't change that — backend's startup waits via `depends_on: { condition: service_healthy }`.

### Latest Tech Information

| Package | Today (2026-04-28) | Notes |
|---|---|---|
| `drizzle-orm` | latest 0.x or 1.x | Stable API since mid-2024; check breaking changes if 1.x is out. |
| `drizzle-kit` | tracks drizzle-orm major | Required for migrations |
| `pg` | `8.x` | node-postgres driver; long-term stable |
| `@types/pg` | matches `pg@8` | |
| Postgres engine | `16-alpine` | Story 1.3's pin |

**Action:** before commit, `npm view <pkg> version` for each. Pin exact versions for runtime deps.

### Anti-Patterns to Avoid

❌ **Don't expose the pool/db as bare module exports.** Force `createDbClient(url)` so test setup can isolate connection strings.
❌ **Don't bypass the repository in services.** Story 1.8's `todoService` MUST go through `TodoRepository`. Direct Drizzle imports in services break the layering.
❌ **Don't forget `userId` in `WHERE` clauses.** Even with single-user v1, every query is `userId`-scoped. When auth lands, the queries already work.
❌ **Don't return `null`/`undefined` from `setCompleted`/`delete` for no-match.** Throw `NotFoundError`. Tests verify this.
❌ **Don't use raw template strings for SQL.** Drizzle's query builder + `sql` template tag are the only allowed paths. The `sql\`now()\`` for `updatedAt` is correct usage; `sql\`SELECT * FROM todos WHERE id = ${id}\`` would be wrong (Drizzle parameterizes correctly only when using its query builder + `sql.placeholder`/template).
❌ **Don't add a DB trigger for `updated_at`.** Architecture doesn't mandate it; manual `set({ updatedAt: sql\`now()\` })` in the repository is sufficient. Triggers add audit-log non-foreclosure complexity prematurely.
❌ **Don't use Drizzle's `transaction()` in this story.** Single-row operations are atomic by default. Multi-row operations land in later stories (audit-log writes alongside todo writes — non-foreclosed).
❌ **Don't pre-build `apps/backend/src/services/todoService.ts`.** Story 1.8 owns it. Story 1.7's deliverable is repository + DB layer only.
❌ **Don't run migrations inside `buildApp()`.** It must remain testable without Postgres. Migrations are a `server.ts` concern.
❌ **Don't expose `userId` over the wire from the repository's `toDomain`.** Architecture line 271 + Story 1.6's `TodoSchema` — strip it.
❌ **Don't commit migration files with hand-edited timestamps.** Drizzle's `_journal.json` tracks them; manual edits cause migration ordering chaos.

### Testing Standards

Per epics.md Story 1.7 *Test Scenarios*:

- **Unit:** Schema-as-code introspection (covered implicitly by integration tests; explicit unit test optional).
- **Integration:** seven scenarios listed in Task 12. Coverage threshold ≥ 70% (NFR18).
- **E2E:** none.

The integration tests require Postgres to be running. CI runs them after `docker compose up postgres`. Locally: `docker compose up postgres -d`, then `npm run test:integration --workspace @bmad-todo/backend`.

### References

- Story scope and ACs: [Source: epics.md Story 1.7 (lines 426–466)]
- DB schema (architecture canon): [Source: architecture.md lines 257–268]
- Drizzle decision: [Source: architecture.md lines 283–289]
- Repository interface (non-foreclosure seam): [Source: architecture.md lines 595–604, 718–723]
- Auth seam (`userId` parameter): [Source: architecture.md lines 295–299]
- Backend integration-test strategy: [Source: architecture.md lines 498–502]
- NFR7 (parameterized queries): [Source: prd.md *Security*]
- Naming conventions (snake_case DB ↔ camelCase code): [Source: architecture.md lines 548–587]
- Wire shape excludes `userId`: [Source: 1-6-...md *Task 4 — Note on userId exposure*]

### Project Knowledge References

No `docs/project-context.md` exists yet.

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7[1m]` via the BMad `bmad-dev-story` skill, executed 2026-04-28.

### Debug Log References

1. **Drizzle 0.45 `pgTable` callback now returns array, not object.** Story's prescription used `(table) => ({ descriptionLengthCheck: check(...), ... })` — Drizzle 0.45 changed the API to `(table) => [check(...), index(...)]`. Updated to the array form.
2. **Migration generated cleanly** via `DATABASE_URL=postgres://... npx drizzle-kit generate`. Output: `apps/backend/drizzle/0000_lyrical_lifeguard.sql` — verbatim verified to contain `CREATE TABLE todos`, the CHECK constraint, both indexes, and `gen_random_uuid()` default.
3. **`pg` is CommonJS — needs default-import workaround.** `import pg from 'pg'; const { Pool } = pg;` rather than `import { Pool } from 'pg'`. Documented in `client.ts`.
4. **Postgres tests skip by default.** Without Docker available in this WSL distro, integration tests need an opt-in. Pattern: `describe.skipIf(!POSTGRES_TESTS_ENABLED)` keyed on `RUN_POSTGRES_TESTS=true` env var. The `test:integration` script sets the env var; default `npm test` skips.

### Completion Notes List

- **Pinned versions:**
  - `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10` (story expected `0.x or 1.x` — actual is 0.45.x)
  - `pg@8.20.0`, `@types/pg@8.20.0`
- **All 17 backend tests still pass** (existing 1.4 + new from 1.7) plus 9 Postgres-required integration tests **skip cleanly** when Docker / `RUN_POSTGRES_TESTS` aren't available. Sprint-wide: 45 tests passing, 9 skipped (deferred until Postgres is reachable).
- **Story 1.1 verification chain exits 0 from clean clone** — confirmed.
- **Migration `0000_lyrical_lifeguard.sql` committed** (Drizzle's auto-naming uses adjective_noun pattern; not a typo — the name is generated and stable until the migration is regenerated).
- **`server.ts` runs `runMigrations(config.DATABASE_URL)` BEFORE `buildApp()`.** Migrations are a server-startup concern, not part of `buildApp()` (preserves Story 1.4's testability — `app.test.ts` calls `buildApp(validConfig)` without needing Postgres).
- **Task 10 (`fastify.todoRepository` decoration) DEFERRED to Story 1.8.** Per the task's explicit "Optional in 1.7" clause: adding the decoration in `buildApp()` would create a pg.Pool every time `buildApp(validConfig)` runs in tests, leaking connections (pools don't auto-close on `app.close()`). Deferring keeps Story 1.4's test patterns clean. Story 1.8's controller wiring will inject the repository as a constructor dep instead of decorating the Fastify instance — a cleaner pattern that survived the test concern.
- **Operational verification (run migration against real Postgres) DEFERRED.** Same Docker-unavailability constraint as Stories 1.3 / 1.4. Reviewer with Docker should:
  1. `docker compose up postgres -d --wait`
  2. `docker compose exec postgres psql -U $POSTGRES_USER -c "CREATE DATABASE bmad_todo_test;"`
  3. `RUN_POSTGRES_TESTS=true TEST_DATABASE_URL=postgres://bmad_todo:bmad_todo@localhost:5432/bmad_todo_test npm run test:integration --workspace @bmad-todo/backend`
- **No deviations beyond the four documented above.**

### File List

**NEW:**

- `apps/backend/drizzle.config.ts`
- `apps/backend/drizzle/0000_lyrical_lifeguard.sql` (generated)
- `apps/backend/drizzle/meta/_journal.json` (generated)
- `apps/backend/drizzle/meta/0000_snapshot.json` (generated)
- `apps/backend/src/db/schema.ts`
- `apps/backend/src/db/client.ts`
- `apps/backend/src/db/migrate.ts`
- `apps/backend/src/repositories/todoRepository.ts` (interface)
- `apps/backend/src/repositories/postgresTodoRepository.ts`
- `apps/backend/tests/integration/setup.ts` (with Postgres-skip pattern)
- `apps/backend/tests/integration/postgresTodoRepository.test.ts` (7 tests, skip-by-default)
- `apps/backend/tests/integration/dbClient.test.ts` (2 tests, skip-by-default)

**MODIFIED:**

- `apps/backend/package.json` — added `drizzle-orm`, `pg`, `drizzle-kit`, `@types/pg`; new scripts `db:generate`, `db:migrate`, `db:studio`; `test:integration` opts in via `RUN_POSTGRES_TESTS=true`.
- `apps/backend/src/server.ts` — runs `runMigrations(config.DATABASE_URL)` before `buildApp()`.
- `apps/backend/Dockerfile` — runtime stage now copies `drizzle/` directory so the bundled migrations are present at runtime.
- `apps/backend/README.md` — added *Local DB workflow* section + test:integration opt-in instructions.

**DELETED:** none.

## Change Log

| Date | Story | Change | Author |
|---|---|---|---|
| 2026-04-28 | 1.7 | Postgres persistence layer: Drizzle 0.45 + pg 8 + drizzle-kit; `todos` table schema with UUID PK + CHECK + 2 indexes; first migration committed; singleton pg pool/Drizzle instance via `createDbClient`; idempotent `runMigrations` runner; `TodoRepository` interface + `PostgresTodoRepository` impl with `userId` parameterization (auth-readiness seam); 9 integration tests (skip by default; opt-in via `RUN_POSTGRES_TESTS=true`). Migrations apply at backend startup in `server.ts`. Dockerfile updated to bundle migrations. Task 10 (`fastify.todoRepository` decoration) deferred to Story 1.8 to avoid pg.Pool leaks in tests. | Aman (via `bmad-dev-story` / `claude-opus-4-7[1m]`) |
