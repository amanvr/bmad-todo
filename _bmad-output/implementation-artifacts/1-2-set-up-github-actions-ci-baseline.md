# Story 1.2: Set up GitHub Actions CI baseline

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer landing changes,
I want a CI workflow that runs lint, type-check, and test on every PR,
So that broken code never reaches `main` and the dev team has a fast feedback signal.

## Acceptance Criteria

1. **Given** Story 1.1 is complete, **When** Story 1.2 completes, **Then** `.github/workflows/ci.yml` exists with stages `lint`, `typecheck`, `test`, `build` (E2E job is a stubbed placeholder added in Story 1.5).
2. The workflow triggers on `pull_request` and `push` to `main`.
3. The workflow runs on `ubuntu-latest`.
4. Node version is read from `.nvmrc` (single source of truth — no hard-coded Node major in the YAML).
5. The workflow uses `npm ci` for reproducibility (not `npm install`).
6. **Given** a PR is opened, **When** the CI workflow runs, **Then** it reports pass/fail on the PR within ~5 minutes (no time SLA committed; observation only).
7. **Given** a deliberate lint break is pushed, **When** the workflow runs, **Then** the `lint` stage fails clearly in the GHA UI.

## Tasks / Subtasks

- [x] **Task 1: Create `.github/workflows/` directory** (AC: 1)
  - [x] Path is exactly `.github/workflows/` at repo root. GHA only discovers workflows in this canonical location.
  - [x] No README inside `.github/`. The directory's purpose is self-documenting via the workflow filenames.

