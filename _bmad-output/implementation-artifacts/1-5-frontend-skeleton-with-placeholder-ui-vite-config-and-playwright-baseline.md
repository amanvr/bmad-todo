# Story 1.5: Frontend skeleton with placeholder UI, Vite config, and Playwright baseline

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a Vite + React frontend skeleton with placeholder content, a Vitest config, and a Playwright baseline configuration,
So that subsequent feature stories have a working render pipeline and test infrastructure to plug into.

## Acceptance Criteria

1. **Given** Stories 1.1 and 1.3 are complete, **When** Story 1.5 completes, **Then** `apps/frontend/src/main.tsx` mounts `<App>` inside `<ErrorBoundary>`.
2. `apps/frontend/src/App.tsx` renders a placeholder `<h1>bmad-todo</h1>` and a placeholder `<TodoFeature />` slot.
3. `apps/frontend/src/shared/{http.ts, ErrorBoundary.tsx}` exist with the contracts described in `architecture.md`.
4. `apps/frontend/src/styles/globals.css` includes a base reset and a viewport meta-supporting reset.
5. `apps/frontend/index.html` includes `<title>bmad-todo</title>` and a viewport meta tag (NFR8 page-title floor).
6. `apps/frontend/vite.config.ts` is configured with the Vitest plugin and React Testing Library setup.
7. Vitest coverage threshold ≥ 70% is configured in `apps/frontend/package.json` (NFR19).
8. `e2e/` workspace package exists with `playwright.config.ts`, an empty `tests/` directory, and `@axe-core/playwright` installed (real specs land in Story 1.8 onward).
9. The GHA `ci.yml` `e2e` job is updated from a stub to a real (but currently empty) Playwright run that passes.
10. `apps/frontend/README.md` exists with frontend-specific dev notes.
11. `e2e/README.md` exists with E2E run instructions.
12. **Given** the stack is running via `docker compose up`, **When** I open `http://localhost:8080`, **Then** the placeholder page renders without console errors.

## Tasks / Subtasks

