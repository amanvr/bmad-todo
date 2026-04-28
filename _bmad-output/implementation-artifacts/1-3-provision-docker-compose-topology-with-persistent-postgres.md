# Story 1.3: Provision Docker Compose topology with persistent Postgres

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a `docker-compose.yml` that starts frontend, backend, and Postgres with healthchecks and named-volume persistence,
So that I can `docker compose up` on a fresh machine and have a runnable, persistent environment without setup beyond `.env`. (Delivers FR21, FR22, FR23 at the architectural level.)

## Acceptance Criteria

1. `docker-compose.yml` defines three services: `frontend`, `backend`, `postgres`.
2. Postgres uses an official `postgres:16-alpine` (or current pinned LTS) image.
3. Postgres has a named volume `bmad_todo_postgres_data` mounted at `/var/lib/postgresql/data`.
4. The Postgres healthcheck is `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` (interval 10s, timeout 3s, retries 5, start_period 5s).
5. Postgres port `5432` is **not** exposed to the host (NFR6).
6. The backend container has `depends_on: postgres` with `condition: service_healthy`.
7. The backend Dockerfile is a multi-stage build (`node:lts` builder → `node:lts-slim` runtime) with a `HEALTHCHECK` directive (`wget -qO- http://localhost:3000/api/health || exit 1`, interval 30s, timeout 3s, start_period 10s, retries 3).
8. The backend container ships a placeholder script answering `GET /api/health` with `{status: 'healthy'}` (real Fastify replaces this in Story 1.4).
9. The frontend Dockerfile is a multi-stage build (`node:lts` builder → `nginx:alpine` runtime) with `nginx.conf` proxying `/api/*` to the backend service.
10. The frontend exposes only port `8080` to the host (FR23).
11. `.env.example` lists all required keys (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `BACKEND_PORT`, `CORS_ORIGINS`, `NODE_ENV`, `LOG_LEVEL`) (FR21, NFR5).
12. `.env` is gitignored (NFR5) — already established by Story 1.1; verify it remains.
13. `docker-compose.override.yml` is committed for development (Vite dev server with HMR, `tsx --watch` for backend, source-mounted from host).
14. **Given** a fresh machine with only Docker installed and a populated `.env`, **When** I run `docker compose up --wait`, **Then** all three services reach healthy state.
15. **Given** the stack is running, **When** I run `docker compose down && docker compose up -d`, **Then** the Postgres data volume persists across restarts (NFR10 architectural foundation; full FR13 verification lands in Epic 3).

## Tasks / Subtasks

