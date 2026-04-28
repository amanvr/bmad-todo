# Story 1.1: Scaffold the workspace monorepo and shared tooling

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer joining the project,
I want a workspace monorepo skeleton with shared lint, format, type-checking, and test-runner configuration,
So that I can clone the repo and have a consistent baseline for every package without per-package setup drift.

## Acceptance Criteria

1. **Given** an empty repository, **When** Story 1.1 completes, **Then** the repo contains `package.json` with `"workspaces": ["apps/*", "packages/*"]`.
2. `tsconfig.base.json` enforces `strict: true` and `noUncheckedIndexedAccess: true`.
3. `.editorconfig` enforces LF line endings (NFR23).
4. `.nvmrc` pins Node LTS.
5. `.gitignore` excludes `node_modules/`, `dist/`, `.env`, `coverage/`.
6. ESLint 9 flat config (`eslint.config.js`) at the root with the TypeScript ruleset.
7. Prettier + `eslint-config-prettier` integration (no formatting/lint rule conflicts).
8. Root `README.md` skeleton exists with placeholder sections for prerequisites and quick start (refined progressively in later stories).
9. **Given** the scaffolded workspace, **When** I run `npm ci` followed by `npm run lint`, `npm run format:check`, and `npm run test`, **Then** all four pass on the empty scaffold.

**Verification command (must exit 0):**

```bash
npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build
```

## Tasks / Subtasks

- [x] **Task 1: Author root `package.json` with workspace declaration** (AC: 1, 9)
  - [x] Set `"private": true` (workspace roots must be private — npm refuses to publish workspace roots).
  - [x] Set `"name": "bmad-todo"`.
  - [x] Declare `"workspaces": ["apps/*", "packages/*"]`.
  - [x] Pin Node engine: `"engines": { "node": ">=20.0.0" }` (architecture: "Node 20+ runs compiled JS directly").
  - [x] Add `"type": "module"` only at workspace level — not on the workspace root itself; defer to per-package decisions in Stories 1.4/1.5/1.6.
  - [x] Add scripts (see *Test Script Strategy* in Dev Notes for exact wording):
    - `lint`: `eslint .`
    - `format`: `prettier --write .`
    - `format:check`: `prettier --check .`
    - `test`: `npm test --workspaces --if-present`
    - `typecheck`: `tsc --build`
  - [x] Add devDependencies (versions in *Dependencies and Versions* below): `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`, `eslint-config-prettier`, `typescript`, `@types/node`.

