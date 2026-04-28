# Post-implementation defects log

Bugs found after stories were marked `done`, with root cause, fix, and where the gap should have been caught upstream. Append new entries at the top.

---

## Defect 04 — CI E2E job: Postgres unhealthy + dev-override loaded by mistake

**Discovered:** 2026-04-28, GHA run [25063063829](https://github.com/amanvr/bmad-todo/actions/runs/25063063829/job/73422604254?pr=1)
**Surfaces in:** Stories 1.2 (CI workflow) + 1.3 (Docker topology)

**Symptom:**

```
The "POSTGRES_USER" variable is not set. Defaulting to a blank string.
The "POSTGRES_PASSWORD" variable is not set. Defaulting to a blank string.
The "POSTGRES_DB" variable is not set. Defaulting to a blank string.
...
Container bmad-todo-postgres-1  Error
dependency failed to start: container bmad-todo-postgres-1 is unhealthy
```

**Root cause:** Two issues, both in the CI `e2e` job:

1. **No `.env` file in the workflow.** `docker-compose.yml` interpolates `${POSTGRES_USER}` etc. from `.env`. The CI workflow ran `docker compose build` directly without first copying `.env.example` to `.env`. Postgres image refuses to initialize without these and fails its healthcheck; backend `depends_on: postgres condition: service_healthy` then bails.
2. **Dev override loaded.** `docker compose ...` with no `-f` auto-merges `docker-compose.override.yml`, which switches frontend to Vite dev server on `:5173`. Playwright config's `baseURL` is `http://localhost:8080` (nginx production path). Even if Postgres had started, Playwright would have hit a 404.

**Fix:** `.github/workflows/ci.yml` `e2e` job now:

- runs `cp .env.example .env` before any `docker compose` invocation;
- uses `docker compose -f docker-compose.yml ...` for build / up / down to skip the dev override and run production-shape (frontend = nginx on `:8080`, matching Playwright `baseURL`);
- adds `docker compose -f docker-compose.yml logs --no-color` on failure for faster diagnosis next time.

**Where it should have been caught:**

- Story 1.5's *Task 16* (CI E2E job) prescribed `docker compose build` and `docker compose up -d --wait` without `-f` and without an `.env` seed step. The story acknowledged the operational verification "must be observed in the GitHub UI" but no real PR was opened until much later.
- Story 1.3's `.env.example` is the canonical env source — but the CI workflow needs to know to copy it. This is exactly the kind of gap that an actual first-PR run would have caught immediately.
- Same root pattern as Defect 01 (dev override broken) and Defect 03 (clean-CI assumptions): operational verification was deferred.

---

## Defect 03 — CI Test job: `@bmad-todo/shared` unresolvable on clean checkout

**Discovered:** 2026-04-28, GHA run [25062941767](https://github.com/amanvr/bmad-todo/actions/runs/25062941767/job/73421982072?pr=1)
**Surfaces in:** Stories 1.6 (shared package), 1.4 + 1.5 + 1.7 + 1.8 + 2.x + 3.x (consumers)

**Symptom:**

```
Failed to resolve entry for package "@bmad-todo/shared".
The package may have incorrect main/module/exports specified in its package.json.
```

Backend Vitest (`healthController.test.ts`, `todoController.test.ts`, integration tests) and frontend Vitest (`api.test.ts`) all fail with this error in the CI `Test` job.

**Root cause:** `packages/shared/package.json` declares `"main": "./dist/index.js"` and `"types": "./dist/index.d.ts"`. `dist/` is a build artifact — gitignored, produced by `tsc --build`. Locally we had `dist/` left over from earlier runs; CI starts clean. `npm ci` installs dependencies but does not build any workspace package.

The `Typecheck` and `Build` jobs accidentally avoided the trap because they run `tsc --build`, which side-effect-builds shared as a composite project reference. The `Test` job invokes Vitest directly without `tsc`, so it has no opportunity to produce `dist/`.

**Fix:** `scripts/run-workspace-tests.cjs` now runs `npm run build --workspace @bmad-todo/shared` before invoking workspace tests. Both local `npm test` and CI's `Test` job follow the same path.

**Where it should have been caught:**

- Story 1.6's *Task 12* (clean-clone verification) — should have explicitly run `rm -rf dist node_modules && npm ci && npm test` to catch the missing-dist case. The story did mention "verify the AC end-to-end" but the manual run after implementation had `dist/` populated from earlier `npm run build`.
- Story 1.2's CI baseline — the `Test` job should have a build step *or* the test runner should ensure cross-package builds happen.
- The story's *Build configuration deviation* note flagged that the `--emitDeclarationOnly` AC text was imprecise but didn't catch this downstream consequence.

---

## Defect 02 — CI Test job: Playwright launches without browsers installed

**Discovered:** 2026-04-28, GHA run [25062529733](https://github.com/amanvr/bmad-todo/actions/runs/25062529733/job/73420466170?pr=1)
**Surfaces in:** Story 1.5 (Playwright baseline) and Story 1.2 (CI workflow)

**Symptom:** All 64 Playwright specs fail with:

```
Error: browserType.launch: Executable doesn't exist at
/home/runner/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell
```

**Root cause:** The CI `Test` job runs `npm run test`, which delegated to `npm test --workspaces --if-present` — that *included* the `e2e` workspace. The `e2e` workspace's `test` script invokes Playwright. The `Test` job has no Playwright browser-install step (only the dedicated `e2e` job does). Result: 64 spec failures from missing browser binaries.

**Fix:** `scripts/run-workspace-tests.cjs` now explicitly enumerates workspaces under `apps/` and `packages/` only, skipping the `e2e` workspace entirely. Playwright is exclusive to the dedicated CI `e2e` job (which installs browsers + spins up Docker).

**Where it should have been caught:**

- Story 1.5's *Task 6* (mobile-portrait Playwright project) noted: "the `mobile-portrait` project will rerun all existing specs" — but didn't think about whether non-Playwright CI jobs would also try to run them.
- Story 1.2's CI baseline — should have explicitly stated that the `Test` job runs unit/integration only, never E2E. The job's name (`Test`) is overloaded; renaming to `Unit Tests` would have prompted clearer thinking about scope.

---

## Defect 01 — `docker compose up` broken: frontend container missing `npx`

**Discovered:** 2026-04-28, manual `docker compose up` run by user
**Surfaces in:** Story 1.3 (Docker topology) + Story 1.5 (frontend dev override)

**Symptom:**

```
frontend-1  | /docker-entrypoint.sh: exec: line 47: npx: not found
frontend-1 exited with code 127 (restarting)
```

Repeats every ~3 seconds as the container restart-loops.

**Root cause:** `docker-compose.override.yml` (auto-merged on plain `docker compose up`) overrode the frontend service's `command` to `['npx', 'vite', ...]` but inherited the production-mode `image: nginx:alpine` from the base file. nginx-alpine doesn't ship Node or npx. The override was effectively unrunnable.

A second nested defect surfaced after the first fix: even with `image: node:lts` in place, Vite returned 404 because it ran from `/app` rather than `/app/apps/frontend` (where `index.html` and `vite.config.ts` live).

**Fix:** `docker-compose.override.yml` now overrides `image` to `node:lts`, sets `working_dir`, runs `npm ci` for the relevant workspace, then `cd`s into `apps/frontend` for the `vite` command. Same pattern applied to backend.

**Where it should have been caught:**

- Story 1.3 *Task 8* (operational verification via `docker compose up --wait`) — was deferred because Docker wasn't available in the WSL distro at implementation time. The deferral itself was acknowledged in completion notes but no follow-up gate was scheduled.
- Story 1.5 *Task 12* (`docker-compose.override.yml` for Vite dev) — prescribed the `npx vite` command without specifying an image override. The dev agent followed the prescription verbatim instead of flagging the inherited-image trap.
- The README's "Quick Start" used `docker compose -f docker-compose.yml up --wait` (production-mode-only, bypasses the override) — which masks the bug for anyone copy-pasting the documented command.

---

## Process notes

**Pattern across all three defects:** the bugs landed because operational verification (running the actual stack, running the actual CI pipeline) was deferred during implementation. Stories had test code locally green, but the integration paths weren't exercised end-to-end until much later.

**Lesson for future stories:**

1. If operational verification is deferred (Docker unavailable, no GitHub remote, etc.), schedule a concrete follow-up gate in the sprint with an explicit owner — don't just write "deferred to reviewer" in completion notes.
2. CI pipelines need at least one full green run on a real PR before stories that depend on CI behavior (e.g., 1.2's lint-fail observation, 1.5's E2E job) get marked `done`.
3. `docker compose up` should be the canonical dev command in the README. If a story prescribes a `-f docker-compose.yml`-only path, that's a smell — it means the dev override isn't trusted.

**Where to add new defects:** append to the top of this file. Keep the structure: Symptom → Root cause → Fix → Where it should have been caught.