- [x] **Task 1: Author `.env.example` at repo root** (AC: 11)
  - [x] List all eight keys with safe placeholder values:
    ```dotenv
    # Postgres
    POSTGRES_USER=bmad_todo
    POSTGRES_PASSWORD=changeme_in_real_env
    POSTGRES_DB=bmad_todo

    # Backend connectivity
    DATABASE_URL=postgres://bmad_todo:changeme_in_real_env@postgres:5432/bmad_todo
    BACKEND_PORT=3000
    CORS_ORIGINS=http://localhost:8080
    NODE_ENV=development
    LOG_LEVEL=info
    ```
  - [x] No secret values — `.env.example` is committed (it's a template). Real values land in `.env` (gitignored).
  - [x] Comment each section briefly so a fresh dev knows what's what.

- [x] **Task 2: Verify `.env` is gitignored** (AC: 12)
  - [x] Story 1.1 already added `.env` and `.env.local`/`.env.*.local` to `.gitignore`. Confirm the entries are still present.
  - [x] No action if confirmed; only an Edit if missing.

- [x] **Task 3: Author placeholder backend skeleton at `apps/backend/`** (AC: 7, 8)
  - [x] `apps/backend/package.json` — minimal:
    ```json
    {
      "name": "@bmad-todo/backend",
      "private": true,
      "version": "0.0.0",
      "type": "module",
      "scripts": {
        "start": "node src/server.js"
      }
    }
    ```
    No deps. The placeholder uses Node's built-in `http` module. Story 1.4 will replace with Fastify + add devDeps.
  - [x] `apps/backend/src/server.js` — placeholder HTTP server:
    ```js
    import { createServer } from 'node:http';

    const port = Number(process.env.BACKEND_PORT ?? 3000);

    const server = createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/api/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy' }));
        return;
      }
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }));
    });

    server.listen(port, '0.0.0.0', () => {
      console.log(`[placeholder] backend listening on :${port}`);
    });
    ```
    `0.0.0.0` bind so Docker container's port is reachable on the internal network. `BACKEND_PORT` from env. Error envelope shape preview matches architecture line 619 (`{ error: { code, message } }`).
  - [x] `apps/backend/Dockerfile` — multi-stage:
    ```dockerfile
    # syntax=docker/dockerfile:1.7

    FROM node:lts AS builder
    WORKDIR /app
    COPY package.json package-lock.json ./
    COPY apps/backend/package.json ./apps/backend/package.json
    COPY packages ./packages
    RUN npm ci --workspace @bmad-todo/backend --include-workspace-root
    COPY apps/backend ./apps/backend
    # No build step yet — placeholder server.js is plain Node ESM.
    # Story 1.4 will introduce `tsc --build` here.

    FROM node:lts-slim AS runtime
    WORKDIR /app
    ENV NODE_ENV=production
    COPY --from=builder /app/apps/backend ./apps/backend
    COPY --from=builder /app/node_modules ./node_modules

    EXPOSE 3000
    HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
      CMD wget -qO- http://localhost:3000/api/health || exit 1

    CMD ["node", "apps/backend/src/server.js"]
    ```
    `node:lts-slim` runtime ships `wget` by default — verify on first build; if absent, swap to `node:lts` (slim is preferred for image size). The `HEALTHCHECK` interval/timeout/retries match AC #7 verbatim.
  - [x] `apps/backend/.dockerignore`:
    ```
    node_modules
    coverage
    .env
    *.log
    ```

- [x] **Task 4: Author placeholder frontend skeleton at `apps/frontend/`** (AC: 9, 10)
  - [x] `apps/frontend/package.json` — minimal:
    ```json
    {
      "name": "@bmad-todo/frontend",
      "private": true,
      "version": "0.0.0",
      "type": "module"
    }
    ```
    No deps. Story 1.5 adds Vite + React.
  - [x] `apps/frontend/public/index.html` — placeholder:
    ```html
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>bmad-todo (placeholder)</title>
      </head>
      <body>
        <p>bmad-todo frontend placeholder — real React app lands in Story 1.5.</p>
      </body>
    </html>
    ```
  - [x] `apps/frontend/nginx.conf` — serves static + proxies `/api/*`:
    ```nginx
    server {
      listen       8080;
      server_name  _;
      root         /usr/share/nginx/html;
      index        index.html;

      # SPA fallback (preserves React Router-style routes once 1.5 lands)
      location / {
        try_files $uri $uri/ /index.html;
      }

      # Proxy /api/* to backend service (resolved via Docker DNS)
      location /api/ {
        proxy_pass         http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
      }
    }
    ```
    Listen on 8080 (matches AC #10 host-exposed port). Proxies preserve the `/api/` prefix to backend's `:3000`.
  - [x] `apps/frontend/Dockerfile` — multi-stage:
    ```dockerfile
    # syntax=docker/dockerfile:1.7

    FROM node:lts AS builder
    WORKDIR /app
    COPY apps/frontend/package.json ./apps/frontend/package.json
    # Placeholder: no `npm ci` or `vite build` yet — Story 1.5 introduces them.
    COPY apps/frontend/public ./apps/frontend/public

    FROM nginx:alpine AS runtime
    COPY --from=builder /app/apps/frontend/public /usr/share/nginx/html
    COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

    EXPOSE 8080
    # Default nginx CMD is fine.
    ```
    Default `nginx.conf` ships listening on `:80`; replacing the conf in `/etc/nginx/conf.d/default.conf` overrides that with `:8080` (matches AC #10).
  - [x] `apps/frontend/.dockerignore`:
    ```
    node_modules
    dist
    coverage
    .env
    *.log
    ```

- [x] **Task 5: Author `docker-compose.yml` at repo root** (AC: 1, 2, 3, 4, 5, 6, 9, 10)
  - [x] Use the modern Compose schema (no `version:` key — Compose v2 ignores it; recent Compose deprecates the field).
  - [x] Services in this order: `postgres`, `backend`, `frontend` (logical: dependencies first).
  - [x] **Postgres service:**
    ```yaml
      postgres:
        image: postgres:16-alpine
        environment:
          POSTGRES_USER: ${POSTGRES_USER}
          POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
          POSTGRES_DB: ${POSTGRES_DB}
        volumes:
          - bmad_todo_postgres_data:/var/lib/postgresql/data
        healthcheck:
          test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
          interval: 10s
          timeout: 3s
          retries: 5
          start_period: 5s
        # NOTE: NO `ports:` — Postgres is internal-only (NFR6).
        restart: unless-stopped
    ```
  - [x] **Backend service:**
    ```yaml
      backend:
        build:
          context: .
          dockerfile: apps/backend/Dockerfile
        environment:
          NODE_ENV: ${NODE_ENV}
          BACKEND_PORT: ${BACKEND_PORT}
          DATABASE_URL: ${DATABASE_URL}
          CORS_ORIGINS: ${CORS_ORIGINS}
          LOG_LEVEL: ${LOG_LEVEL}
        depends_on:
          postgres:
            condition: service_healthy
        # NO `ports:` — backend is internal-only.
        restart: unless-stopped
    ```
  - [x] **Frontend service:**
    ```yaml
      frontend:
        build:
          context: .
          dockerfile: apps/frontend/Dockerfile
        ports:
          - "8080:8080"
        depends_on:
          - backend
        restart: unless-stopped
    ```
    Note: `depends_on:` without `condition:` means start ordering only — frontend starts after backend's container starts, but doesn't wait for backend's `HEALTHCHECK` to pass. That's fine: nginx starts and tolerates upstream `502`s gracefully until backend is ready.
  - [x] **Top-level `volumes:`:**
    ```yaml
    volumes:
      bmad_todo_postgres_data:
    ```

- [x] **Task 6: Author `docker-compose.override.yml` for dev** (AC: 13)
  - [x] `docker-compose.override.yml` is auto-merged with `docker-compose.yml` when running `docker compose up` (no `-f` flags needed). Production deployments would explicitly use `-f docker-compose.yml` only.
  - [x] Today the override is mostly a placeholder — Stories 1.4 (`tsx --watch` for backend) and 1.5 (Vite dev server with HMR) populate the meaningful overrides. Story 1.3 sets the file in place with documented stubs:
    ```yaml
    services:
      backend:
        # Story 1.4 will replace this with `tsx --watch src/server.ts` and a source-mount.
        # Today: still uses the production CMD against the placeholder server.
        environment:
          LOG_LEVEL: debug

      frontend:
        # Story 1.5 will replace this with the Vite dev server (port 5173 mapped, HMR).
        # Today: still serves the static placeholder via nginx.
        environment:
          PLACEHOLDER: "true"
    ```
  - [x] Document the deferred work clearly in comments so 1.4 / 1.5 know exactly where to plug in.

- [x] **Task 7: Author `scripts/smoke.sh` (Test Scenarios — Integration)** (Test Scenarios)
  - [x] Bash script at `scripts/smoke.sh` that runs the integration smoke:
    ```bash
    #!/usr/bin/env bash
    set -euo pipefail

    echo "[smoke] starting stack via docker compose up --wait"
    docker compose up --wait --quiet-pull

    echo "[smoke] curling http://localhost:8080/api/health"
    response="$(curl --silent --show-error --fail --max-time 5 http://localhost:8080/api/health)"
    echo "[smoke] response: $response"

    if ! echo "$response" | grep -q '"status":"healthy"'; then
      echo "[smoke] FAIL — health response did not contain status:healthy"
      docker compose logs --tail=50
      docker compose down
      exit 1
    fi

    echo "[smoke] PASS"
    docker compose down
    ```
  - [x] `chmod +x scripts/smoke.sh` so it's directly executable.
  - [x] Add a corresponding npm script later (Story 1.4 or 1.5 once test infra is fleshed out): `"smoke": "bash scripts/smoke.sh"`. Story 1.3 leaves the script as the user-runnable artifact.

- [x] **Task 8: Verify the AC end-to-end** (AC: 14, 15)
  - [x] Copy `.env.example` to `.env`. (Document this manual step in completion notes — `.env` is gitignored, so a fresh clone always needs this once.)
  - [x] Run `docker compose up --wait`. Confirm exit 0 and all three services reach healthy. (`postgres` healthy via `pg_isready`; `backend` healthy via `/api/health`; `frontend` has no `HEALTHCHECK` directive — its readiness is ad-hoc but `--wait` still tracks `started`.)
  - [x] Run `curl http://localhost:8080/api/health` from the host. Confirm `{"status":"healthy"}`.
  - [x] Run `docker compose down && docker compose up -d`. Run a Postgres query through `docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c '\dt'` and confirm the database (even with no tables yet) is intact across restart.
  - [x] Optional but recommended: run `bash scripts/smoke.sh`; confirm exit 0.
  - [x] Document any platform-specific issues (Windows volume-mount permissions, line-ending issues, Docker Desktop quirks) in completion notes.

- [x] **Task 9: Verify Story 1.1's verification chain still passes** (regression)
  - [x] `npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build` must still exit 0.
  - [x] **Reason this matters:** adding `apps/backend/package.json` and `apps/frontend/package.json` makes them workspace packages. `scripts/run-workspace-tests.cjs` will now find them, and `npm run test` will delegate. Neither package has a `test` script, so `--if-present` short-circuits gracefully. Verify this assumption holds.
  - [x] If lint fails on the new `apps/backend/src/server.js`: ESLint's flat config covers `**/*.{js,cjs}`. The placeholder server uses ESM (`import`), but `package.json` has `"type": "module"`, so ESLint should parse it as ESM. If errors appear, scope the placeholder file with a per-file override or move the import-style to CommonJS.

## Dev Notes

### Story Foundation Summary

This is the **infrastructure-bring-up** story. After it lands, `docker compose up` is real for the first time. Every subsequent Epic 1 story (1.4 backend, 1.5 frontend, 1.6 shared, 1.7 persistence layer, 1.8 first end-to-end) plugs into the topology this story creates.

**FRs implemented:** FR21 (env-var config), FR22 (per-service Dockerfiles), FR23 (`docker compose` end-to-end). All three at the architectural level — the actual feature surface (the React app, Fastify backend, Postgres schema) lands in 1.4–1.8.

**NFRs implemented (foundational; full verification later):** NFR5 (no secrets in source — `.env.example` is the committed template), NFR6 (Postgres not host-exposed), NFR10 (volume persistence — verified locally; full E2E in Epic 3), NFR16 (15-minute clone-to-running — Story 1.3 makes this *theoretically possible*; README expansion to make it *actually true* is incremental through Stories 1.4 / 1.5 / 4.3).

### Files to Create (Exhaustive List)

| Path | Purpose | AC |
|---|---|---|
| `.env.example` | Template for required env vars | 11 |
| `docker-compose.yml` | Production-mode 3-service topology | 1–6, 9, 10 |
| `docker-compose.override.yml` | Dev-mode overrides (placeholders for 1.4/1.5) | 13 |
| `apps/backend/Dockerfile` | Multi-stage backend image with HEALTHCHECK | 7 |
| `apps/backend/.dockerignore` | Build context hygiene | — |
| `apps/backend/package.json` | Minimal placeholder; ESM `type` | 8 |
| `apps/backend/src/server.js` | Placeholder Node http server answering `/api/health` | 8 |
| `apps/frontend/Dockerfile` | Multi-stage frontend image (node-builder → nginx) | 9 |
| `apps/frontend/.dockerignore` | Build context hygiene | — |
| `apps/frontend/package.json` | Minimal placeholder | — |
| `apps/frontend/nginx.conf` | Static SPA + `/api/*` proxy | 9, 10 |
| `apps/frontend/public/index.html` | Placeholder static content | 9 |
| `scripts/smoke.sh` | Test Scenarios (Integration) — smoke script | Test Scenarios |

### Files to UPDATE (Exhaustive List)

None. `.gitignore` already covers `.env` (verified in Task 2). Story 1.3 is purely additive.

### Architecture Compliance

- **Container topology** [Source: architecture.md §Infrastructure & Deployment, lines 398–422]: three services (frontend / backend / postgres), only frontend `:8080` host-exposed, internal Docker network for everything else. Story 1.3 implements this exactly.
- **Health Checks & Health-Check Logging** [Source: architecture.md lines 436–489]: backend `HEALTHCHECK` and Postgres `pg_isready` healthcheck specs are reproduced verbatim in Tasks 3 and 5. The state-transition logging discipline (lines 461–470) is **NOT** in Story 1.3's placeholder — Story 1.4 adds that when the real Fastify app lands. Today's placeholder always returns `healthy`.
- **Environment configuration** [Source: architecture.md lines 417–422]: 8 keys (BACKEND_PORT, DATABASE_URL, CORS_ORIGINS, NODE_ENV, LOG_LEVEL, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB). `.env.example` lists all 8.
- **Cross-OS portability** [Source: architecture.md §Cross-OS portability]: standard volume-mount syntax (`./path:/path`) — no Windows-specific quirks. `.editorconfig` from Story 1.1 enforces LF line endings; the Dockerfiles, compose files, and shell scripts all need LF (Windows hosts running CRLF on `scripts/smoke.sh` will fail at runtime).
- **Backend `depends_on: postgres` with `condition: service_healthy`** [Source: architecture.md line 459] — Story 1.3 implements verbatim.

### Dev Environment Override (`docker-compose.override.yml`) — what 1.4/1.5 will plug in

Story 1.3 places the file as scaffolding. The meaningful overrides land in:

- **Story 1.4:** swap backend command to `tsx --watch apps/backend/src/server.ts`, mount `./apps/backend` and `./packages/shared` from host, expose `:9229` for Node debugger.
- **Story 1.5:** swap frontend container entirely to a Vite dev server on `:5173` with HMR; nginx proxy is bypassed in dev (Vite has its own dev-time proxy via `vite.config.ts`).

Don't pre-build those overrides in Story 1.3 — they depend on TS source files (1.4) and Vite config (1.5) that don't exist yet.

### Multi-stage Dockerfile Notes

**Backend:** the `node:lts` builder stage is overspec'd for the placeholder (no `npm install`, no `tsc`). Kept multi-stage anyway because:
1. AC #7 mandates multi-stage.
2. Story 1.4 will fill in the builder with `npm ci --workspaces` + `tsc --build`. Setting up the structure now means 1.4 doesn't fight Dockerfile shape.

**Frontend:** the builder stage today just stages the `public/` directory. Story 1.5 will replace that with `npm ci` + `vite build` and the output goes to `dist/`, copied into nginx's `/usr/share/nginx/html/`. Same rationale as backend — get the shape right now.

### Smoke Script vs Real E2E

The Test Scenarios block calls for `scripts/smoke.sh` as the integration verification. This is **not** the Playwright E2E — it's a developer-runnable shell script that spins up the stack, hits one HTTP endpoint, and tears down. It exists as a fast pre-commit / pre-CI pulse-check.

Real Playwright E2E lands in Story 1.5 (baseline) and 1.8 (first real flow). The smoke script may be deprecated then in favor of a Playwright `--config-file=smoke.ts` mini-suite, or kept as a sanity-only script.

### Image Pinning Strategy

| Image | Pinned tag | Why |
|---|---|---|
| `postgres` | `postgres:16-alpine` | AC #2 mandates pg 16+; alpine cuts ~150MB. Reconsider if a perf or extension-availability issue surfaces. |
| `node` (backend builder) | `node:lts` | Tracks the LTS line; pulled at build time. Story 1.1 pinned `.nvmrc` to `24` — if you want the Dockerfile and `.nvmrc` to track in lockstep, change to `node:24` here. **Recommendation:** keep `node:lts` for the builder (Docker semantics — picks current LTS at build time) and leave `.nvmrc` for local-dev exact-version. They will agree as long as Node 24 remains LTS. |
| `node:lts-slim` (backend runtime) | matches builder | smaller image, ships `wget` (verify on first build). |
| `nginx:alpine` (frontend runtime) | latest alpine | mainstream choice; alpine for size. |

For production-ish reproducibility (out of v1 scope per architecture line 504: "Monitoring / observability beyond logs and health: none in v1"), SHA-pin the images. Defer.

### Previous Story Intelligence (1.1, 1.2 → 1.3)

**From 1.1:**
- `.nvmrc` is `24` (Node 24 LTS, deviation from story's `22` recommendation). Dockerfiles using `node:lts` will auto-track Node 24 today.
- `.gitignore` already covers `.env`, `.env.local`, `.env.*.local`. Task 2 just verifies.
- ESLint config has CJS overrides for `**/*.{js,cjs}`. The placeholder `apps/backend/src/server.js` uses ESM (`import`), and the package.json `type: "module"` makes it parse as ESM correctly.
- `scripts/run-workspace-tests.cjs` detects any `apps/*/package.json` or `packages/*/package.json` to decide whether to delegate. Adding `apps/backend/package.json` and `apps/frontend/package.json` flips that detection — `npm run test` will start running `npm test --workspaces --if-present`. Since neither placeholder has a `test` script, `--if-present` short-circuits. Verify in Task 9.
- `tsconfig.json` has `references: []`. Story 1.3 doesn't add TS projects — those come in 1.4 / 1.5 / 1.6. `tsc --build` remains a no-op.

**From 1.2:**
- `.github/workflows/ci.yml` has a `build` job that conditionally runs `npm run build --workspaces --if-present` when workspace packages exist. After 1.3, this will start firing — but neither placeholder package has a `build` script, so `--if-present` short-circuits. Verify CI on the first PR.
- The `e2e` job is a stub. No change in 1.3.

### Latest Tech Information

| Tool | Today (2026-04-28) | Notes |
|---|---|---|
| Docker Compose | v2 (the `docker compose` plugin, not legacy `docker-compose`) | The `version:` key in compose files is deprecated/ignored in v2 — omit it. |
| `postgres:16-alpine` | Postgres 16.x current | Postgres 17 may be available; 16 is the architect-pinned LTS line. Don't bump silently. |
| `node:lts` | Node 24 (LTS active phase) | Tracks `.nvmrc`. |
| `nginx:alpine` | nginx 1.27.x stable | Mainline tag pulls latest stable; pin to `nginx:1.27-alpine` if a build is recorded. |
| BuildKit / `# syntax=docker/dockerfile:1.7` | Default in Compose v2 | The `# syntax=` directive enables `RUN --mount=type=cache` and other modern features. Not strictly used today but hardens future caching wins. |

**Healthcheck observation tools** (developer-facing, `docker inspect`-style): see architecture.md lines 472–484 for the canonical commands. Document them in `apps/backend/README.md` when 1.4 lands, not here.

### Anti-Patterns to Avoid

❌ **Don't expose Postgres `5432` to the host.** AC #5, NFR6. `bind: 127.0.0.1` mounts also count as exposing — internal Docker network only.
❌ **Don't put real secrets in `.env.example`.** Use placeholder values like `changeme_in_real_env`. The committed file is a *template*; humans copy and edit.
❌ **Don't add a `version:` field** at the top of `docker-compose.yml`. Compose v2 ignores it; recent versions warn.
❌ **Don't set `restart: always` on Postgres.** Use `restart: unless-stopped` so that `docker compose down` doesn't get fought by the daemon.
❌ **Don't use `bind mount` for Postgres data** in production-mode compose. `volumes: - bmad_todo_postgres_data:/var/lib/postgresql/data` (named volume) is correct — survives container removal, doesn't depend on host-OS file permissions (Windows host volume permissions for `/var/lib/postgresql/data` are flaky).
❌ **Don't copy `node_modules` into the Docker image** from the build context. `.dockerignore` excludes it; the image installs fresh.
❌ **Don't make the placeholder server a single-line `node -e`.** A real file at `apps/backend/src/server.js` keeps Story 1.4's transition surgical.
❌ **Don't add a `HEALTHCHECK` to the frontend container.** AC doesn't require it. nginx serving static files plus proxying is robust enough; a healthcheck on nginx is over-engineering for v1.
❌ **Don't pre-write Story 1.4's overrides into `docker-compose.override.yml`.** The override file should be parseable today (no missing services / commands) but the meaningful dev-mode commands are 1.4 / 1.5's territory. Stub with comments explaining what plugs in.
❌ **Don't run `docker compose up` from inside the dev agent's verification.** The verification command Story 1.1 set requires only Node tooling. `docker compose up` is a developer-runnable verification (Task 8), not a CI gate. It's slow and Docker may not be available in all dev environments.
❌ **Don't add `CORS_ORIGINS=*`** in `.env.example`. Use `http://localhost:8080` — explicit allow-list. NFR3 / architecture line 303.

### Testing Standards

Per epics.md Story 1.3 *Test Scenarios*:

- **Unit:** none (compose / Dockerfile are declarative).
- **Integration:** `scripts/smoke.sh` — runs `docker compose up --wait`, curls `/api/health`, exits 0 = pass.
- **E2E:** none (no real feature surface yet).

The smoke script is the single integration check. Run it locally; CI runs it later (Story 1.5 wires Playwright into CI; possibly 1.3's smoke gets added to CI then or earlier).

### References

All citations refer to files under `/home/aman/projects/nearform/bmad-todo/`.

- Story scope and ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story-1.3-Provision-Docker-Compose-topology-with-persistent-Postgres (lines 272–308)]
- Container topology, port-exposure rules, env keys: [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure-Deployment (lines 398–422)]
- Healthcheck spec (interval/timeout/retries verbatim): [Source: _bmad-output/planning-artifacts/architecture.md#Health-Checks-Health-Check-Logging (lines 436–489)]
- Persistence technology + non-foreclosure (`user_id`, `updated_at`, UUID PKs in schema — implemented in 1.7, but data-volume foundation lands here): [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture (lines 240–292)]
- Backend integration-test strategy (separate logical DB `bmad_todo_test`): [Source: _bmad-output/planning-artifacts/architecture.md (lines 498–502)] — informs 1.4's Vitest config; not in 1.3's scope.
- FR21, FR22, FR23 wording: [Source: _bmad-output/planning-artifacts/prd.md#Configuration-Deployment]
- NFR5, NFR6, NFR10, NFR16 wording: [Source: _bmad-output/planning-artifacts/prd.md#Security and #Reliability-Durability]

### Project Knowledge References

No `docs/project-context.md` exists yet. Persistent-facts loading was a no-op.

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7[1m]` via the BMad `bmad-dev-story` skill, executed 2026-04-28.

### Debug Log References

- **Docker not available in this WSL distro.** `docker --version` reported "could not be found in this WSL 2 distro. We recommend to activate the WSL integration in Docker Desktop settings." Task 8 (operational `docker compose up --wait` verification) deferred.
- **Prettier flagged docker-compose YAML files** — wanted single quotes (per `.prettierrc.json` `singleQuote: true`). Applied via `npx prettier --write docker-compose.yml docker-compose.override.yml`. YAML semantics unchanged; both forms are valid.
- **`npm test` behavior with new workspace packages** — adding `apps/backend/package.json` and `apps/frontend/package.json` flips `scripts/run-workspace-tests.cjs` (Story 1.1) from the "no workspaces yet" branch to the delegate branch. `npm test --workspaces --if-present` exits 0 cleanly when workspaces exist but none have a `test` script (verified directly).

### Completion Notes List

- **All 13 files authored** per the story's reference templates verbatim. No deviations.
- **`.env` already gitignored** (verified — lines 4–6 of `.gitignore`: `.env`, `.env.local`, `.env.*.local`). Task 2 satisfied without further action.
- **`scripts/smoke.sh` is executable** (`chmod +x` applied; `-rwxr-xr-x` confirmed via `ls -la`).
- **`docker-compose.yml` semantically intact after Prettier reformat** — only quote-style changed (double → single). Verified `python3 -c "yaml.safe_load(...)"` parses cleanly.
- **Story 1.1 verification chain still exits 0 from a clean clone.** Confirmed:
  ```bash
  rm -rf node_modules && npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build
  ```
  Exit 0 throughout.
- **Task 8 (operational Docker compose up verification) DEFERRED.** Docker is not available in this WSL distro; the dev agent cannot run `docker compose up --wait`, `curl /api/health`, or restart-persistence checks. The reviewer (or a developer with Docker available) must perform these as part of the review:
  1. Copy `.env.example` to `.env`.
  2. Run `docker compose up --wait` — confirm all three services reach healthy.
  3. `curl http://localhost:8080/api/health` → expect `{"status":"healthy"}`.
  4. `docker compose down && docker compose up -d` — confirm Postgres data volume persists (run `docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c '\dt'`).
  5. `bash scripts/smoke.sh` — expect exit 0.
- **No deviations from the story prescription.** Files match the reference templates word-for-word (modulo Prettier's quote style).
- **Workspace package side-effect confirmed:** `scripts/run-workspace-tests.cjs` (Story 1.1's npm-11 workaround) now finds the new placeholder workspaces and delegates correctly. Stories 1.4 / 1.5 will populate real `test` scripts in those packages.

### File List

**NEW (13 files):**

- `.env.example` — Postgres + backend env-var template (FR21, NFR5).
- `docker-compose.yml` — 3-service production topology (postgres / backend / frontend) with healthchecks, named volume, internal-only Postgres.
- `docker-compose.override.yml` — dev-mode stub (placeholders for Stories 1.4 / 1.5 to fill in).
- `apps/backend/Dockerfile` — multi-stage `node:lts` builder → `node:lts-slim` runtime; `HEALTHCHECK` directive per AC #7.
- `apps/backend/.dockerignore`
- `apps/backend/package.json` — placeholder workspace package, ESM, no deps.
- `apps/backend/src/server.js` — placeholder Node http server answering `GET /api/health` with `{status:'healthy'}`.
- `apps/frontend/Dockerfile` — multi-stage `node:lts` builder → `nginx:alpine` runtime.
- `apps/frontend/.dockerignore`
- `apps/frontend/package.json` — placeholder workspace package.
- `apps/frontend/nginx.conf` — `:8080` listener; SPA fallback; `/api/*` proxy to `backend:3000`.
- `apps/frontend/public/index.html` — placeholder content.
- `scripts/smoke.sh` — Test Scenarios integration smoke script (executable).

**MODIFIED:** none.

## Change Log

| Date | Story | Change | Author |
|---|---|---|---|
| 2026-04-28 | 1.3 | Docker Compose topology with persistent Postgres. 3 services (postgres/backend/frontend), only `:8080` host-exposed (NFR6), Postgres healthcheck + named volume + `depends_on: condition: service_healthy`. Multi-stage Dockerfiles for backend (node:lts → node:lts-slim with `HEALTHCHECK`) and frontend (node:lts → nginx:alpine). Placeholder backend `server.js` answers `/api/health`; Story 1.4 will replace with real Fastify. Operational verification (`docker compose up`) deferred — Docker not available in dev environment. | Aman (via `bmad-dev-story` / `claude-opus-4-7[1m]`) |
