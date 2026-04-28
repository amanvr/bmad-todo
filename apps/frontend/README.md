# Frontend (`@bmad-todo/frontend`)

Vite + React + TypeScript SPA for the bmad-todo app. CSS modules, no UI library, no state-management library beyond `useReducer`.

## Local development

Two modes — dev (Vite HMR) and production-like (nginx-served build).

### Dev mode (recommended for iteration)

```bash
docker compose up --wait
# Vite dev server runs at http://localhost:5173 (mapped via docker-compose.override.yml)
# Note: the frontend container runs Vite directly; nginx is bypassed in dev
```

In dev mode, Vite's built-in proxy (`vite.config.ts`) forwards `/api/*` to `http://backend:3000`.

### Production-like mode (nginx-served build)

```bash
docker compose -f docker-compose.yml up --wait
# Frontend built via vite build, served by nginx at http://localhost:8080
# nginx proxies /api/* to the backend container
```

## Testing

```bash
# Unit + component tests (Vitest + Testing Library + jsdom)
npm run test --workspace @bmad-todo/frontend

# Coverage (≥70% required per NFR19)
npm run test:coverage --workspace @bmad-todo/frontend
```

E2E tests live in the separate `e2e/` workspace package — see `e2e/README.md`.

## Architecture

- `src/main.tsx` — entry; mounts `<App>` inside `<ErrorBoundary>`.
- `src/App.tsx` — top-level layout; renders `<TodoFeature />`.
- `src/features/todos/` — feature folder; per-feature components, hook, api, reducer co-located. (Story 1.5 ships the placeholder; Story 1.8 fills it in.)
- `src/shared/` — cross-feature primitives: `http.ts` (fetch wrapper + `HttpApiError`), `ErrorBoundary.tsx`.
- `src/styles/globals.css` — base reset + reduced-motion respect.

For the architectural canon: see `_bmad-output/planning-artifacts/architecture.md` _Frontend Architecture_ section.

## Component conventions

- **Feature folder layout**: components, hooks, api wrapper, reducer all live under `src/features/<feature>/`.
- **CSS modules**: `*.module.css` co-located with components. No design system. No styled-components / emotion / Tailwind.
- **Hook contract**: `useTodos` returns `{ state, actions }`. Components consume the hook; only `useTodos` calls `api.ts`; only `api.ts` calls `httpRequest`.
- **State management**: per-feature `useReducer`. No global store. No Redux / Zustand / Jotai.
- **Pessimistic UI updates**: wait for server confirmation before reflecting in UI. Architecture line 389.

## Troubleshooting

- **HMR not firing on file save** (Windows hosts): Docker Desktop's WSL2 backend is required; bind-mount semantics on Windows can drop events. Try `vite --force` to confirm a clean reload.
- **`fetch` failures in tests**: tests use `vi.stubGlobal('fetch', vi.fn())`. Forgetting `vi.unstubAllGlobals()` in `afterEach` bleeds mocks across tests.
- **`role="alert"` elements not announced by screen reader**: confirmed accessibility working depends on the screen reader's polite/assertive policy. Manual VoiceOver / NVDA checks land in Story 4.2.