- [x] **Task 1: Replace `apps/frontend/package.json` placeholder with real package** (AC: 1–7)
  - [x] Set name `@bmad-todo/frontend`, `private: true`, `type: "module"`.
  - [x] **scripts:**
    - `dev`: `vite`
    - `build`: `tsc --build && vite build`
    - `preview`: `vite preview`
    - `test`: `vitest run`
    - `test:watch`: `vitest`
    - `test:coverage`: `vitest run --coverage`
  - [x] **dependencies (runtime):** `react`, `react-dom`.
  - [x] **devDependencies:** `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Pin to latest stable; verify with `npm view`.

- [x] **Task 2: Author `apps/frontend/tsconfig.json` and `apps/frontend/tsconfig.node.json`** (AC: 1, 6)
  - [x] `apps/frontend/tsconfig.json`:
    ```json
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "composite": true,
        "rootDir": "src",
        "outDir": "dist",
        "tsBuildInfoFile": "dist/.tsbuildinfo",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "jsx": "react-jsx",
        "lib": ["ES2022", "DOM", "DOM.Iterable"],
        "types": ["vite/client"],
        "noEmit": true,
        "allowImportingTsExtensions": true,
        "verbatimModuleSyntax": true
      },
      "include": ["src/**/*", "tests/**/*"],
      "exclude": ["dist", "node_modules", "coverage"],
      "references": [{ "path": "./tsconfig.node.json" }]
    }
    ```
    Vite needs `module: ESNext` and `moduleResolution: bundler` — overrides the workspace base's `NodeNext`.
  - [x] `apps/frontend/tsconfig.node.json` (for `vite.config.ts` itself):
    ```json
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "composite": true,
        "module": "ESNext",
        "moduleResolution": "bundler",
        "types": ["node"]
      },
      "include": ["vite.config.ts"]
    }
    ```
  - [x] Update root `tsconfig.json` `references`:
    ```json
    "references": [
      { "path": "./apps/backend" },
      { "path": "./apps/frontend" }
    ]
    ```

- [x] **Task 3: Author `apps/frontend/vite.config.ts`** (AC: 6)
  - [x] Vite config with React plugin and Vitest test config:
    ```ts
    /// <reference types="vitest" />
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';

    export default defineConfig({
      plugins: [react()],
      server: {
        port: 5173,
        host: '0.0.0.0',  // Docker reachability
        proxy: {
          // Dev-mode proxy: in production, nginx handles /api/* (Story 1.3).
          // In dev (Vite dev server), Vite proxies directly to backend container.
          '/api': {
            target: 'http://backend:3000',
            changeOrigin: true,
          },
        },
      },
      test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test-setup.ts'],
        include: ['src/**/*.test.{ts,tsx}'],
        coverage: {
          provider: 'v8',
          reporter: ['text', 'html', 'lcov'],
          include: ['src/**/*.{ts,tsx}'],
          exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/test-setup.ts'],
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
  - [x] `apps/frontend/src/test-setup.ts`:
    ```ts
    import '@testing-library/jest-dom/vitest';
    ```

- [x] **Task 4: Author `apps/frontend/index.html`** (AC: 5)
  - [x] At `apps/frontend/index.html` (Vite convention — root of the app, NOT under `public/`):
    ```html
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>bmad-todo</title>
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
      </body>
    </html>
    ```
  - [x] **Delete** `apps/frontend/public/index.html` (Story 1.3's placeholder). Vite serves index.html from the project root, not `public/`. Files in `public/` (e.g. `favicon.svg`) are copied as-is.

- [x] **Task 5: Author `apps/frontend/src/main.tsx`** (AC: 1)
  - [x] Mount `<App />` inside the `<ErrorBoundary />`:
    ```tsx
    import { StrictMode } from 'react';
    import { createRoot } from 'react-dom/client';
    import { App } from './App.js';
    import { ErrorBoundary } from './shared/ErrorBoundary.js';
    import './styles/globals.css';

    const root = document.getElementById('root');
    if (!root) throw new Error('#root element missing in index.html');

    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
    ```

- [x] **Task 6: Author `apps/frontend/src/App.tsx`** (AC: 2)
  - [x] Renders title + placeholder feature slot:
    ```tsx
    import { TodoFeature } from './features/todos/TodoFeature.js';

    export function App() {
      return (
        <main>
          <h1>bmad-todo</h1>
          <TodoFeature />
        </main>
      );
    }
    ```
  - [x] Create `apps/frontend/src/features/todos/TodoFeature.tsx` as a placeholder:
    ```tsx
    export function TodoFeature() {
      return <p>Todos coming soon — Story 1.8 brings the first end-to-end flow.</p>;
    }
    ```
    Story 2.1+ will replace this with the real `useTodos`-driven feature.

- [x] **Task 7: Author `apps/frontend/src/shared/http.ts`** (AC: 3)
  - [x] Generic fetch wrapper with typed `ApiError`:
    ```ts
    export type ErrorCode =
      | 'VALIDATION_FAILED'
      | 'NOT_FOUND'
      | 'INTERNAL_ERROR'
      | 'PERSISTENCE_UNAVAILABLE';

    export interface ApiError {
      code: ErrorCode;
      message: string;
      details?: Record<string, unknown>;
    }

    export class HttpApiError extends Error {
      readonly apiError: ApiError;
      readonly status: number;
      constructor(apiError: ApiError, status: number) {
        super(apiError.message);
        this.name = 'HttpApiError';
        this.apiError = apiError;
        this.status = status;
      }
    }

    export async function httpRequest<T>(
      input: RequestInfo,
      init?: RequestInit,
    ): Promise<T> {
      let response: Response;
      try {
        response = await fetch(input, init);
      } catch {
        // Network failure: map to INTERNAL_ERROR per architecture line 664
        throw new HttpApiError(
          { code: 'INTERNAL_ERROR', message: 'Network request failed' },
          0,
        );
      }

      if (response.status === 204) {
        return undefined as T;  // typical DELETE response — no body
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new HttpApiError(
          { code: 'INTERNAL_ERROR', message: 'Invalid JSON in response' },
          response.status,
        );
      }

      if (!response.ok) {
        // Expected envelope: { error: { code, message, details? } }
        const envelope = body as { error?: ApiError };
        const apiError =
          envelope?.error ?? {
            code: 'INTERNAL_ERROR' as const,
            message: 'Unknown error',
          };
        throw new HttpApiError(apiError, response.status);
      }

      return body as T;
    }
    ```
  - [x] **Story 1.6 will refactor:** the `ErrorCode`/`ApiError` shape moves to `packages/shared/errors.ts`; `http.ts` imports them. For now, hand-define here — keeps 1.5 self-contained.

- [x] **Task 8: Author `apps/frontend/src/shared/ErrorBoundary.tsx`** (AC: 3)
  - [x] Class-based React error boundary (function-based not yet supported by React for this use case):
    ```tsx
    import { Component, type ErrorInfo, type ReactNode } from 'react';

    interface Props {
      children: ReactNode;
      fallback?: ReactNode;
    }

    interface State {
      hasError: boolean;
      error: Error | null;
    }

    export class ErrorBoundary extends Component<Props, State> {
      state: State = { hasError: false, error: null };

      static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
      }

      componentDidCatch(error: Error, info: ErrorInfo) {
        // Last-resort logging — pino isn't available in the browser.
        // Architecture line 612: ErrorBoundary catches React render errors only;
        // it is NOT a substitute for useTodos's error state.
        console.error('[ErrorBoundary]', error, info);
      }

      render() {
        if (this.state.hasError) {
          return (
            this.props.fallback ?? (
              <div role="alert">
                <h2>Something went wrong.</h2>
                <p>Please refresh the page. If the problem persists, contact support.</p>
              </div>
            )
          );
        }
        return this.props.children;
      }
    }
    ```

- [x] **Task 9: Author `apps/frontend/src/styles/globals.css`** (AC: 4)
  - [x] Minimal reset (no Tailwind, no design system):
    ```css
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      min-height: 100%;
    }

    body {
      min-height: 100vh;
      min-height: 100dvh; /* dynamic viewport for mobile address bar */
    }

    main {
      max-width: 64ch;
      margin: 0 auto;
      padding: 1.5rem 1rem;
    }

    /* Respect users who prefer reduced motion */
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    ```

- [x] **Task 10: Author unit tests** (Test Scenarios — Unit)
  - [x] `apps/frontend/src/shared/ErrorBoundary.test.tsx`:
    ```tsx
    import { render, screen } from '@testing-library/react';
    import { describe, expect, it, vi } from 'vitest';
    import { ErrorBoundary } from './ErrorBoundary.js';

    function Bomb({ msg }: { msg: string }): JSX.Element {
      throw new Error(msg);
    }

    describe('ErrorBoundary', () => {
      it('renders fallback when child throws', () => {
        // Suppress React's expected-error console.error noise
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
          <ErrorBoundary>
            <Bomb msg="boom" />
          </ErrorBoundary>,
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      it('renders children when no error', () => {
        render(
          <ErrorBoundary>
            <p>safe</p>
          </ErrorBoundary>,
        );
        expect(screen.getByText('safe')).toBeInTheDocument();
      });
    });
    ```
  - [x] `apps/frontend/src/shared/http.test.ts`:
    - Mock `fetch` (`vi.stubGlobal('fetch', vi.fn())`) and exercise three cases:
      1. 200 with valid JSON → returns parsed body.
      2. 400 with envelope → throws `HttpApiError` with `apiError.code === 'VALIDATION_FAILED'`.
      3. Network rejection → throws `HttpApiError` with `apiError.code === 'INTERNAL_ERROR'`.

- [x] **Task 11: Update `apps/frontend/Dockerfile`** (AC: 12)
  - [x] Builder stage now runs `vite build`:
    ```dockerfile
    FROM node:lts AS builder
    WORKDIR /app
    COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
    COPY apps/frontend/package.json ./apps/frontend/package.json
    COPY packages ./packages
    RUN npm ci --include-workspace-root --workspace @bmad-todo/frontend
    COPY apps/frontend ./apps/frontend
    RUN npm run build --workspace @bmad-todo/frontend

    FROM nginx:alpine AS runtime
    COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
    COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
    EXPOSE 8080
    ```
  - [x] **Delete** `apps/frontend/public/index.html` — replaced by the Vite root `index.html` (Task 4). The `public/` directory may still exist for `favicon.svg` etc.; create a stub `apps/frontend/public/.gitkeep` if you want to preserve the directory.

- [x] **Task 12: Update `docker-compose.override.yml` for Vite dev** (AC: 12)
  - [x] Frontend service in dev mode runs Vite dev server:
    ```yaml
    services:
      frontend:
        command: ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
        ports:
          - "5173:5173"
        volumes:
          - ./apps/frontend:/app/apps/frontend
          - ./packages:/app/packages
          - /app/apps/frontend/node_modules
    ```
  - [x] In dev mode, devs hit `http://localhost:5173` (Vite with HMR) instead of `:8080` (nginx-served build). Document the dual-port setup in `apps/frontend/README.md`.

- [x] **Task 13: Author `apps/frontend/README.md`** (AC: 10)
  - [x] Sections: project description, local dev (Vite vs nginx modes, HMR notes), testing (`npm test`, `npm run test:coverage` ≥ 70%), production build, troubleshooting (Docker volume / file-watching quirks on Windows).

- [x] **Task 14: Create `e2e/` workspace package** (AC: 8, 11)
  - [x] `e2e/package.json`:
    ```json
    {
      "name": "@bmad-todo/e2e",
      "private": true,
      "version": "0.0.0",
      "type": "module",
      "scripts": {
        "test": "playwright test",
        "test:headed": "playwright test --headed",
        "test:install": "playwright install --with-deps"
      },
      "devDependencies": {
        "@playwright/test": "...",
        "@axe-core/playwright": "...",
        "typescript": "...",
        "@types/node": "..."
      }
    }
    ```
  - [x] `e2e/tsconfig.json`:
    ```json
    {
      "extends": "../tsconfig.base.json",
      "compilerOptions": {
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "types": ["node"]
      },
      "include": ["tests/**/*", "playwright.config.ts"]
    }
    ```
  - [x] `e2e/playwright.config.ts`:
    ```ts
    import { defineConfig, devices } from '@playwright/test';

    export default defineConfig({
      testDir: './tests',
      timeout: 30_000,
      expect: { timeout: 5_000 },
      fullyParallel: true,
      forbidOnly: !!process.env.CI,
      retries: process.env.CI ? 1 : 0,
      reporter: [['html', { open: 'never' }], ['list']],
      use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8080',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
      },
      projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ],
    });
    ```
  - [x] Browser matrix matches PRD *Browser Support Matrix* (Chrome / Firefox / Safari). Edge uses Chromium so the `chromium` project covers it. (Architecture's responsive-/portrait/landscape mobile coverage is added in Story 4.1.)
  - [x] `e2e/tests/placeholder.spec.ts` — minimal spec to satisfy the "real (but currently empty) Playwright run that passes" requirement (AC #9):
    ```ts
    import { test, expect } from '@playwright/test';

    test('placeholder page renders', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle('bmad-todo');
    });
    ```
    This satisfies the Test Scenarios E2E line: "placeholder Playwright spec verifies the page loads and `<title>` is 'bmad-todo'."

- [x] **Task 15: Author `e2e/README.md`** (AC: 11)
  - [x] Sections: prerequisites (`docker compose up --wait` to start the stack), browser install (`npx playwright install`), how to run (`npm test`), how to debug (`npm run test:headed`), where the HTML report lands (`playwright-report/`), CI vs local differences.

- [x] **Task 16: Update `.github/workflows/ci.yml` `e2e` job** (AC: 9)
  - [x] Replace the placeholder `echo` step with a real Playwright run. The job needs to:
    1. Check out the repo + setup-node.
    2. `npm ci`.
    3. Build Docker images: `docker compose build`.
    4. Start the stack: `docker compose up -d --wait`.
    5. Install Playwright browsers (cached): `npx playwright install --with-deps chromium firefox webkit` from `e2e/`.
    6. Run `npm test --workspace @bmad-todo/e2e`.
    7. On failure, upload `playwright-report/` as an artifact.
    8. `docker compose down` to clean up.
  - [x] Recommended job structure (replacing the previous stub):
    ```yaml
    e2e:
      name: E2E
      runs-on: ubuntu-latest
      needs: [build]
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version-file: .nvmrc
            cache: 'npm'
        - run: npm ci
        - name: Cache Playwright browsers
          uses: actions/cache@v4
          with:
            path: ~/.cache/ms-playwright
            key: ${{ runner.os }}-playwright-${{ hashFiles('e2e/package.json') }}
        - name: Install Playwright browsers
          run: npx playwright install --with-deps
          working-directory: e2e
        - name: Build Docker stack
          run: docker compose build
        - name: Start stack
          run: docker compose up -d --wait
        - name: Run E2E
          run: npm test --workspace @bmad-todo/e2e
        - name: Upload Playwright report on failure
          if: failure()
          uses: actions/upload-artifact@v4
          with:
            name: playwright-report
            path: e2e/playwright-report
            retention-days: 7
        - name: Tear down stack
          if: always()
          run: docker compose down -v
    ```
  - [x] Note `docker compose down -v` — wipes the Postgres volume after E2E so subsequent CI runs start clean. **Dev workflows should NOT use `-v`** (would lose local data); CI is the only context where it's appropriate.

- [x] **Task 17: Verify the AC end-to-end** (AC: 12)
  - [x] Local run: `npm install` (or `npm ci`), then `docker compose up --wait`, then open `http://localhost:8080`. Confirm `<title>` reads "bmad-todo", placeholder content visible, browser console clean.
  - [x] Run `npm test --workspace @bmad-todo/frontend` — confirm both unit tests pass and coverage threshold met.
  - [x] Run `npm test --workspace @bmad-todo/e2e` (with the stack up) — confirm placeholder spec passes across all three browsers.
  - [x] Run Story 1.1's verification chain: `npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build` — must still exit 0.

## Dev Notes

### Story Foundation Summary

This story closes Epic 1's frontend infrastructure gap. After it lands, `apps/frontend/` has Vite, React, Vitest, Testing Library, an `ErrorBoundary`, an `http` wrapper, and a styled placeholder. `e2e/` has Playwright wired across three browsers with a passing placeholder spec. CI runs the real E2E job (no longer a stub).

**FRs implemented:** none directly. Pure infrastructure for FR1–FR20 (the actual feature surface lands in 1.8 and Epic 2+).

**NFRs implemented:** NFR8 (page-title floor), NFR14 (lint/format integrated), NFR15 (separability — frontend and backend now both have full builds), NFR19 (≥ 70% frontend coverage threshold).

### Files to CREATE

| Path | Purpose |
|---|---|
| `apps/frontend/tsconfig.json` | composite project; ESNext + bundler |
| `apps/frontend/tsconfig.node.json` | for vite.config.ts itself |
| `apps/frontend/vite.config.ts` | Vite + Vitest + jsdom |
| `apps/frontend/index.html` | Vite root (NOT in `public/`) |
| `apps/frontend/src/main.tsx` | mount `<App>` inside `<ErrorBoundary>` |
| `apps/frontend/src/App.tsx` | placeholder layout |
| `apps/frontend/src/test-setup.ts` | imports `@testing-library/jest-dom/vitest` |
| `apps/frontend/src/features/todos/TodoFeature.tsx` | placeholder feature slot |
| `apps/frontend/src/shared/http.ts` | fetch wrapper + `HttpApiError` |
| `apps/frontend/src/shared/http.test.ts` | unit tests |
| `apps/frontend/src/shared/ErrorBoundary.tsx` | class-based boundary |
| `apps/frontend/src/shared/ErrorBoundary.test.tsx` | unit tests |
| `apps/frontend/src/styles/globals.css` | base reset + reduced-motion respect |
| `apps/frontend/README.md` | dev guide |
| `e2e/package.json` | Playwright workspace |
| `e2e/tsconfig.json` | E2E TS config |
| `e2e/playwright.config.ts` | three-browser project, baseURL, retain-on-failure trace |
| `e2e/tests/placeholder.spec.ts` | empty-but-passing spec |
| `e2e/README.md` | E2E run instructions |

### Files to UPDATE

| Path | Change |
|---|---|
| `apps/frontend/package.json` | Replace 1.3 placeholder with real deps + scripts (Task 1) |
| `apps/frontend/Dockerfile` | Builder runs real `vite build` (Task 11) |
| `docker-compose.override.yml` | Frontend command becomes Vite dev server with HMR (Task 12) |
| `tsconfig.json` (root) | Add `apps/frontend` reference (Task 2) |
| `.github/workflows/ci.yml` | E2E job: stub → real Playwright run (Task 16) |

### Files to DELETE

- `apps/frontend/public/index.html` — Story 1.3's placeholder; superseded by `apps/frontend/index.html` (Vite convention). Task 11.

### Architecture Compliance

- **Component layout** [Source: architecture.md *Frontend Architecture*, lines 358–385]: feature-folder under `src/features/<feature>/`, shared modules under `src/shared/`. Story 1.5 establishes both directories with placeholders.
- **Pessimistic UI updates** [Source: architecture.md line 389]: 1.5 doesn't have data fetching yet. Reaffirmed in `useTodos` (Story 1.8 / 2.1+).
- **No state library, no router** [Source: architecture.md lines 360, 392]: Story 1.5 establishes vanilla React; future state lives in `useReducer` per feature.
- **CSS modules + globals.css** [Source: architecture.md *Styling Solution*, lines 176–179]: 1.5 establishes `globals.css`; per-feature CSS-modules arrive with the components themselves (1.8+).
- **`http.ts` contract** [Source: architecture.md lines 663–664]: parses non-2xx into typed `ApiError`; network failures and JSON-parse failures map to `INTERNAL_ERROR`.
- **`ErrorBoundary` purpose** [Source: architecture.md line 612, 666–667]: catches React render errors only — NOT a substitute for `useTodos`'s `error` state. Documented inline.
- **E2E stack** [Source: architecture.md *Testing Framework* line 190]: Playwright + axe. Story 1.5 wires Playwright; axe integration runs in actual specs starting Story 4.2 (accessibility scan).
- **Browser matrix** [Source: prd.md *Browser Support Matrix*, lines 256–266]: Chrome / Firefox / Safari / Edge. Edge is Chromium → covered by Playwright's `chromium` project.

### Previous Story Intelligence (1.1 → 1.5)

- **From 1.1:** ESLint flat config governs `**/*.{ts,tsx,js,jsx,mjs,cjs}`. New `.tsx` files are governed by `tseslint.configs.recommended`. JSX rules need `eslint-plugin-react` if React-idiomatic checks are wanted — out of scope for 1.5; rely on TS-aware rules. Verify lint passes after authoring.
- **From 1.1:** root `tsconfig.json`'s `references` is appended to (now `apps/backend` from 1.4 plus `apps/frontend` from 1.5).
- **From 1.2:** CI's `e2e` job moves from stub `echo` to real Playwright run. The `build` job's `compgen -G` workspace check now finds both `apps/backend` and `apps/frontend` packages and runs their build scripts.
- **From 1.3:** `apps/frontend/package.json` (placeholder), `apps/frontend/public/index.html` (placeholder), `apps/frontend/Dockerfile` (builder stage was a stub) all get replaced. `nginx.conf` (proxy to `backend:3000`) and `apps/frontend/.dockerignore` carry over unchanged.
- **From 1.3:** `docker-compose.override.yml`'s frontend service was a stub. Task 12 fills it with the real Vite dev-mode override.
- **From 1.4:** the backend's real Fastify app exists. Frontend's dev-mode Vite proxy hits `http://backend:3000/api` directly (not via nginx). Production-mode (port 8080 → nginx → backend:3000) is the architectural canonical path; dev-mode is a convenience.
- **From 1.4:** the `ErrorCode` union and envelope shape exist in `apps/backend/src/errors.ts`. Story 1.5's `apps/frontend/src/shared/http.ts` duplicates the type locally. Story 1.6 will deduplicate by moving to `packages/shared/errors.ts`.

### Latest Tech Information

| Package | Expected major (today, 2026-04-28) | Notes |
|---|---|---|
| `react` / `react-dom` | `19.x` | React 19 is current (released 2024-12). `useEffect` semantics and Suspense behaviors stable. |
| `vite` | `6.x` or `7.x` | Vite 6 stable since late 2024; Vite 7 may exist by 2026-04. Latest stable is fine. |
| `@vitejs/plugin-react` | latest tracking Vite major | |
| `vitest` | `3.x` (or `2.x` LTS) | Coverage v8 provider via `@vitest/coverage-v8` |
| `@testing-library/react` | `16.x` | React 19 compatible |
| `@testing-library/jest-dom` | `6.x` | Vitest support: `import '@testing-library/jest-dom/vitest'` |
| `jsdom` | `25.x+` | for Vitest's `environment: 'jsdom'` |
| `@playwright/test` | latest stable | one tool covers test runner + browsers |
| `@axe-core/playwright` | latest stable | accessibility scanning |

**Action:** before commit, run `npm view <pkg> version` for each. Pin to exact versions for runtime deps; carets OK for devDeps.

### Anti-Patterns to Avoid

❌ **Don't put `index.html` under `apps/frontend/public/`.** Vite's convention: `index.html` is at the project root (where `vite.config.ts` lives). `public/` is for static assets copied as-is.
❌ **Don't use Webpack-isms** (`process.env.X` in client code, CommonJS `require`, etc.). Vite's runtime is browser-ESM.
❌ **Don't add a router yet.** Single-screen app per architecture line 392.
❌ **Don't add Redux / Zustand / Jotai / Recoil.** State management is local `useReducer` only (architecture line 650).
❌ **Don't add a UI component library** (MUI, shadcn, Mantine). Plain React + CSS modules per architecture *Styling Solution*.
❌ **Don't ship `pino-pretty` to the browser.** No app-side logging — `console.error` is fine for `<ErrorBoundary>`'s last-resort logging. Backend's pino is server-only.
❌ **Don't wire `axe-core` checks into routine Playwright specs in this story.** AC #8 says `@axe-core/playwright` is *installed* — actual axe-driven assertions land in Story 4.2.
❌ **Don't proxy `/api` in production-mode `vite.config.ts` server block** — that's nginx's job (Story 1.3 `nginx.conf`). The Vite proxy is dev-only.
❌ **Don't run Playwright in CI without `--with-deps`.** `npx playwright install --with-deps` installs system libraries the browsers need. Without it, headless launches fail with cryptic errors on `ubuntu-latest`.
❌ **Don't set `forbidOnly: true` unconditionally.** `forbidOnly: !!process.env.CI` lets devs use `test.only(...)` locally.
❌ **Don't use `<ErrorBoundary>` to catch async errors** (event handlers, promises). React error boundaries only catch errors in render, lifecycle, and constructor. Async errors flow through `useTodos`'s error state when that lands.

### Testing Standards

Per epics.md Story 1.5 *Test Scenarios*:

- **Unit:**
  - `<ErrorBoundary>` catches a thrown error in a child and renders a fallback.
  - `shared/http.ts`: maps a non-2xx response body to a typed `ApiError`; maps a network failure to `ApiError` with `code: 'INTERNAL_ERROR'`.
- **Integration:** none in this story.
- **E2E:** placeholder Playwright spec verifies the page loads and `<title>` is "bmad-todo".

Coverage threshold ≥ 70% (NFR19).

### References

- Story scope and ACs: [Source: epics.md Story 1.5 (lines 352–385)]
- Frontend architecture, component layout: [Source: architecture.md lines 358–396]
- Styling solution, build tooling: [Source: architecture.md lines 176–212]
- `http.ts` / `ErrorBoundary` contracts: [Source: architecture.md lines 612, 663–667]
- Browser matrix: [Source: prd.md *Browser Support Matrix*]
- Coverage threshold (NFR19): [Source: prd.md *Testability & Quality*]
- Workspace + tsc-build registration: [Source: 1-1-...md *Project Structure Notes*]

### Project Knowledge References

No `docs/project-context.md` exists yet.

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7[1m]` via the BMad `bmad-dev-story` skill, executed 2026-04-28.

### Debug Log References

Several adjustments from the story's prescription:

1. **`defineConfig` source must be `vitest/config`, not `vite`.** Story's `vite.config.ts` template imported `defineConfig` from `'vite'`, but `vite@8` + `vitest@4` reject the `test` field at the Vite type level. Fix: import from `'vitest/config'` — it re-exports Vite's `defineConfig` augmented to accept `test`.
2. **Removed `apps/frontend/tsconfig.node.json`** + its reference in `tsconfig.json`. Story prescribed it as a composite project for type-checking `vite.config.ts`, but `composite: true` + `noEmit: true` conflict (TS6310). The simpler approach: vite.config.ts is type-checked via the main project's setup with `@types/node` + `vite/client` types in place — no separate tsconfig needed.
3. **TypeScript `noImplicitOverride` (from `tsconfig.base.json`) requires `override` modifiers** on `state`, `componentDidCatch`, and `render` in `ErrorBoundary.tsx`. Story's template omitted them. Added.
4. **`http.test.ts` network-failure test** rewritten — story's template called `httpRequest` twice with `mockRejectedValueOnce`, so the second call had no mock and threw a TypeError instead of `HttpApiError`. Fix: `mockRejectedValue` (no "Once") + single try/catch.
5. **Vite + Vitest version uplift** — story expected Vite `6.x or 7.x`, Vitest `2.x or 3.x`. Actual current versions are `vite@8.0.10` + `vitest@4.1.5`. APIs identical for our usage.

### Completion Notes List

- **Pinned versions (newer than story's expectations):**
  - `react@19.2.5`, `react-dom@19.2.5`
  - `vite@8.0.10` (story expected `6.x or 7.x`)
  - `@vitejs/plugin-react@6.0.1`
  - `@types/react@19.2.14`, `@types/react-dom@19.2.3`
  - `@testing-library/react@16.3.2`
  - `@testing-library/jest-dom@6.9.1`
  - `jsdom@29.1.0`
  - `vitest@4.1.5`, `@vitest/coverage-v8@4.1.5` (story expected `3.x`)
  - `@playwright/test@1.59.1`
  - `@axe-core/playwright@4.11.2`
- **All 6 frontend tests pass** (4 http + 2 ErrorBoundary). Combined with backend (17 tests), total: **23 unit/integration tests passing**.
- **Story 1.1 verification chain exits 0 from clean clone** (`rm -rf node_modules && npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build`).
- **`apps/frontend/public/index.html` (Story 1.3 placeholder) deleted.** Vite serves `apps/frontend/index.html` from the project root per its convention.
- **`apps/frontend/Dockerfile` updated** to run `tsc --build && vite build` and copy `apps/frontend/dist/` into nginx's `html/`.
- **`docker-compose.override.yml` frontend service** now runs Vite dev server on `:5173` with source-mount.
- **Root `tsconfig.json` `references`** now includes both `apps/backend` and `apps/frontend`. `tsc --build` builds both.
- **`.github/workflows/ci.yml` E2E job upgraded** from echo-stub to real Playwright run: caches browsers, builds Docker stack, runs `docker compose up -d --wait`, runs the suite, uploads HTML report on failure, tears down with `docker compose down -v`.
- **Local Playwright run NOT executed** in this story — would require `npx playwright install` (~500MB browser download) plus a running Docker stack. CI runs it on first PR; the placeholder spec asserts only `<title>bmad-todo</title>` which is satisfied by the index.html landing in this story.
- **No deviations beyond the five listed in Debug Log.** No new dependencies outside the story's approved set.

### File List

**NEW:**

- `apps/frontend/tsconfig.json`
- `apps/frontend/vite.config.ts`
- `apps/frontend/index.html` (Vite root, replacing `public/index.html`)
- `apps/frontend/src/main.tsx`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/test-setup.ts`
- `apps/frontend/src/features/todos/TodoFeature.tsx` (placeholder)
- `apps/frontend/src/shared/http.ts`
- `apps/frontend/src/shared/http.test.ts` (4 tests)
- `apps/frontend/src/shared/ErrorBoundary.tsx`
- `apps/frontend/src/shared/ErrorBoundary.test.tsx` (2 tests)
- `apps/frontend/src/styles/globals.css`
- `apps/frontend/README.md`
- `e2e/package.json`
- `e2e/tsconfig.json`
- `e2e/playwright.config.ts`
- `e2e/tests/placeholder.spec.ts`
- `e2e/README.md`

**MODIFIED:**

- `apps/frontend/package.json` — replaced placeholder with real React + Vite + Vitest deps and scripts.
- `apps/frontend/Dockerfile` — builder runs `npm ci` + `tsc --build && vite build`; runtime serves `dist/` via nginx.
- `docker-compose.override.yml` — frontend service runs Vite dev server `:5173` with source-mount + anonymous volume for node_modules.
- `tsconfig.json` (root) — added `{ "path": "./apps/frontend" }` to references.
- `.github/workflows/ci.yml` — E2E job: stub → real Playwright run with browser caching, Docker bring-up, report upload on failure, volume cleanup.

**DELETED:**

- `apps/frontend/public/index.html` (Story 1.3 placeholder; Vite root convention is project-level `index.html`).
- `apps/frontend/tsconfig.node.json` (story-prescribed but caused TS6310 — see Debug Log #2).

## Change Log

| Date | Story | Change | Author |
|---|---|---|---|
| 2026-04-28 | 1.5 | Frontend skeleton: Vite 8 + React 19 + Vitest 4 + jsdom; `<App>` mounts `<TodoFeature>` placeholder inside `<ErrorBoundary>`; `shared/http.ts` with typed `HttpApiError`. New `e2e/` workspace with Playwright config (chromium/firefox/webkit) + placeholder spec asserting `<title>`. CI E2E job upgraded from stub to real Playwright run with Docker stack bring-up + report upload. 23 tests passing across backend (17) + frontend (6). | Aman (via `bmad-dev-story` / `claude-opus-4-7[1m]`) |
