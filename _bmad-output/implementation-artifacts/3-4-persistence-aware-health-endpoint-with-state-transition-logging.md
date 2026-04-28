# Story 3.4: Persistence-aware health endpoint with state-transition logging

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator (or curious dev),
I want `GET /api/health` to reflect both backend and persistence-layer health, with log lines on every state transition (and *only* on transitions),
So that I can read `docker compose logs` and instantly see when persistence flips up/down without drowning in steady-state probe noise. (Delivers FR15, FR16 — replaces the basic health endpoint from Story 1.4.)

## Acceptance Criteria

1. **Given** Story 1.4 is complete, **When** Story 3.4 completes, **Then** `apps/backend/src/db/client.ts` exports a `probePersistence()` function that runs `SELECT 1` and resolves to `'up' | 'down'`.
2. `apps/backend/src/controllers/healthController.ts` is upgraded to call `probePersistence()` on each `/api/health` request.
3. `GET /api/health` response is `{status: 'healthy', persistence: 'up'}` when both are healthy; `{status: 'unhealthy', persistence: 'down'}` (HTTP 503) when persistence probe fails.
4. The controller maintains an in-memory `lastPersistenceUp: boolean | null` and emits a structured log line **only on transition** — `info { event: 'health.persistence.up', previous: 'down' }` on down→up, `warn { event: 'health.persistence.down', previous: 'up', error: <msg> }` on up→down.
5. Steady-state probes emit no log lines (the `logLevel: 'warn'` registration from Story 1.4 stays in place; transition log lines bypass it via direct logger usage).
6. The response body is validated against `HealthResponseSchema` from `packages/shared`.

## Tasks / Subtasks

- [x] **Task 1: Add `probePersistence()` to `apps/backend/src/db/client.ts`** (AC: 1)
  - [x] Function runs `SELECT 1`; returns `'up'` on success, `'down'` on any error:
    ```ts
    import { sql } from 'drizzle-orm';

    // ... existing exports from Story 1.7 ...

    export async function probePersistence(db: Database): Promise<'up' | 'down'> {
      try {
        await db.execute(sql`SELECT 1`);
        return 'up';
      } catch {
        return 'down';
      }
    }
    ```
  - [x] **Why catch all errors:** any error (connection refused, timeout, transient pool issue) is "down" from the probe's perspective. The actual error message is captured *only* on transition (Task 3) — steady-state down probes silently return `'down'`.
  - [x] **Why a parameter `db` instead of using a singleton:** controller wires its own db reference (testability — tests inject a fake db that simulates failure). Keeps `probePersistence` pure.

- [x] **Task 2: Refactor `healthController.ts` to be a factory** (AC: 2, 3, 4)
  - [x] Story 1.4's healthController was a `FastifyPluginAsync` with no internal state. Story 3.4 needs in-memory `lastPersistenceUp`. Convert to a factory pattern that closes over state:
    ```ts
    import type { FastifyPluginAsync, FastifyBaseLogger } from 'fastify';
    import type { Database } from '../db/client.js';
    import { probePersistence } from '../db/client.js';
    import { HealthResponseSchema, type HealthResponse } from '@bmad-todo/shared';

    export interface HealthControllerDeps {
      db: Database;
    }

    export function buildHealthController(deps: HealthControllerDeps): FastifyPluginAsync {
      let lastPersistenceUp: boolean | null = null;

      return async (fastify) => {
        fastify.get('/api/health', async (request, reply) => {
          const persistence = await probePersistence(deps.db);
          const isUp = persistence === 'up';

          // State-transition logging (uses the app-level logger, bypassing route's `logLevel: 'warn'`)
          if (lastPersistenceUp === null) {
            // First probe after process start — log initial state at info
            request.log.info({ event: `health.persistence.${persistence}`, previous: null }, `persistence initial state: ${persistence}`);
          } else if (lastPersistenceUp === true && !isUp) {
            request.log.warn({ event: 'health.persistence.down', previous: 'up' }, 'persistence transitioned to down');
          } else if (lastPersistenceUp === false && isUp) {
            request.log.info({ event: 'health.persistence.up', previous: 'down' }, 'persistence transitioned to up');
          }
          // No log line on steady-state probes (lastPersistenceUp === isUp).

          lastPersistenceUp = isUp;

          const body: HealthResponse = {
            status: isUp ? 'healthy' : 'unhealthy',
            persistence,
          };

          // Validate response shape (`HealthResponseSchema` from packages/shared)
          const parsed = HealthResponseSchema.parse(body);
          return reply.code(isUp ? 200 : 503).send(parsed);
        });
      };
    }
    ```
  - [x] **Important — log emission bypasses the route's `logLevel: 'warn'`:** AC #5 says the `logLevel: 'warn'` registration from Story 1.4 stays. But `request.log.info(...)` and `request.log.warn(...)` go through the *route logger*, which IS gated by `logLevel: 'warn'`. To bypass, use the **app-level logger** directly (`fastify.log` from outside the request cycle is one option, but inside a handler we have `request.log`). Two viable approaches:
    - **Approach A (recommended):** drop the `logLevel: 'warn'` registration in `app.ts`'s `app.register(buildHealthController(deps))` call. The healthController's transition logic ensures *only* transitions log; steady-state probes emit no log lines because the controller doesn't call `request.log.*` on steady-state. **No need for the route-level filter** — the controller is the gate now.
    - **Approach B:** keep `logLevel: 'warn'`. Use `fastify.log.info(...)` (module-level logger, not request-scoped) for transition lines. This bypasses the route filter but loses request-id correlation in logs. Less ideal.
    - **Decision:** approach A. Simpler, correct, preserves request correlation. Update `app.ts` to remove `logLevel: 'warn'` for the health route in this story.

