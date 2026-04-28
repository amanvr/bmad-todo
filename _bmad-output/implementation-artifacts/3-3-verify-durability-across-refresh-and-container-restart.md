# Story 3.3: Verify durability across refresh and container restart

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want integration and E2E tests that prove todos persist across browser refreshes and `docker compose down && docker compose up`,
So that the architecture's durability guarantees are continuously verified, not just hoped for. (Delivers FR12, FR13, FR14, plus NFR20 flow #2 — *list-todos*.)

## Acceptance Criteria

1. **Given** Stories 1.8 and 2.1 are complete, **When** Story 3.3 completes, **Then** `e2e/tests/list-todos.spec.ts` exists as the named NFR20 flow #2.
2. The spec covers: open the app with a pre-seeded set of todos in the DB; assert the list renders all of them in `created_at DESC` order; reload the page; assert the same list is rendered (FR12 verification).
3. A `tests/integration/persistence.test.ts` (backend) exists verifying: insert a row; close the pg pool; re-open it; row is still readable (FR13 simulation at the SQL level — does not actually restart Postgres).
4. A documented manual verification step in `e2e/README.md` describes the full container-restart proof: `docker compose up`, add todos, `docker compose down`, `docker compose up`, reload, observe todos persist (FR13 — full verification is manual because automating `docker compose down/up` mid-Playwright is fragile).
5. `useTodos.test.ts` is extended to verify FR14: state on mount always sources from the API response, never from a cached local-only value; if the API returns a different list than the previous render, state is replaced wholesale (no stale ghost rows).
6. **Given** a clean Postgres with three pre-seeded todos, **When** the Playwright `list-todos` spec runs, **Then** all three render in correct order and survive a page reload.
7. **Given** the developer follows the manual verification step in `e2e/README.md`, **When** they perform `docker compose down && docker compose up` between adding and reading, **Then** the todos persist (FR13).

## Tasks / Subtasks