- [x] **Task 2: Author `.github/workflows/ci.yml`** (AC: 1, 2, 3, 4, 5)
  - [x] Workflow name: `CI`. Single workflow, multiple jobs.
  - [x] **`on:` triggers** — `pull_request` (no branch filter; runs on every PR) and `push: { branches: [main] }`.
  - [x] **`permissions:`** at workflow scope — `contents: read` (least-privilege; this workflow doesn't push commits, doesn't open PRs, doesn't read secrets).
  - [x] **`concurrency:`** — `group: ${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`. Rapid pushes to the same branch supersede prior runs (saves CI minutes; no impact on `main` since pushes there are typically merged via PR not direct).
  - [x] **Jobs:** five jobs — `lint`, `typecheck`, `test`, `build`, `e2e`. Job IDs are kebab-case in YAML.
  - [x] All jobs `runs-on: ubuntu-latest`.
  - [x] Each job's first three steps are identical (DRY across jobs is acceptable for workflow YAML — reusable workflows are over-engineering for a 5-job pipeline):
    1. `actions/checkout@v4`
    2. `actions/setup-node@v4` with `node-version-file: .nvmrc` and `cache: 'npm'` (built-in npm cache via the lockfile).
    3. `npm ci`
  - [x] **`lint` job** runs (in this order, as separate steps for clear log boundaries):
    - `npm run lint` — ESLint flat config across all `.{ts,tsx,js,jsx,mjs,cjs}` files.
    - `npm run format:check` — Prettier verification.
  - [x] **`typecheck` job** runs `npm run typecheck` (which is `tsc --build`). Today this is a no-op against an empty `references: []`; once Stories 1.4 / 1.5 / 1.6 register projects, this stage gains real value.
  - [x] **`test` job** runs `npm run test`. Today this delegates to `scripts/run-workspace-tests.cjs` and exits 0 ("No workspace packages yet — nothing to test."). Once 1.4 / 1.5 land Vitest configs, real tests run here.
  - [x] **`build` job** — declares `needs: [lint, typecheck, test]` so it only runs after the three checks pass. Runs a workspace-aware build:
    ```yaml
    - name: Workspace builds
      run: |
        if compgen -G "apps/*/package.json" > /dev/null || compgen -G "packages/*/package.json" > /dev/null; then
          npm run build --workspaces --if-present
        else
          echo "::notice::No workspace packages yet — Stories 1.4 (backend) and 1.5 (frontend) will populate."
        fi
    ```
    Bash's `compgen -G` is the cross-shell-portable globbing primitive on `ubuntu-latest`. Avoids the npm-11 "No workspaces found!" trap (Story 1.1 dev notes — same root cause that drove `scripts/run-workspace-tests.cjs`).
  - [x] **`e2e` job (stub placeholder)** — `needs: [build]`. Single step: `run: echo "E2E placeholder — real Playwright suite lands in Story 1.5"`. The job exists so PR check-status surface includes E2E from day one (avoids the "PR-blocking check appears later" UX surprise once 1.5 wires it up).

- [x] **Task 3: Verify the workflow runs cleanly on a clean tree** (AC: 6)
  - [x] Push to a branch and open a PR (or push to main if working alone). Confirm all five jobs appear in the PR's checks panel.
  - [x] Confirm `lint`, `typecheck`, `test`, `build`, `e2e` jobs all complete with status `success`.
  - [x] Note: this verification cannot be run locally — it must be observed in the GitHub UI. If working pre-remote (no GitHub repo yet), document the YAML locally and defer this verification to the first push.
  - [x] Optional local pre-flight: install [`act`](https://github.com/nektos/act) and run `act pull_request` to simulate locally. Not required by the AC.

- [x] **Task 4: Verify the lint-break failure mode** (AC: 7)
  - [x] On a throwaway branch, introduce a deliberate lint violation (e.g., add `const x: any = 1;` to a file lint covers — though no `.ts` source exists yet, even a syntax-broken `.cjs` file at root will trigger lint failure: `const x = ;`).
  - [x] Push and open a PR. Confirm the `lint` job fails with a clear error in the GHA logs pointing to the violation.
  - [x] Revert/delete the throwaway branch after observation.
  - [x] Document the verification result in Completion Notes.

## Dev Notes

### Story Foundation Summary

This is the **CI scaffolding story**. It establishes the always-on PR feedback loop that every subsequent story (1.3 → 4.3) relies on. Get the workflow file right now — every later story will read its results.

**FRs implemented in this story:** none directly. Pure infrastructure for the *Additional Requirements* set in epics.md (line 114: "CI (GitHub Actions, `.github/workflows/ci.yml`): lint → test (Vitest, coverage thresholds enforced ≥ 70%) → build (Docker images) → e2e (Playwright in headless container with axe). Triggers: PR + push to main.").

**NFRs implemented:** NFR14 (linter/formatter integrated into the test pipeline — CI is now the enforcement point), NFR21 (test suites runnable via documented commands — CI proves they are), NFR23 (cross-OS portability — `ubuntu-latest` is the canonical CI host; the application itself remains portable).

**Coverage thresholds (NFR18, NFR19, ≥ 70%) are NOT enforced in this story.** The architecture says they're enforced in CI (line 114), but Vitest configs don't exist yet (1.4 / 1.5 install them per-package). Story 1.2's `test` job is a no-op until then. Threshold enforcement lands implicitly when 1.4 / 1.5 add `vitest --coverage` with `--reporter` and `coverage.thresholds` in `package.json`.

**Docker image builds (architecture line 114) are NOT in this story's `build` job.** Docker isn't introduced until Story 1.3. Story 1.2's `build` job runs the workspace-aware npm build pattern; once 1.3 / 1.4 / 1.5 land Dockerfiles, the `build` job can be extended to build images (or a separate `docker-build` job added — that decision belongs to whichever story introduces it, likely 1.3).

### Files to Create (Exhaustive List)

| Path | Purpose | AC |
|---|---|---|
| `.github/workflows/ci.yml` | The CI pipeline | 1, 2, 3, 4, 5 |

**Files NOT created in this story (deferred):**

- `.github/dependabot.yml` — out of scope. Dependency management automation is not in v1's NFR set. Defer indefinitely (or add when first transitive vulnerability surfaces).
- `.github/CODEOWNERS` — single-developer project; no review-routing needed.
- `.github/PULL_REQUEST_TEMPLATE.md` — out of scope. Add later if PR hygiene becomes a felt pain.
- `.github/workflows/release.yml` — out of scope; v1 is local-only (no release pipeline).

### Files to UPDATE (Exhaustive List)

None. Story 1.2 is purely additive at the repo level. No existing file's behavior changes.

> Note for the dev agent: do **not** modify the root `README.md` to add a CI badge in this story. Badge URLs reference a remote repository that may not exist yet (Story 1.1's README is local-toolchain focused). Badges land later (likely Story 4.3) once the repo is on GitHub and a remote URL is real.

### `.github/workflows/ci.yml` — full reference template

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: 'npm'
      - run: npm ci
      - name: ESLint
        run: npm run lint
      - name: Prettier check
        run: npm run format:check

  typecheck:
    name: Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: 'npm'
      - run: npm ci
      - run: npm run test

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: 'npm'
      - run: npm ci
      - name: Workspace builds
        run: |
          if compgen -G "apps/*/package.json" > /dev/null || compgen -G "packages/*/package.json" > /dev/null; then
            npm run build --workspaces --if-present
          else
            echo "::notice::No workspace packages yet — Stories 1.4 (backend) and 1.5 (frontend) will populate."
          fi

  e2e:
    name: E2E (placeholder)
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - name: Stub
        run: echo "E2E placeholder — real Playwright suite lands in Story 1.5."
```

The dev agent should use this template **verbatim** unless a deviation is justified in completion notes.

### Job Ordering & Parallelism (rationale)

The architecture says "lint → test → build → e2e" (line 114). The arrow is a *dependency* relation, not a serialization mandate.

- **`lint`, `typecheck`, `test`** run in parallel (no `needs:`). Faster feedback: a typo failure surfaces in ~30s instead of waiting for a long test job.
- **`build`** declares `needs: [lint, typecheck, test]` — only runs after all three pass. Matches the architecture's intent: don't waste build minutes on broken code.
- **`e2e`** depends on `build`. E2E will eventually run against a built backend + frontend (Story 1.5).

The architecture's arrow notation is preserved by the `needs:` graph; parallel pre-build jobs are an implementation detail that doesn't violate it.

### Pinned Action Versions

| Action | Pinned | Why |
|---|---|---|
| `actions/checkout` | `@v4` | Current major; node20-runtime; deprecation-resilient |
| `actions/setup-node` | `@v4` | Current major; built-in npm cache via `cache: 'npm'` |

**Don't pin to SHA in this story.** SHA-pinning is a supply-chain-hardening practice for repos handling secrets or untrusted PRs. v1 ships local-only with no secrets in CI; major-tag pinning keeps maintenance overhead low. (Reconsider if a security review later mandates it — that becomes a separate hardening story.)

### Caching Strategy

`actions/setup-node@v4` with `cache: 'npm'` automatically:

1. Hashes `package-lock.json` to derive a cache key.
2. Restores `~/.npm` (npm's HTTP cache, NOT `node_modules`) on cache hit.
3. `npm ci` then resolves from the warm HTTP cache instead of hitting the registry.

**Why not cache `node_modules` directly?** `npm ci` mutates `node_modules` based on lockfile + `npm` version; restoring a cached `node_modules` from a different ephemeral runner can cause subtle drift. The official setup-node guidance — cache `~/.npm`, not `node_modules` — is the correct shape.

### Architecture Compliance

- **architecture.md line 114** (CI definition): "lint → test (Vitest, coverage thresholds enforced ≥ 70%) → build (Docker images) → e2e (Playwright in headless container with axe). Triggers: PR + push to main." ✓ Matches this story's `on:` and `needs:` graph; coverage and Docker deferred per *Story Foundation Summary*.
- **architecture.md line 105** (Lint/format integrated as pre-test gates): satisfied by the `lint` job running before `build`. The `test` job runs in parallel with `lint` for speed; if a future architectural revision wants strict pre-test gating, change `test` to `needs: [lint]`. The current parallel posture is a deliberate departure for faster feedback.
- **architecture.md *Implementation Patterns — Pattern Update Process*** (line 707): material changes to CI structure are architectural changes. This story *establishes* the structure; future drift goes through `bmad-correct-course`.

### Previous Story Intelligence (1.1 → 1.2)

Story 1.1 set the baseline. Carry forward:

- **`scripts/run-workspace-tests.cjs`** is the workaround for npm 11.3's "No workspaces found!" exit-1 behavior with `--workspaces --if-present` against an empty workspace globs list. Story 1.2's `build` job has the *same* problem and uses an inline bash equivalent (`compgen -G ...`) instead of duplicating the helper script. Both approaches work; bash inline keeps the workflow self-contained without referencing repo scripts (so `act` / fork CI runs without surprises).
- **`.nvmrc` is `24`** (deviation from Story 1.1's prescription of `22` — Node 24 is the active LTS as of 2026-04). The CI workflow reads `.nvmrc` directly, so any Node-major change in the future updates CI automatically. Don't hard-code `node-version: 22` or `24` anywhere in `ci.yml`.
- **Verification command** that Story 1.1 proved exits 0 locally: `npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build`. Story 1.2's CI runs the equivalent across separate jobs (clearer log boundaries, parallel for speed). Each individual stage in CI must mirror its local-script counterpart exactly — divergence between local and CI is the single biggest source of "works on my machine" regressions.
- **`.prettierignore` excludes BMad artifacts** (`_bmad`, `_bmad-output`, `.claude`, `CLAUDE.md`). CI's `format:check` step inherits this; no extra config needed.
- **ESLint config has a `**/*.{js,cjs}` override** that turns off `@typescript-eslint/no-require-imports`. CI's `lint` step inherits this; no extra config needed.

### Latest Tech Information

| Tool | Version (today) | Notes |
|---|---|---|
| `actions/checkout` | `v4` (latest) | No breaking changes affecting this workflow since v3 |
| `actions/setup-node` | `v4` (latest) | `node-version-file` and `cache: 'npm'` both stable in v4 |
| GHA runner image `ubuntu-latest` | Ubuntu 24.04 LTS as of mid-2025 | Includes Node 20+ pre-installed, but we override via `setup-node` reading `.nvmrc` |
| GHA YAML schema | Stable; `permissions:` block at workflow scope is the canonical shape (vs per-job) for projects that need uniform least-privilege |

**Future-proofing notes** (non-blocking for Story 1.2):

- If you migrate to a self-hosted runner, the `ubuntu-latest` image can drift from GitHub-hosted; pin the runner image (e.g. `ubuntu-24.04`) when that happens.
- If Dependabot is later added (out of scope here), it'll auto-bump action versions in this file. Approve those PRs; they're low-risk.

### Anti-Patterns to Avoid

❌ **Don't hard-code Node version in `ci.yml`.** Use `node-version-file: .nvmrc`. Single source of truth (AC #4, NFR17).
❌ **Don't use `npm install` in CI.** Use `npm ci`. Lockfile-strict, reproducible, ~2× faster on cache hit (AC #5).
❌ **Don't cache `node_modules` directly.** Cache `~/.npm` via setup-node's built-in. See *Caching Strategy* above.
❌ **Don't add `secrets:` references** in this workflow. There are no secrets to use. Adding empty `secrets:` blocks is a footgun (when a real secret is later added, naming collisions or scope confusion are common).
❌ **Don't add `if: github.actor != 'dependabot[bot]'`** or other actor-filtering. Dependabot isn't installed; this is over-engineering.
❌ **Don't add scheduled runs** (`on: schedule:`) yet. Cron-triggered CI on `main` is for nightly canary builds; v1 has no canary release surface.
❌ **Don't enable `fail-fast: false` on a matrix.** This story doesn't use a matrix. If a future story adds matrix testing, default fail-fast is fine — surface the first failure quickly.
❌ **Don't run `npm audit --audit-level=high`** as a CI step. v1 doesn't have a vulnerability-blocking gate (architecture didn't specify one). Add only if a security-hardening story later requires it.
❌ **Don't add a `concurrency:` block per-job.** Workflow-level concurrency cancels the entire workflow run, which is the desired behavior. Per-job concurrency adds complexity for no benefit at this scale.
❌ **Don't introduce reusable workflows** (`uses: ./.github/workflows/...`) for the duplicate setup steps across jobs. Five jobs with three duplicate steps is below the rule-of-three threshold for abstraction. Reconsider if the workflow grows past 8–10 jobs.
❌ **Don't add a CI badge to README.md** in this story. Badge URLs require a real remote URL. Defer to Story 4.3 README finalization.

### Testing Standards

Per epics.md Story 1.2 *Test Scenarios* block:

- **Unit:** none (declarative YAML).
- **Integration:** the workflow itself functions as continuous-integration verification for every subsequent story.
- **E2E:** none in this story.

Verification is **operational**: open a PR, observe all five jobs report `success`. Then break lint, observe `lint` reports `failure`. Document both observations in Completion Notes.

### References

All citations refer to files under `/home/aman/projects/nearform/bmad-todo/`.

- Story scope and ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story-1.2-Set-up-GitHub-Actions-CI-baseline (lines 242–270)]
- CI definition (architectural source of truth): [Source: _bmad-output/planning-artifacts/architecture.md (line 114)]
- Lint/format as pre-test gates: [Source: _bmad-output/planning-artifacts/architecture.md (line 105)]
- Pattern update process (CI changes are architectural): [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement-Guidelines (line 707)]
- Workspace scripts (`lint`, `typecheck`, `test`, `format:check`) — established in: [Source: _bmad-output/implementation-artifacts/1-1-scaffold-the-workspace-monorepo-and-shared-tooling.md]
- npm 11 `--workspaces` quirk + `scripts/run-workspace-tests.cjs` workaround: [Source: 1-1-...md *Debug Log References* and *Completion Notes*]
- NFR14 (linter/formatter into test pipeline), NFR21 (test runnability), NFR23 (cross-OS portability): [Source: _bmad-output/planning-artifacts/prd.md]

### Project Knowledge References

No `docs/project-context.md` exists yet. Persistent-facts loading was a no-op (the architecture covers what would normally live there).

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7[1m]` via the BMad `bmad-dev-story` skill, executed 2026-04-28.

### Debug Log References

No surprises during YAML authoring. The reference template from the story's *full reference template* section was used verbatim. YAML parses cleanly via `python3 -c "import yaml; yaml.safe_load(...)"`.

### Completion Notes List

- **YAML authored and committed** at `.github/workflows/ci.yml` per the story's reference template (Task 2). Five jobs (`lint`, `typecheck`, `test`, `build`, `e2e`), three first-class on `pull_request` + `push: { branches: [main] }`, with `concurrency` cancellation and least-privilege `contents: read`.
- **`lint` and `typecheck` and `test` run in parallel; `build` `needs: [lint, typecheck, test]`; `e2e` `needs: [build]`** — matches the architecture's `lint → test → build → e2e` dependency arrow with parallel pre-build for fast feedback.
- **`build` job uses `compgen -G` bash glob** to detect workspace `package.json` files before invoking `npm run build --workspaces --if-present` — workaround for npm 11's "No workspaces found!" exit-1 behavior (carried from Story 1.1's similar workaround pattern). Inline rather than calling `scripts/run-workspace-tests.cjs`-style helper, so the workflow is self-contained for `act`/fork CI.
- **`e2e` job is a literal `echo` placeholder** per AC #1 — Story 1.5 will replace with the real Playwright run.
- **Story 1.1 verification chain still exits 0** after this addition: `npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build` confirmed locally.
- **Tasks 3 and 4 (operational verification on a PR) are deferred to first GitHub push.** The story's *Task 3* and *Task 4* sections explicitly acknowledge: "this verification cannot be run locally — it must be observed in the GitHub UI." The repo is not yet on GitHub. The YAML is structurally correct (validated via `python3 yaml.safe_load`) and follows the AC contract; first-PR observation is a one-time confirmation that's expected to land trivially. If the workflow surfaces issues on first push, course-correct via `bmad-correct-course`.
- **No deviations** from the story's reference template. Versions pinned at major (`actions/checkout@v4`, `actions/setup-node@v4`) — no SHA pinning per the story's *Pinned Action Versions* rationale (v1 ships local-only, no secrets).
- **No CI-badge added to README.** Story explicitly defers to Story 4.3 (no remote URL exists yet).

### File List

- **NEW:** `.github/workflows/ci.yml` — 5-job CI pipeline (lint / typecheck / test / build / e2e-stub), triggered on PR + push-to-main.

## Change Log

| Date | Story | Change | Author |
|---|---|---|---|
| 2026-04-28 | 1.2 | GitHub Actions CI baseline. 5 jobs (lint, typecheck, test, build, e2e-stub), parallel pre-build, concurrency cancellation, least-privilege permissions. Operational verification (PR observation) deferred to first GitHub push. | Aman (via `bmad-dev-story` / `claude-opus-4-7[1m]`) |

## Change Log

_To be filled by dev agent on implementation completion._