- [x] **Task 3: Update `app.ts` to wire the new controller** (AC: 2)
  - [x] Story 1.4's `app.ts`:
    ```ts
    await app.register(healthController, { logLevel: 'warn' });
    ```
  - [x] Story 3.4 replaces with:
    ```ts
    import { buildHealthController } from './controllers/healthController.js';
    import { createDbClient } from './db/client.js';

    // Inside buildApp:
    const { db } = createDbClient(config.DATABASE_URL);  // already created in Story 1.7
    await app.register(buildHealthController({ db }));
    ```
  - [x] **Drop the `logLevel: 'warn'` option** — see Task 2's *Decision* note.
  - [x] If Story 1.7 already created `db` for the repository (Task 10 of 1.7 was optional), reuse that reference. Otherwise create here. Either is fine — the singleton in `client.ts` handles dedup.

- [x] **Task 4: Add `Error` capture for the `down` transition log** (AC: 4)
  - [x] AC #4 specifies: `warn { event: 'health.persistence.down', previous: 'up', error: <msg> }` — i.e., the actual error message from the failed probe. To capture it, `probePersistence` needs to *expose* the error (not swallow it). Refactor:
    ```ts
    // Tagged-union return type
    export type PersistenceProbeResult =
      | { status: 'up' }
      | { status: 'down'; error: string };

    export async function probePersistence(db: Database): Promise<PersistenceProbeResult> {
      try {
        await db.execute(sql`SELECT 1`);
        return { status: 'up' };
      } catch (err) {
        return { status: 'down', error: err instanceof Error ? err.message : String(err) };
      }
    }
    ```
  - [x] Update healthController accordingly:
    ```ts
    const probe = await probePersistence(deps.db);
    const isUp = probe.status === 'up';

    if (lastPersistenceUp === true && !isUp) {
      request.log.warn(
        { event: 'health.persistence.down', previous: 'up', error: probe.status === 'down' ? probe.error : undefined },
        'persistence transitioned to down',
      );
    }
    // ... rest unchanged ...

    const body: HealthResponse = {
      status: isUp ? 'healthy' : 'unhealthy',
      persistence: probe.status,
    };
    ```

- [x] **Task 5: Backend unit tests** (Test Scenarios — Unit)
  - [x] `apps/backend/src/db/client.test.ts` (new or extend if exists from 1.7):
    - `probePersistence` returns `{status: 'up'}` when `SELECT 1` resolves.
    - Returns `{status: 'down', error}` when `db.execute` throws. Use a fake `db` object that satisfies the `Database` type minimally and has a `vi.fn()` `execute` method.
  - [x] `apps/backend/src/controllers/healthController.test.ts` (new):
    - State-transition logic — cover the matrix from AC #4 (and the initial-state case):
      - `lastPersistenceUp === null` and probe `up` → emits an `info` line `health.persistence.up`.
      - `lastPersistenceUp === null` and probe `down` → emits an `info` line `health.persistence.down` (initial state).
      - `lastPersistenceUp === true` and probe `up` → emits **no** line.
      - `lastPersistenceUp === true` and probe `down` → emits `warn` line `health.persistence.down`.
      - `lastPersistenceUp === false` and probe `down` → emits **no** line.
      - `lastPersistenceUp === false` and probe `up` → emits `info` line `health.persistence.up`.
  - [x] Test the controller as a unit by injecting a mock `Database` (`{ execute: vi.fn() }`) and a captured logger. Use Fastify's `app.inject(...)` for HTTP-level assertions, OR test the closure directly by extracting the handler. **Recommendation:** use `app.inject` — easier to set up, exercises real Fastify wiring.