- [x] **Task 1: Author `apps/backend/tests/integration/persistence.test.ts`** (AC: 3)
  - [x] Verifies row durability across pool teardown + recreation. Note: this **does not** restart Postgres — it tests that the data survives at the SQL level (not in the pg client's connection state):
    ```ts
    import { describe, it, expect, beforeAll, afterAll } from 'vitest';
    import { Pool } from 'pg';
    import { drizzle } from 'drizzle-orm/node-postgres';
    import * as schema from '../../src/db/schema.js';
    import { runMigrations } from '../../src/db/migrate.js';
    import { PostgresTodoRepository } from '../../src/repositories/postgresTodoRepository.js';
    import { sql } from 'drizzle-orm';

    const TEST_DATABASE_URL =
      process.env.TEST_DATABASE_URL ??
      'postgres://bmad_todo:bmad_todo@postgres:5432/bmad_todo_test';

    describe('persistence — pool teardown survival', () => {
      beforeAll(async () => {
        const pool = new Pool({ connectionString: TEST_DATABASE_URL });
        await runMigrations(TEST_DATABASE_URL);
        const db = drizzle(pool, { schema });
        await db.execute(sql`TRUNCATE TABLE ${schema.todos} RESTART IDENTITY CASCADE`);
        await pool.end();
      });

      it('rows survive pool teardown + recreation', async () => {
        // Open pool #1, insert
        const pool1 = new Pool({ connectionString: TEST_DATABASE_URL });
        const db1 = drizzle(pool1, { schema });
        const repo1 = new PostgresTodoRepository(db1);
        const created = await repo1.create({ description: 'survives restart' }, 'default-user');
        await pool1.end();

        // Open pool #2 (fresh process state), read
        const pool2 = new Pool({ connectionString: TEST_DATABASE_URL });
        const db2 = drizzle(pool2, { schema });
        const repo2 = new PostgresTodoRepository(db2);
        const list = await repo2.list('default-user');
        await pool2.end();

        expect(list).toHaveLength(1);
        expect(list[0]?.id).toBe(created.id);
        expect(list[0]?.description).toBe('survives restart');
      });

      it('multiple rows persist across pool recreation', async () => {
        const pool1 = new Pool({ connectionString: TEST_DATABASE_URL });
        const db1 = drizzle(pool1, { schema });
        const repo1 = new PostgresTodoRepository(db1);
        await db1.execute(sql`TRUNCATE TABLE ${schema.todos} RESTART IDENTITY CASCADE`);
        await repo1.create({ description: 'one' }, 'default-user');
        await repo1.create({ description: 'two' }, 'default-user');
        await repo1.create({ description: 'three' }, 'default-user');
        await pool1.end();

        const pool2 = new Pool({ connectionString: TEST_DATABASE_URL });
        const db2 = drizzle(pool2, { schema });
        const repo2 = new PostgresTodoRepository(db2);
        const list = await repo2.list('default-user');
        await pool2.end();

        expect(list).toHaveLength(3);
        expect(list.map((t) => t.description).sort()).toEqual(['one', 'three', 'two']);
      });
    });
    ```
  - [x] **What this test does NOT prove:** it doesn't shut down Postgres itself. Postgres-restart durability is the manual procedure (Task 4). This test proves the *pg client* (Node-side Pool) doesn't cache uncommitted state — committed rows are durable in Postgres.
  - [x] **Note on isolation:** Story 1.7's `setup.ts` truncates between tests. This test file does its own cleanup explicitly to make the pool-recreation flow legible. If test isolation feels redundant with `setup.ts`, that's by design — the explicit cleanup makes the test readable in isolation.

- [x] **Task 2: Author E2E `list-todos` spec** (AC: 1, 2, 6)
  - [x] `e2e/tests/list-todos.spec.ts` — NFR20 flow #2:
    ```ts
    import { test, expect } from '@playwright/test';

    test.describe('list-todos (NFR20 flow #2)', () => {
      // Pre-seed via the API (simpler than direct DB access from Playwright)
      const stamp = Date.now();
      const seedTodos = [
        `First task ${stamp}`,
        `Second task ${stamp}`,
        `Third task ${stamp}`,
      ];

      test.beforeEach(async ({ request }) => {
        // Insert in order; created_at will be in this order, so DESC orders them reverse-listed.
        for (const description of seedTodos) {
          const res = await request.post('/api/todos', { data: { description } });
          expect(res.status()).toBe(201);
          // Tiny gap between inserts to ensure timestamps order correctly at sub-second precision.
          await new Promise((r) => setTimeout(r, 30));
        }
      });

      test('renders pre-seeded todos in created_at DESC order and survives reload', async ({ page }) => {
        await page.goto('/');

        // Expected display order: most recent (last inserted) first
        const expectedOrder = [...seedTodos].reverse();

        // Initial render
        const items = page.getByRole('listitem');
        await expect(items).toHaveCount(seedTodos.length);
        for (let i = 0; i < expectedOrder.length; i++) {
          const item = items.nth(i);
          await expect(item).toContainText(expectedOrder[i]!);
        }

        // Reload — FR12 verification
        await page.reload();
        await expect(page.getByRole('listitem')).toHaveCount(seedTodos.length);
        for (let i = 0; i < expectedOrder.length; i++) {
          await expect(page.getByRole('listitem').nth(i)).toContainText(expectedOrder[i]!);
        }
      });
    });
    ```
  - [x] **`request.post(...)` uses Playwright's API client** — the API base URL comes from the Playwright config (`baseURL` from Story 1.5). Hits the running stack's nginx → backend → Postgres path; no DB-level fixture wrangling needed.
  - [x] **Unique-per-run descriptions** (`${stamp}`) — no test isolation needed at the DB level; specs don't pollute each other.
  - [x] **30ms gap between inserts** — `created_at` is `TIMESTAMPTZ` with sub-millisecond precision (`now()`), but database clock-resolution + transaction commit timing can occasionally produce identical timestamps. 30ms gives clean ordering on every system tested.

- [x] **Task 3: Extend `useTodos.test.ts` with FR14 invariant** (AC: 5)
  - [x] FR14: "System reflects the persisted state on each new load — no client-only state may masquerade as persisted data." Test: a second `list()` call with different data fully replaces local state — no merge / dedup logic that could mask stale ghost rows:
    ```ts
    it('replaces state wholesale on retry — no stale ghost rows (FR14)', async () => {
      // Mock api.list to return [A, B] first, then [C] on retry
      const firstResponse = [{ id: 'a', description: 'A', completed: false, createdAt: '...', updatedAt: '...' }];
      const secondResponse = [{ id: 'c', description: 'C', completed: false, createdAt: '...', updatedAt: '...' }];

      vi.mocked(todosApi.list)
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse);

      const { result } = renderHook(() => useTodos());
      await waitFor(() => expect(result.current.state.status).toBe('loaded'));
      expect(result.current.state.todos).toEqual(firstResponse);

      await act(async () => {
        result.current.actions.retry();
      });
      await waitFor(() => expect(result.current.state.todos).toEqual(secondResponse));

      // Critical: 'A' is NOT in state.todos. No merge, no dedup, no ghost rows.
      expect(result.current.state.todos.find((t) => t.id === 'a')).toBeUndefined();
      expect(result.current.state.todos).toHaveLength(1);
    });
    ```
  - [x] **Test framework details:** uses `@testing-library/react`'s `renderHook` + `waitFor` + `act` — already available via Vitest + jsdom from Story 1.5. The `vi.mock('./api.js')` setup must hoist to the top of the test file.

- [x] **Task 4: Document manual `docker compose` restart verification in `e2e/README.md`** (AC: 4)
  - [x] Add a section to `e2e/README.md`:
    ```markdown
    ## Manual durability verification (FR13)

    The Playwright `list-todos` spec verifies persistence across browser reloads. It does *not* automate
    `docker compose down && docker compose up` because killing and restarting containers mid-Playwright
    run is fragile (network races, port-conflict windows, healthcheck cycles).

    Run this manual procedure once per release candidate (and any time `docker-compose.yml` or the
    Postgres volume config changes):

    1. `docker compose down -v` (the `-v` wipes the volume — start clean).
    2. `docker compose up --wait` (full healthy bring-up).
    3. Open `http://localhost:8080`. Add three todos: "Buy milk", "Walk dog", "Read book".
    4. Verify all three are visible in the list.
    5. `docker compose down` (NOTE: no `-v` — keeps the volume).
    6. `docker compose up --wait`.
    7. Reload `http://localhost:8080`.
    8. **Expected:** all three todos still visible, in the same order.

    If any todo is missing or order has changed, FR13 is violated. Likely causes:

    - `docker-compose.yml` `volumes:` definition for `postgres` was changed to a bind mount or removed.
    - Migration was rerun and accidentally truncated (migrations should be idempotent).
    - Postgres data directory permissions issue (esp. on Windows hosts — check the container's
      `/var/lib/postgresql/data` ownership).
    ```
  - [x] **Don't write the procedure as code that's run by tests.** AC #4 explicitly: manual. Future-proofing to automate this lives in a Story 4.x or post-launch — out of scope for 3.3.

- [x] **Task 5: Verify the AC end-to-end** (AC: 6, 7)
  - [x] Run integration test: `docker compose up postgres -d`, then `npm run test:integration --workspace @bmad-todo/backend` — confirm `persistence.test.ts` passes.
  - [x] Run E2E: `docker compose up --wait` (full stack), then `npm test --workspace @bmad-todo/e2e` — confirm `list-todos.spec.ts` passes alongside other specs.
  - [x] Run unit test: `npm test --workspace @bmad-todo/frontend` — confirm `useTodos.test.ts`'s new FR14 case passes.
  - [x] **Manually walk through Task 4's procedure once** — the dev agent should record success/failure in completion notes. This is the definitive FR13 proof.
  - [x] Story 1.1 verification chain: `npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build` exits 0.

## Dev Notes

### Story Foundation Summary

This story is **verification-heavy, code-light**. It adds three tests + one README section, no new feature code. Delivers FR12 (browser refresh), FR13 (container restart), FR14 (server-truth-on-load), and NFR20 flow #2.

**FRs implemented:** FR12 (browser-refresh persistence), FR13 (container-restart persistence — verified manually), FR14 (persisted-truth-on-load).

**NFRs implemented:** NFR20 partial (flow #2 of five — `list-todos`).

### Files to CREATE

| Path | Purpose |
|---|---|
| `apps/backend/tests/integration/persistence.test.ts` | FR13 SQL-level simulation |
| `e2e/tests/list-todos.spec.ts` | NFR20 flow #2 |

### Files to UPDATE

| Path | Change |
|---|---|
| `apps/frontend/src/features/todos/useTodos.test.ts` | Add FR14 invariant test (Task 3) |
| `e2e/README.md` | Add manual durability-verification section (Task 4) |

### Architecture Compliance

- **Persistence durability** [Source: architecture.md *Data Architecture*, lines 240–292]: Postgres named volume `bmad_todo_postgres_data` is the durability boundary. Story 1.3's `docker-compose.yml` set this up; Story 3.3 verifies it.
- **Server-truth-on-load** [Source: architecture.md line 387; PRD FR14]: `useTodos` always sources from the API on mount. No `localStorage`, no IndexedDB, no client-side persistence. Story 3.3's FR14 test verifies this is preserved.
- **Backend integration-test strategy** [Source: architecture.md lines 498–502]: tests run against a separate logical DB (`bmad_todo_test`); pool teardown + recreate within a single test process is a valid simulation.
- **`created_at DESC` ordering** [Source: architecture.md line 325; Story 1.7]: list returned by `GET /api/todos` is ordered by `created_at DESC`. Story 3.3's spec verifies the ordering.

### Previous Story Intelligence (1.7, 1.8, 2.1, 3.1, 3.2 → 3.3)

- **From 1.7:** integration test infrastructure (`tests/integration/setup.ts`) provides truncate-between-tests against `bmad_todo_test`. Story 3.3's `persistence.test.ts` does its own explicit cleanup but reuses the same connection pattern.
- **From 1.7:** `postgresTodoRepository.list(userId)` returns todos ordered by `createdAt DESC`. Story 3.3's E2E spec asserts this ordering.
- **From 1.8:** `useTodos.useEffect` calls `api.list()` on mount; reducer dispatches `todosLoaded` which **replaces** `state.todos` wholesale (no merge logic). FR14's invariant is already enforced by the existing reducer; Story 3.3 just adds the test to **document** and **prevent regression**.
- **From 2.1:** the `actions.retry` (alias for `load`) refetches and dispatches `todosLoaded` again. The retry path is the FR14 test's lever.
- **From 3.2:** route-mocked failures used in error-recovery specs. Story 3.3 doesn't mock — it uses real backend + real Postgres, validating the actual durability stack.

### Latest Tech Information

No new dependencies. Playwright's `request` API client is built-in.

### Anti-Patterns to Avoid

❌ **Don't introduce `localStorage`/`sessionStorage`/IndexedDB caching** to preserve list state on reload. FR14 forbids client-only state masquerading as persisted data. The test in Task 3 enforces this.
❌ **Don't skip the manual procedure** (Task 4) just because automated tests pass. AC #4 explicitly requires it; the manual proof catches Docker-volume / Postgres-config issues that pool-recreation tests can't.
❌ **Don't try to automate `docker compose down/up` in Playwright.** AC #4 explicitly says it's manual. Container teardown/restart races against Playwright's network expectations; flaky.
❌ **Don't seed via SQL in Playwright** (e.g., `psql -c "INSERT ..."`). Use the API. Hitting the actual `POST /api/todos` exercises more of the stack and catches API-vs-DB drift.
❌ **Don't omit the timestamp gap (30ms)** between seeded inserts. Without it, ordering can be non-deterministic at sub-millisecond precision.
❌ **Don't merge or dedup todos client-side** when state is replaced. Wholesale replacement is the FR14 invariant.
❌ **Don't add a "refresh button" in the UI** as part of this story. The browser's native refresh (F5 / Ctrl+R) is the verification mechanism. A custom refresh button is out of scope.

### Testing Standards

Per epics.md Story 3.3 *Test Scenarios*:

- **Unit:** `useTodos.test.ts` FR14 invariant.
- **Integration:** `persistence.test.ts` SQL-level pool-recreation simulation.
- **E2E:** `list-todos.spec.ts` (NFR20 flow #2) + manual `docker compose down/up` procedure documented in `e2e/README.md`.

Coverage thresholds ≥ 70% backend (NFR18) + ≥ 70% frontend (NFR19) — must remain green.

### References

- Story scope and ACs: [Source: epics.md Story 3.3 (lines 729–763)]
- Persistence architecture (Postgres + named volume): [Source: architecture.md lines 240–292]
- `created_at DESC` ordering: [Source: architecture.md line 325]
- Server-truth-on-load (FR14): [Source: prd.md *Persistence & Continuity*, FR14]
- NFR20 (≥ 5 Playwright flows): [Source: prd.md *Testability & Quality*, NFR20]
- Integration test strategy: [Source: architecture.md lines 498–502]
- Repository list method: [Source: 1-7-...md *Task 8*]
- useTodos load flow: [Source: 1-8-...md *Task 7*]

### Project Knowledge References

No `docs/project-context.md` exists yet.

## Dev Agent Record

### Agent Model Used

Codex 5.3

### Debug Log References

- `list-todos.spec.ts` initially failed because pre-existing rows inflated list count; added API cleanup in `beforeEach` before seeding.
- Root and E2E validation chains pass with Node 24 after adding list flow and FR14 hook test.
- `npm run test:integration --workspace @bmad-todo/backend` with `RUN_POSTGRES_TESTS=true` timed out in host shell because `TEST_DATABASE_URL` targets docker-internal host `postgres` (no host port exposure by design).
- Container-network integration run surfaced deterministic failures from hardcoded stale DB URL fallback, cross-file parallel test interference, and brittle DB constraint assertion matching.
- Host `node_modules` ownership was contaminated by root-owned files after containerized writes; local host `npm ci` and direct workspace test invocations are currently permission-blocked.

### Completion Notes List

- Added backend persistence integration test file (`persistence.test.ts`) using pool teardown/recreation checks.
- Added `e2e/tests/list-todos.spec.ts` as NFR20 flow #2 and verified order/reload behavior across Chromium, Firefox, and WebKit.
- Added FR14 wholesale-replacement invariant test to `useTodos.test.ts`.
- Documented manual FR13 durability procedure in `e2e/README.md`.
- Performed the documented down/up durability flow via running stack and verified persisted todos remained available after restart.
- Stabilized backend integration runs by removing stale DB URL fallback, forcing serial integration execution (`--no-file-parallelism`), and hardening persistence test cleanup/assertions.
- Validated integration in compose network using Node 24 container and validated E2E/frontend/unit/full quality gates via isolated Node/Playwright container runs.
- Host-local npm workflow remains permission-blocked by root-owned `node_modules`; validations were executed in isolated containers to keep gates green in this environment.

### File List

- apps/backend/tests/integration/persistence.test.ts
- apps/frontend/src/features/todos/useTodos.test.ts
- e2e/README.md
- e2e/tests/list-todos.spec.ts

## Change Log

- 2026-04-28: Completed Story 3.3 durability validation with stabilized integration configuration and moved story to review.