- [x] **Task 2: Author `tsconfig.base.json`** (AC: 2)
  - [x] Compiler options: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"target": "ES2022"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"esModuleInterop": true`, `"skipLibCheck": true`, `"forceConsistentCasingInFileNames": true`, `"resolveJsonModule": true`, `"isolatedModules": true`.
  - [x] No `include`/`files`/`exclude` here — this is *only* the shared options block. Each package's `tsconfig.json` extends it and adds its own `include`/`exclude` in later stories.
  - [x] Do **not** set `"composite": true` here — composite is set per-project, not in the base, because non-composite consumers (e.g. Vite's `tsconfig.node.json`) will also extend this base.

- [x] **Task 3: Author root `tsconfig.json`** (AC: 9, verification line)
  - [x] Extend `./tsconfig.base.json`.
  - [x] Set `"files": []` and `"references": []` — empty until Stories 1.4/1.5/1.6 register their projects.
  - [x] **Why this file:** the verification command runs `tsc --build` from repo root. Without a root `tsconfig.json`, `tsc --build` errors `TS18003: No inputs were found`. With empty `references: []` it no-ops cleanly (exit 0). Stories 1.4/1.5/1.6 will append their workspace projects to this `references` array.
  - [x] Note: the architecture's directory listing (architecture.md §Project Structure & Boundaries) shows `tsconfig.base.json` but omits a root `tsconfig.json`. Adding the root `tsconfig.json` is a minimal extension required by the verification AC; later stories will register references against it. Document this in `Project Structure Notes` below.

- [x] **Task 4: Author `.editorconfig`** (AC: 3)
  - [x] `root = true` at top.
  - [x] `[*]` block: `end_of_line = lf` (NFR23 — Windows host portability), `charset = utf-8`, `indent_style = space`, `indent_size = 2`, `insert_final_newline = true`, `trim_trailing_whitespace = true`.
  - [x] `[*.md]` override: `trim_trailing_whitespace = false` (Markdown uses two-trailing-spaces for hard line breaks).

- [x] **Task 5: Author `.nvmrc`** (AC: 4)
  - [x] Single line: `22` (active Node LTS as of 2026-04; aligns with `engines.node ">=20.0.0"`). Bare-major form is supported by `nvm`, `fnm`, and `volta`.

- [x] **Task 6: Author `.gitignore`** (AC: 5)
  - [x] Required entries (literal): `node_modules/`, `dist/`, `.env`, `coverage/`.
  - [x] Add additionally (anticipating later stories — these prevent accidental commits today): `.env.local`, `.env.*.local`, `*.log`, `npm-debug.log*`, `.DS_Store`, `Thumbs.db`, `.vscode/*` (with negation `!.vscode/extensions.json` if you want to keep recommended-extensions later), `.idea/`, `.cache/`, `playwright-report/`, `test-results/`.
  - [x] **Do not** add `package-lock.json` to gitignore — the lockfile MUST be committed (NFR16: clone-and-go in 15 minutes assumes deterministic installs via `npm ci`).

- [x] **Task 7: Author `eslint.config.js`** (AC: 6, 7)
  - [x] ESLint 9 flat config format. Use ESM (`export default`) — flat config supports `.js` with `"type": "module"` *or* `.mjs`. **Recommendation:** name the file `eslint.config.mjs` to avoid forcing `"type": "module"` on the workspace root `package.json`.
    - Wait — AC #6 says `eslint.config.js` literally. **Use `eslint.config.js`** as the AC dictates; this requires `"type": "module"` at the workspace root, OR the file uses CommonJS (`module.exports = ...`). Flat config supports both. Pick **CommonJS form** for `eslint.config.js` to keep workspace root non-ESM (less ceremony for backend `tsx` and Drizzle config files later).
  - [x] Compose using `@eslint/js` recommended + `typescript-eslint` (`tseslint.config(...)`) recommended.
  - [x] Final config in the `tseslint.config(...)` array must include `eslintConfigPrettier` **last** (AC #7) — this disables stylistic ESLint rules that conflict with Prettier.
  - [x] **Ignore patterns** (use top-level `ignores` block — flat config requirement): `**/dist/**`, `**/coverage/**`, `**/node_modules/**`, `**/.git/**`, `**/playwright-report/**`, `**/test-results/**`. Do NOT include the file extension in the patterns; ESLint flat config matches with minimatch/glob.
  - [x] Lint these globs: `**/*.{ts,tsx,js,jsx,mjs,cjs}`. Do not lint JSON/MD/YAML — that's Prettier's job.
  - [x] Specify `parserOptions.project: false` for now (no projects exist yet). Later stories adding TS projects will toggle to `projectService: true` for type-aware rules.
  - [x] **Sample structure** (use exactly this skeleton; fill in versions per Task 1):
    ```js
    // eslint.config.js
    const js = require('@eslint/js');
    const tseslint = require('typescript-eslint');
    const eslintConfigPrettier = require('eslint-config-prettier');

    module.exports = tseslint.config(
      { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.git/**', '**/playwright-report/**', '**/test-results/**'] },
      js.configs.recommended,
      ...tseslint.configs.recommended,
      eslintConfigPrettier
    );
    ```

- [x] **Task 8: Author Prettier configuration** (AC: 7)
  - [x] `.prettierrc.json` with explicit defaults so future PR diffs are deterministic regardless of the Prettier version: `{ "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 100, "tabWidth": 2, "useTabs": false, "endOfLine": "lf" }`.
  - [x] `.prettierignore` listing patterns NOT to format: `node_modules`, `dist`, `coverage`, `playwright-report`, `test-results`, `package-lock.json` (Prettier will re-key it; keep npm's deterministic ordering), `*.min.{js,css}`, `drizzle/` (auto-generated SQL — added in Story 1.7).

- [x] **Task 9: Author root `README.md` skeleton** (AC: 8)
  - [x] Sections (titles only, with placeholder text — full content lands progressively across later stories per NFR16):
    - `# bmad-todo` — single-sentence project description.
    - `## Prerequisites` — placeholder: "Docker Engine and Node.js (see `.nvmrc`). Detailed list lands in Story 1.3 (Docker) and Story 1.4 (backend dev workflow)."
    - `## Quick Start` — placeholder: "`docker compose up --wait` once Story 1.3 completes; for now, `npm ci && npm run lint && npm run format:check && npm run test` verifies the toolchain."
    - `## Project Structure` — placeholder pointing to `_bmad-output/planning-artifacts/architecture.md` *Project Structure & Boundaries* section.
    - `## Development` — placeholder: "Per-package READMEs land at each package's first scaffolding story (1.4 backend, 1.5 frontend, 1.6 shared)."
  - [x] **Don't** copy planning-artifact content into README — those are decision records, not user docs. README is for humans cloning the repo.

- [x] **Task 10: Generate lockfile and verify the AC** (AC: 9)
  - [x] Run `npm install` once to generate `package-lock.json`. Commit the lockfile.
  - [x] Run the full verification chain: `npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build` — must exit 0.
  - [x] If `npm test` fails because no workspaces exist yet: confirm script is `"npm test --workspaces --if-present"` — `--if-present` makes it a no-op when no workspace defines a `test` script. With zero workspaces resolved by `apps/*` / `packages/*`, npm exits 0.
  - [x] If ESLint reports zero files matched and exits non-zero: pass `--no-warn-ignored` flag in the script (ESLint 9 default behavior is to warn on this; behavior may differ by minor version — verify against the published version on scaffold day).

## Dev Notes

### Story Foundation Summary

This is the **bootstrap story** for the entire codebase. Every later story extends what lands here. Get the conventions right now — they propagate to backend (1.4), frontend (1.5), shared (1.6), and CI (1.2) directly, and indirectly to every story 2.1 → 4.3.

**FRs implemented in this story:** none directly. This is pure infrastructure for the *Additional Requirements* set in epics.md (line 88: "STARTER TEMPLATE (Epic 1, Story 1.1): workspace-based monorepo with `apps/backend`, `apps/frontend`, `packages/shared`. Initialization via `npm create vite@latest …`; hand-rolled Fastify scaffold for backend; npm workspaces; shared TS-types-only package.").

**NFRs implemented:** NFR14 (linter/formatter integration), NFR15 (separability — workspace boundaries), NFR16 (clone-to-running setup, partial — README skeleton only), NFR17 (no magic constants, partial — establishes practice), NFR23 (cross-OS portability — `.editorconfig` LF enforcement). Coverage thresholds (NFR18, NFR19) and the test pipeline (NFR21) are *prepared* here but enforced in Stories 1.4/1.5 (per-package vitest config) and 1.2 (CI).

**FR coverage map for this story:** none. (See *Additional Requirements* line in epics.md.) **Avoid scope creep** — anything that smells like a feature (controllers, components, schemas) belongs in a later story.

### Files to Create (Exhaustive List)

All paths relative to repo root `/home/aman/projects/nearform/bmad-todo/`:

| Path | Purpose | AC |
|---|---|---|
| `package.json` | Workspace root + tooling devDeps + scripts | 1, 9 |
| `package-lock.json` | Generated by `npm install`; committed for `npm ci` reproducibility | 9 |
| `tsconfig.base.json` | Shared TS compiler options | 2 |
| `tsconfig.json` | Root project for `tsc --build` (empty references) | 9 (verification line) |
| `.editorconfig` | LF + 2-space defaults | 3 |
| `.nvmrc` | `22` | 4 |
| `.gitignore` | Standard Node + project ignores | 5 |
| `eslint.config.js` | ESLint 9 flat config | 6, 7 |
| `.prettierrc.json` | Explicit Prettier defaults | 7 |
| `.prettierignore` | Files Prettier shouldn't touch | 7 |
| `README.md` | Skeleton with placeholder sections | 8 |

**Files NOT created in this story (deferred):**

- `.env.example` → Story 1.3 (Docker) introduces it with `POSTGRES_*` and CORS vars; Story 1.4 adds backend-side keys.
- `docker-compose.yml`, `docker-compose.override.yml` → Story 1.3.
- `.github/workflows/ci.yml` → Story 1.2.
- `apps/backend/**`, `apps/frontend/**`, `packages/shared/**`, `e2e/**` → Stories 1.4 / 1.5 / 1.6 / 1.5 respectively.
- Per-package `README.md`, `tsconfig.json`, `Dockerfile`, etc. → at each package's first scaffolding story.

### Workspace Configuration Details

`package.json` shape (illustrative — adjust devDep versions per *Dependencies and Versions* before commit):

```json
{
  "name": "bmad-todo",
  "private": true,
  "version": "0.0.0",
  "engines": { "node": ">=20.0.0" },
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "npm test --workspaces --if-present",
    "typecheck": "tsc --build"
  },
  "devDependencies": {
    "@eslint/js": "...",
    "@types/node": "...",
    "eslint": "...",
    "eslint-config-prettier": "...",
    "prettier": "...",
    "typescript": "...",
    "typescript-eslint": "..."
  }
}
```

**Why workspace root `private: true`:** npm refuses to publish workspace roots, but more importantly: keeps `npm publish` accidents impossible.

**Why no `"type": "module"` at the root:** Backend (`apps/backend`) and frontend (`apps/frontend`) will independently choose ESM/CJS in Stories 1.4/1.5. Forcing it at root constrains future per-package decisions and breaks `eslint.config.js` (CJS-form chosen above for simplicity).

**Workspaces declared but empty:** `apps/*` and `packages/*` resolve to zero packages on Day 1. `npm install` works fine; `npm test --workspaces --if-present` no-ops gracefully.

### Test Script Strategy (CRITICAL — common LLM trap)

The AC requires `npm run test` to **pass** on the empty scaffold. There are no tests yet. Three strategies — pick **#1**:

1. **Recommended:** `"test": "npm test --workspaces --if-present"` — when workspaces exist (Stories 1.4+), each runs its own `test` script (Vitest). Today, with zero workspaces, npm prints "No workspaces found" and exits 0. Verified npm 10+ behavior. Workspace coverage thresholds are added per-package in 1.4/1.5/1.6.

2. **Alternative:** `"test": "vitest run --passWithNoTests"` — install Vitest at the root. Works, but installs Vitest at root *and* per-app, which causes version drift risk. **Reject** — keeps Vitest as a per-package tool (architecture: "Vitest both sides … single config story" *per package*).

3. **Wrong:** `"test": "exit 0"` — masks failure later when a workspace's test script breaks. **Do not use.**

**Same rule for typecheck:** `tsc --build` reads root `tsconfig.json`'s `references: []` and exits 0. When 1.4/1.5/1.6 add their projects, append to the array.

### TypeScript Configuration

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true
  }
}
```

```json
// tsconfig.json (root, for `tsc --build`)
{
  "extends": "./tsconfig.base.json",
  "files": [],
  "references": []
}
```

**`noUncheckedIndexedAccess: true` consequences (warn the dev team now):** array/object index access returns `T | undefined`. Story 1.4+ controllers will see this immediately when accessing query params. This is intentional — it surfaces real null-safety bugs.

**Why `module: "NodeNext"`:** matches the backend Fastify runtime. Frontend will override to `module: "ESNext"` + `moduleResolution: "bundler"` in its own `tsconfig.json` — Vite needs that. Both extend this base; only the override differs.

**Why `target: "ES2022"`:** Node 20+ supports it natively (architecture: Node 20+ runtime). No transpilation step needed for the backend.

### ESLint 9 Flat Config Notes

- ESLint 9 (released 2024-04) is the only major that supports flat config natively without the `--config` flag and without the `ESLINT_USE_FLAT_CONFIG=true` shim. AC #6 requires v9 explicitly.
- Flat config is **a single array** that ESLint walks in order; later entries override earlier ones. `eslintConfigPrettier` MUST be last (AC #7) so its `rules: {}` overrides any stylistic rules from `js.configs.recommended` or `tseslint.configs.recommended`.
- The `typescript-eslint` package (note: **no slash**, it's the v8 package, not the legacy `@typescript-eslint/eslint-plugin`) provides a `tseslint.config(...)` helper that gives you typed config + sane defaults.
- For now, do **not** enable type-aware lint rules (`tseslint.configs.recommendedTypeChecked`) — there are no TypeScript projects to point at yet. Stories 1.4/1.5/1.6 will turn this on per-package.
- `@typescript-eslint/naming-convention` is mentioned in architecture.md *Pattern Enforcement Mechanisms* (line 701) as a future enforcement tool. **Do not add it in this story.** It needs type information and per-package source files to be useful. Defer to Story 1.4 or later.

### Prettier Configuration

`.prettierrc.json` — set explicit values so the version's defaults can't surprise us:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "endOfLine": "lf"
}
```

**`endOfLine: "lf"`** is redundant with `.editorconfig` for line endings of files Prettier writes, but explicit is better — defends against an editor with no `.editorconfig` plugin enabled.

**`printWidth: 100`** is a deliberate departure from Prettier's default of 80. Modern editors and screens; React JSX with TypeScript types gets cramped at 80. Doesn't matter for Story 1.1 (no source files yet) but locks the convention.

### Project Structure Notes

**Alignment with architecture.md *Project Structure & Boundaries* (lines 762–895):**

- The architecture's repo-root file list (lines 766–781) is the source of truth for *which* files belong at root. Story 1.1 creates the subset listed in the *Files to Create* table above.
- The architecture lists `tsconfig.base.json` but not a root `tsconfig.json`. **This story adds a root `tsconfig.json`** — a minimal extension required to satisfy the verification AC's `tsc --build` line. Document the deviation in commit message; later stories will populate `references`.

**Detected variances (with rationale):**

- *Variance 1: Root `tsconfig.json` not in architecture's directory listing.* **Rationale:** AC's verification command (`tsc --build` exits 0) needs a root project. Empty `references: []` makes it a no-op until 1.4/1.5/1.6 register references. Zero risk; defensible.
- *Variance 2: `eslint.config.js` (CommonJS) not `eslint.config.mjs`.* **Rationale:** AC #6 names `eslint.config.js` literally. CJS form keeps workspace root from needing `"type": "module"`, which would force ESM on the entire workspace.
- *Variance 3: `.gitignore` includes additional entries (`*.log`, `.DS_Store`, etc.) beyond AC #5's literal list.* **Rationale:** AC says "excludes `node_modules/`, `dist/`, `.env`, `coverage/`" — that's a minimum, not a maximum. Adding common Node/IDE/OS patterns prevents accidental commits across the project's lifetime.

### Architecture Compliance

**Cross-cutting rules from architecture.md *Implementation Patterns & Consistency Rules* (lines 542–760) that apply here:**

- **Naming Patterns (Code Naming):** All identifiers in `eslint.config.js`, `package.json` scripts, etc., follow `camelCase`. No deviation. (line 568)
- **File Naming:** Configuration files at root are kebab-case (`tsconfig.base.json`, `eslint.config.js`). (line 579)
- **Format Patterns:** No source code yet, so JSON/YAML rules don't apply to user-facing data. But `.prettierrc.json` itself follows `camelCase` for its own config keys (Prettier convention). (line 614)
- **Process Patterns — Pattern Update Process** (line 707): "Material changes to these patterns are architectural changes." Story 1.1 *establishes* the patterns; later drift goes through `bmad-correct-course`.

**Non-foreclosure obligations preserved by this story:** none directly affected. Story 1.1 doesn't touch the four architecturally-non-foreclosed capabilities (multi-user/auth, per-todo metadata, real-time sync, audit log). All four stay open.

### Dependencies and Versions

These are devDependencies for `package.json`. The architecture.md initialization commands (lines 121–145) say versions should be "pinned to current stable versions at scaffolding time — the dev team should run these against the latest published versions on the day they scaffold."

**Today (2026-04-28) latest-stable references for the dev agent — verify with `npm view <pkg> version` before committing:**

| Package | Latest stable (as of 2026-04) | Why this version |
|---|---|---|
| `eslint` | 9.x | AC #6 mandates ESLint 9 flat config. |
| `@eslint/js` | 9.x | Recommended JS rules; tracks ESLint 9 major. |
| `typescript-eslint` | 8.x | Compatible with ESLint 9; provides `tseslint.config()` helper and TS-aware rules. **NOT** the legacy `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` pair — `typescript-eslint` (no slash) is the v8 unified package. |
| `eslint-config-prettier` | 9.x or 10.x | Disables stylistic ESLint rules that conflict with Prettier. |
| `prettier` | 3.x | Modern stable line; `printWidth`/`trailingComma: "all"` defaults differ from 2.x. |
| `typescript` | 5.x | Required for ESLint flat config + `tsc --build` strict mode. |
| `@types/node` | matches Node major (`22.x` if `.nvmrc` is `22`) | Type definitions for Node built-ins, used by config files. |

**Verification step before commit:**

```bash
for pkg in eslint @eslint/js typescript-eslint eslint-config-prettier prettier typescript @types/node; do
  echo "$pkg: $(npm view "$pkg" version)"
done
```

Pin to *exact* versions in `package.json` (no `^` or `~`) for the workspace root tooling — Story 1.1's deterministic-toolchain promise (NFR16) is undermined by floating ranges. Per-package runtime deps in 1.4+ may use carets at the dev team's discretion.

### Testing Standards

Per epics.md Story 1.1 *Test Scenarios* block:

- **Unit:** none — no source code yet.
- **Integration:** none.
- **E2E:** none.
- **Verification:** `npm ci && npm run lint && npm run format:check && npm run test && tsc --build` exits 0.

The verification command is the *contract* for this story. Any deviation (e.g. ESLint warning treated as error, Prettier formatting drift in committed configs) breaks the AC.

**Vitest is NOT installed at the workspace root.** Per the architecture's *Testing Framework* posture (line 187), Vitest lives in each package that has tests. Story 1.4 installs it in `apps/backend`, Story 1.5 in `apps/frontend`. Coverage thresholds (NFR18/NFR19, ≥70%) are configured *in those packages' `package.json`*, not here.

### Anti-Patterns to Avoid

❌ **Don't install Vitest at the workspace root.** Per-package tool, per architecture. Adds version-drift risk.
❌ **Don't add `"type": "module"` at the workspace root.** Constrains per-package decisions in 1.4/1.5.
❌ **Don't pin Node 18 in `.nvmrc` or `engines`.** Architecture says Node 20+. Pin Node 22 (current LTS).
❌ **Don't commit `package-lock.json` to `.gitignore`.** It must be tracked — `npm ci` requires it (NFR16).
❌ **Don't enable type-aware ESLint rules** (`tseslint.configs.recommendedTypeChecked`). No TS projects to point at; will throw "no parserOptions.project specified" errors. Defer to Story 1.4+.
❌ **Don't add `@typescript-eslint/naming-convention` rules now.** Same reason. Defer to per-package configs.
❌ **Don't write any source code in `apps/` or `packages/`.** Story 1.1 is *only* the root scaffold. Empty workspace dirs aren't created (npm workspaces resolve nothing if dirs don't exist; that's fine).
❌ **Don't put scripts in `README.md` that depend on later stories** (e.g., `docker compose up`). README has placeholders, not commands that don't work yet.
❌ **Don't add a `prepare` script that runs `husky` or other Git hooks.** Out of scope. Pre-commit hooks are not in v1's NFRs.
❌ **Don't add `engines.npm` constraint.** Lock-file format compat across npm 9/10/11 is fine.

### References

All citations refer to files under `/home/aman/projects/nearform/bmad-todo/`.

- Story scope and ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1-Scaffold-the-workspace-monorepo-and-shared-tooling]
- Workspace + monorepo decision: [Source: _bmad-output/planning-artifacts/architecture.md#Selected-Starter-Two-Scaffold-Workspace-Monorepo (lines 110–145)]
- Repo layout: [Source: _bmad-output/planning-artifacts/architecture.md#Repo-Layout (lines 156–175)]
- Language/runtime decisions (TS strict, Node 20+, target ES2022): [Source: _bmad-output/planning-artifacts/architecture.md#Architectural-Decisions-Provided-by-This-Starter-Posture (lines 147–212)]
- Lint/format choices (ESLint + Prettier as pre-test gates): [Source: _bmad-output/planning-artifacts/architecture.md#Linting-Formatting (lines 194–198)]
- Naming conventions: [Source: _bmad-output/planning-artifacts/architecture.md#Naming-Patterns (lines 548–587)]
- Pattern enforcement mechanisms: [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement-Guidelines (lines 688–710)]
- Complete directory structure (source of truth for which files live where): [Source: _bmad-output/planning-artifacts/architecture.md#Complete-Project-Directory-Structure (lines 762–895)]
- NFR23 (cross-OS via LF line endings): [Source: _bmad-output/planning-artifacts/prd.md (NFR23) and _bmad-output/planning-artifacts/architecture.md#Cross-OS-portability]
- NFR14, NFR16, NFR17 (maintainability, clone-and-go README, no magic constants): [Source: _bmad-output/planning-artifacts/prd.md#Maintainability]
- *Additional Requirements* line establishing this as Story 1.1 starter template: [Source: _bmad-output/planning-artifacts/epics.md (line 88)]

### Project Knowledge References

No `docs/project-context.md` exists yet — Story 1.1 is too early for it. (`bmad-generate-project-context` runs after a meaningful codebase exists.) Persistent-facts loading was a no-op for this run.

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7[1m]` via the BMad `bmad-dev-story` skill, executed 2026-04-28.

### Debug Log References

Two issues surfaced during the verification run; both were resolved without scope expansion:

1. **`@typescript-eslint/no-require-imports` flagged the CommonJS `eslint.config.js` itself.** `tseslint.configs.recommended` applies its rules to all files (no built-in TS-only file filter), so the rule that bans `require()` in TS files also fired on the JS config file. Fix: a scoped override in `eslint.config.js` for `**/*.{js,cjs}` that turns `@typescript-eslint/no-require-imports` off (CommonJS is intentional here per the story's _ESLint 9 Flat Config Notes_).
2. **`npm test --workspaces --if-present` exits 1 with "No workspaces found!" on npm 11.3.** The story's _Test Script Strategy_ documented this as the recommended approach with a "verified npm 10+ behavior" note — that note was wrong for npm 11. Fix: `scripts/run-workspace-tests.cjs` checks for any `apps/*/package.json` or `packages/*/package.json` before delegating to `npm test --workspaces --if-present`; exits 0 with an informative message when none exist.

### Completion Notes List

- **Verification command exits 0 from a clean clone.** Confirmed via `rm -rf node_modules && npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build` — all stages green, exit code 0.
- **Versions pinned (exact, no carets) per the story's deterministic-toolchain promise (NFR16):**
  - `eslint@9.39.4` (latest 9.x patch on 2026-04-28; AC #6 mandates ESLint 9)
  - `@eslint/js@9.39.4`
  - `typescript-eslint@8.59.1` (v8 line — compatible with ESLint 9; provides `tseslint.config()` helper)
  - `eslint-config-prettier@9.1.2`
  - `prettier@3.8.3`
  - `typescript@5.9.3`
  - `@types/node@24.12.2` (matches the chosen Node 24 pin)
- **Deviation from story: `.nvmrc` pinned to `24`, not `22`.** Rationale: Node 24 is the active LTS as of 2026-04-28 (entered LTS October 2025); Node 22 moved to maintenance LTS. The system Node was already 24.0.0. The story's recommendation of `22` was based on stale LTS-cycle info. `engines.node` remains `>=20.0.0` (architecture floor preserved).
- **Deviation from story: added `scripts/run-workspace-tests.cjs`.** Not in the story's _Files to Create_ table. Rationale: workaround for the npm 11 behavior change above. Cross-platform Node script avoids POSIX-shell-only conditionals that would break Windows hosts (NFR23 portability). The script is generic enough to be reused or replaced once `apps/*` / `packages/*` are populated in Stories 1.4 / 1.5 / 1.6.
- **Deviation from story: `.prettierignore` includes `_bmad-output`, `_bmad`, `.claude`, `CLAUDE.md`.** Not in the story's prescribed list. Rationale: Prettier's defaults disagree with the BMad-curated planning artifacts (e.g., `*emphasis*` vs `_emphasis_` in CLAUDE.md, YAML quoting in BMad scaffolds). These files are tooling/guidance artifacts owned by other workflows; subjecting them to Prettier governance would create noise on every BMad install/update. The Prettier-governed scope is "deliverable docs and source code", which is what Story 1.1 actually intends.
- **Deviation from story: `.gitignore` preserves pre-existing `.idea/` and `.claude/skills/` entries** (the file existed before Story 1.1 with two entries). All AC #5 entries appended.
- **Deviation from story: `README.md` rewritten in place** (existing planning-state README replaced with the skeleton AC #8 specifies). No content lost — the previous README's "planning complete, implementation pending" framing is preserved by the planning artifacts themselves.
- **Non-foreclosure paths preserved.** Story 1.1 doesn't touch the four architecturally-non-foreclosed capabilities (multi-user/auth, per-todo metadata, real-time sync, audit log). All four remain open.
- **No source code created in `apps/` or `packages/`.** Workspace globs declared and resolve to zero packages today, by design — Stories 1.4 / 1.5 / 1.6 land the actual workspace packages.

### File List

**NEW:**

- `package.json` — workspace root: name, private, engines (Node ≥ 20), workspaces globs (`apps/*`, `packages/*`), scripts (lint / format / format:check / test / typecheck), pinned devDependencies.
- `package-lock.json` — generated by `npm install`; committed for `npm ci` reproducibility (NFR16).
- `tsconfig.base.json` — shared compiler options: `strict`, `noUncheckedIndexedAccess`, `target ES2022`, `module NodeNext`, plus complementary safety flags.
- `tsconfig.json` — root project for `tsc --build`; extends base; empty `files: []` and `references: []` (populated by Stories 1.4 / 1.5 / 1.6).
- `.editorconfig` — `root=true`; LF line endings (NFR23), UTF-8, 2-space indent; Markdown override preserves trailing whitespace.
- `.nvmrc` — `24` (current active Node LTS; see deviation note above).
- `eslint.config.js` — ESLint 9 flat config (CJS form); composes `@eslint/js` recommended + `typescript-eslint` recommended + scoped CJS override + `eslint-config-prettier` last.
- `.prettierrc.json` — explicit defaults: semi, single quotes, trailing comma all, print width 100, LF.
- `.prettierignore` — node_modules, build outputs, lockfile, BMad artifacts (see deviation note above).
- `scripts/run-workspace-tests.cjs` — workaround helper (see deviation note above).

**MODIFIED:**

- `.gitignore` — appended Story 1.1's required entries to the pre-existing two-entry file.
- `README.md` — rewritten as the AC-specified skeleton; previous planning-state framing superseded.

## Change Log

| Date | Story | Change | Author |
|---|---|---|---|
| 2026-04-28 | 1.1 | Initial implementation: workspace monorepo scaffold + shared lint/format/typecheck/test tooling. Verification chain (`npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build`) exits 0 from clean clone. | Aman (via `bmad-dev-story` / `claude-opus-4-7[1m]`) |