- [x] **Task 6: Backend integration tests** (Test Scenarios — Integration)
  - [x] `apps/backend/tests/integration/health.test.ts` — extend (or create — check if Story 1.4 created it; if so, replace its content):
    - `GET /api/health` with Postgres up → 200 `{status:'healthy', persistence:'up'}`.
    - `GET /api/health` with Postgres connection broken → 503 `{status:'unhealthy', persistence:'down'}`. Simulate by passing a `DATABASE_URL` pointing at an unreachable host (e.g., `postgres://nope:nope@nonexistent-host:5432/nope`); the probe times out and returns `down`. Use a short timeout to keep the test fast.
    - **Log capture:** assert that on the first failed probe, exactly one `health.persistence.down` log line is emitted; on subsequent failed probes, no further log lines. Use Fastify's logger config to direct logs to an in-memory sink (e.g., a `Writable` stream collected into an array). Pino's `transport`/`destination` API supports this.
  - [x] **Log-capture pattern (recommended):**
    ```ts
    import { Writable } from 'node:stream';
    import pino from 'pino';

    const logBuffer: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) { logBuffer.push(chunk.toString()); cb(); },
    });
    const logger = pino({ level: 'info' }, sink);
    // ... pass `logger` into Fastify's logger option ...
    ```

- [x] **Task 7: Verify Docker container healthcheck still works** (Story 1.3 backward compat)
  - [x] Story 1.3 set `HEALTHCHECK CMD wget -qO- http://localhost:3000/api/health || exit 1` in `apps/backend/Dockerfile`. After Story 3.4:
    - Healthy state: 200 → wget exits 0 → Docker reports backend container as `healthy`. ✅
    - Unhealthy state: 503 → wget exits 0 (because `wget -qO-` doesn't fail on 5xx by default) → Docker would WRONGLY report `healthy`. **This is a bug to fix.**
  - [x] Update the Dockerfile HEALTHCHECK:
    ```dockerfile
    HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
      CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1
    ```
    `--spider` only checks reachability; combined with HTTP-status awareness via `--tries=1`, this will fail on non-200. Verify by stopping postgres and observing `docker compose ps` reports `unhealthy` for backend within ~3 retries × 30s.
  - [x] **Alternative (simpler & more robust):** use `curl` if `node:lts-slim` ships it (verify), with `--fail` flag:
    ```dockerfile
    HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
      CMD curl --fail --silent --show-error http://localhost:3000/api/health || exit 1
    ```
    `curl --fail` exits non-zero on 4xx/5xx. **Recommendation:** if `node:lts-slim` includes curl, use it. If not, the `wget --spider` form (verify behavior on 5xx — may or may not exit 1 depending on wget version) or fall back to a tiny inline node script.
  - [x] **Inline node fallback (most reliable):**
    ```dockerfile
    HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
      CMD node -e "require('http').get('http://localhost:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" || exit 1
    ```
    Slow (Node startup) but unambiguous. **Use only if curl/wget alternatives don't behave correctly.**

- [x] **Task 8: Verify the AC end-to-end**
  - [x] `docker compose up --wait`. `curl http://localhost:8080/api/health` → 200 with `{status:'healthy', persistence:'up'}`.
  - [x] `docker compose logs backend | grep 'health.persistence'` → exactly one initial-state line, no further entries on steady-state probes.
  - [x] **Force persistence down:** `docker compose stop postgres`. Wait for the next backend probe (~30s based on Docker healthcheck interval, OR just `curl` again immediately).
  - [x] `curl http://localhost:8080/api/health` → 503 with `{status:'unhealthy', persistence:'down'}`.
  - [x] `docker compose logs backend | grep 'health.persistence'` → one new `health.persistence.down` line. Probe again — no further lines.
  - [x] `docker compose ps` → backend container shows `unhealthy` (Docker healthcheck fired, Task 7 verified).
  - [x] **Restore:** `docker compose start postgres`. Wait for the next probe.
  - [x] `curl http://localhost:8080/api/health` → 200 with `healthy + up`.
  - [x] Logs show one new `health.persistence.up` transition line.
  - [x] Story 1.1 verification chain still exits 0; smoke (`scripts/smoke.sh`) still passes.

## Dev Notes

### Story Foundation Summary

This is the **operator-facing observability** story. Closes Epic 3. After it lands, `docker compose logs backend | grep health.persistence` is the canonical "what's been happening" command — and emits zero noise during steady-state operation.

**FRs implemented:** FR15 (health endpoint reports overall service health), FR16 (health endpoint reflects persistence-layer health).

**NFRs implemented:** none new (logging discipline established in 1.4 / architecture).

### Files to CREATE

| Path | Purpose |
|---|---|
| `apps/backend/src/controllers/healthController.test.ts` | State-transition matrix tests |
| `apps/backend/src/db/client.test.ts` (or extend from 1.7) | `probePersistence` tests |

### Files to UPDATE

| Path | Change |
|---|---|
| `apps/backend/src/db/client.ts` | Add `probePersistence` (Task 1, refined in Task 4) |
| `apps/backend/src/controllers/healthController.ts` | Convert to factory, add transition logic (Task 2, 4) |
| `apps/backend/src/app.ts` | Use `buildHealthController({ db })`; drop `logLevel: 'warn'` option (Task 3) |
| `apps/backend/Dockerfile` | Fix HEALTHCHECK to fail on 503 (Task 7) |
| `apps/backend/tests/integration/health.test.ts` | Add up/down + log-capture scenarios (Task 6) |

### Architecture Compliance

- **Health endpoint shape** [Source: architecture.md line 432]: `{ status: 'healthy' | 'unhealthy', persistence: 'up' | 'down' }`. Story 3.4 implements verbatim.
- **State-transition logging** [Source: architecture.md lines 461–470]: only on transitions, app-level logger bypasses route filter, in-memory `lastPersistenceUp`. AC #4–#5 reproduce verbatim.
- **HTTP status semantics** [Source: architecture.md line 627]: 503 for `PERSISTENCE_UNAVAILABLE`. Story 3.4 returns 503 on `unhealthy`.
- **HealthResponseSchema** [Source: 1-6-...md *Task 5*]: defined with optional `persistence` (1.4 returned `{status}` only); now both fields populated. Schema accepts both shapes; verify with parse on response.
- **Liveness vs readiness** [Source: architecture.md lines 486–488]: v1 conflates both into `/api/health`. Splitting into `/api/health/live` and `/api/health/ready` is non-foreclosed for later. Story 3.4 stays single-endpoint.
- **`logLevel: 'warn'` removal** [Source: Task 2 *Decision*]: this is a deliberate departure from Story 1.4's setup. Document in completion notes; the controller's own gate is sufficient and preserves request correlation.

### Previous Story Intelligence (1.4, 1.7, 1.6 → 3.4)

- **From 1.4:** healthController was a plain `FastifyPluginAsync` with `logLevel: 'warn'` route filter. Story 3.4 converts it to a factory and removes the route filter. Verify Story 1.4's `health.test.ts` (if it exists) is updated for the new wire shape.
- **From 1.7:** `createDbClient(url)` returns `{ pool, db }`. Story 3.4's `probePersistence(db)` reuses the same `db` instance. No second pool needed.
- **From 1.7:** `db.execute(sql\`...\`)` is the Drizzle pattern. `SELECT 1` is a trivial probe — sub-millisecond when the pool has a connection ready.
- **From 1.6:** `HealthResponseSchema` has `persistence` optional. Story 3.4 always sets it (never omits) — both shapes parse, but the new wire shape is `{status, persistence}` consistently.
- **From 1.3:** `apps/backend/Dockerfile` HEALTHCHECK uses `wget`. Task 7 audit may require updating it to fail on 5xx — confirm with the actual `wget` version in `node:lts-slim`.

### Latest Tech Information

| Tool | Notes |
|---|---|
| `pino` (Story 1.4) | `request.log.info({ event, ... }, 'human msg')` is the structured-logging pattern. Pino's first arg is the structured fields, second is the human message. Don't reverse them. |
| Drizzle `sql` template | `sql\`SELECT 1\`` parameterizes correctly — no SQL injection risk even though there's no input. |
| Docker `HEALTHCHECK` | Probe runs *inside* the container, hitting `localhost:3000`. The 503-detection issue (Task 7) only matters once persistence-aware probes can return non-200. Story 1.4's all-200 health endpoint masked this. |

### Anti-Patterns to Avoid

❌ **Don't keep the `logLevel: 'warn'` route option.** Drop it (Task 3). Otherwise transition log lines (info/warn) get filtered out unless using app-level logger directly — and that loses request-id correlation.
❌ **Don't store `lastPersistenceUp` outside the controller's closure.** Module-level state would persist across `buildApp` calls in tests, polluting state. Closure-per-controller-instance is the right scope.
❌ **Don't log on steady-state probes.** AC #5. Drop the log call when `lastPersistenceUp === isUp`.
❌ **Don't add `persistence: 'unknown'` or null states.** Two-valued union: `'up' | 'down'`. Pre-first-probe state is null in `lastPersistenceUp` (controller-internal), but the wire response always has a definitive value.
❌ **Don't forget the initial-state log line.** First probe after process start should log at info level — see the AC's wording about "first probe after restart logs the initial state at info" (architecture line 470). Without it, the first transition (process start → up→down) would have no "previous up" to compare against and would log incorrectly.
❌ **Don't return `200` for unhealthy.** AC #3 specifies 503. Operators rely on HTTP status + body together — both must say "unhealthy".
❌ **Don't forget to update the Dockerfile HEALTHCHECK** to fail on 503 (Task 7). Otherwise Docker's `unhealthy` marking never fires.
❌ **Don't add a timeout option to the probe.** The pg pool has its own connection-timeout config. Adding a Promise.race timeout adds complexity for marginal gain.
❌ **Don't store the error in module state.** AC #4 includes the error in the *log line*, not in subsequent responses. Wire response stays clean (`{status, persistence}` only).
❌ **Don't try to debounce/throttle transition logs.** Each transition is a discrete event. If persistence flaps rapidly, the logs will too — that's correct signal, not noise.

### Testing Standards

Per epics.md Story 3.4 *Test Scenarios*:

- **Unit:** state-transition logic (six cases including initial-state); `probePersistence` up/down behavior.
- **Integration:** up/down scenarios via Fastify `inject`; log capture verifying single-emission on first failure.
- **E2E:** none directly. Docker healthcheck (Task 7) verifies indirectly via `docker compose ps`.

Coverage thresholds ≥ 70% backend (NFR18) — must remain green.

### References

- Story scope and ACs: [Source: epics.md Story 3.4 (lines 765–812)]
- Health endpoint shape: [Source: architecture.md line 432]
- State-transition logging discipline: [Source: architecture.md lines 461–470]
- HTTP status `503 PERSISTENCE_UNAVAILABLE`: [Source: architecture.md line 627]
- HealthResponseSchema: [Source: 1-6-...md *Task 5*]
- Story 1.4 healthController baseline: [Source: 1-4-...md *Task 7*]
- Story 1.7 db client: [Source: 1-7-...md *Task 5*]
- Story 1.3 Dockerfile HEALTHCHECK: [Source: 1-3-...md *Task 3*]

### Project Knowledge References

No `docs/project-context.md` exists yet.

## Dev Agent Record

### Agent Model Used

Codex 5.3

### Debug Log References

- `npm run test --workspace @bmad-todo/backend -- src/db/client.test.ts src/controllers/healthController.test.ts tests/integration/health.test.ts`
- `docker compose -f docker-compose.yml up -d --build --wait`
- `docker compose -f docker-compose.yml exec -T backend node -e "fetch('http://localhost:3000/api/health')..."`
- `docker compose -f docker-compose.yml stop postgres` / `start postgres`
- `docker compose -f docker-compose.yml ps backend`
- `docker run --rm --network bmad-todo_default ... RUN_POSTGRES_TESTS=true ... tests/integration/health.test.ts`

### Completion Notes List

- Implemented `probePersistence()` as a tagged union (`{status:'up'}` / `{status:'down', error}`) with `SELECT 1` probe and error-message capture.
- Replaced static health plugin with `buildHealthController({ db })` factory and closure state (`lastPersistenceUp`) to emit transition-only logs.
- Updated `/api/health` behavior to return `200 healthy/up` and `503 unhealthy/down` and validate body shape via `HealthResponseSchema.parse`.
- Added pool-level `error` listener in DB client to avoid backend process crash when Postgres is interrupted.
- Added/updated tests: `client.test.ts`, `healthController.test.ts`, and integration `health.test.ts` (including transition-log single-emission assertion).
- Verified container behavior with compose: up state, down state, recovery transition logs, and backend `unhealthy` status after sustained DB outage.

### File List

- `apps/backend/src/db/client.ts`
- `apps/backend/src/db/client.test.ts`
- `apps/backend/src/controllers/healthController.ts`
- `apps/backend/src/controllers/healthController.test.ts`
- `apps/backend/src/app.ts`
- `apps/backend/tests/integration/health.test.ts`

## Change Log

- 2026-04-28: Implemented persistence-aware health endpoint with transition-only logging, added unit/integration coverage, and verified container unhealthy behavior on DB outage.
