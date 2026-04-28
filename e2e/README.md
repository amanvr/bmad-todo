# E2E (`@bmad-todo/e2e`)

End-to-end tests covering the five named NFR20 flows, accessibility scan, responsive checks, and keyboard-only operation.

## Prerequisites

1. Stack must be running: `docker compose up --wait` from repo root.
2. Playwright browsers installed: `npm run test:install --workspace @bmad-todo/e2e` (one-time, downloads ~500MB across chromium/firefox/webkit).

## Running

```bash
# All specs across all projects (chromium, firefox, webkit, mobile-portrait)
npm test --workspace @bmad-todo/e2e

# Headed (see the browser) — useful for debugging
npm run test:headed --workspace @bmad-todo/e2e

# Single spec, single browser
npm test --workspace @bmad-todo/e2e -- tests/create-todo.spec.ts --project=chromium
```

HTML report lands at `e2e/playwright-report/`. Open in a browser to inspect failures.

## Specs

| Spec                      | NFR20 flow           | Story |
| ------------------------- | -------------------- | ----- |
| `create-todo.spec.ts`     | flow #1 — create     | 1.8   |
| `list-todos.spec.ts`      | flow #2 — list       | 3.3   |
| `complete-todo.spec.ts`   | flow #3 — complete   | 2.1   |
| `incomplete-todo.spec.ts` | flow #4 — incomplete | 2.1   |
| `delete-todo.spec.ts`     | flow #5 — delete     | 2.2   |
| `accessibility.spec.ts`   | (axe scan, Level A)  | 4.2   |
| `responsive.spec.ts`      | (4 viewports)        | 4.1   |
| `keyboard.spec.ts`        | (keyboard-only flow) | 4.2   |
| `error-recovery.spec.ts`  | (error path)         | 3.2   |

## Adding a new spec

Use this template:

```ts
import { test, expect } from '@playwright/test';

test('description of behavior', async ({ page }) => {
  await page.goto('/');
  // ... assertions
});
```

Use unique-per-run identifiers to avoid cross-spec data pollution: e.g. `const description = \`Task \${Date.now()}\`;`.

## CI

CI's `e2e` job runs the full stack via docker compose, executes Playwright, archives the HTML report on failure. See `.github/workflows/ci.yml`.

## Manual durability verification (FR13)

The Playwright `list-todos` spec verifies persistence across browser reloads. It does _not_ automate
`docker compose down && docker compose up` because killing and restarting containers mid-Playwright
run is fragile (network races, port-conflict windows, healthcheck cycles).

Run this manual procedure once per release candidate (and any time `docker-compose.yml` or the
Postgres volume config changes):

1. `docker compose down -v` (the `-v` wipes the volume - start clean).
2. `docker compose up --wait` (full healthy bring-up).
3. Open `http://localhost:8080`. Add three todos: "Buy milk", "Walk dog", "Read book".
4. Verify all three are visible in the list.
5. `docker compose down` (no `-v` so the volume is kept).
6. `docker compose up --wait`.
7. Reload `http://localhost:8080`.
8. **Expected:** all three todos are still visible in the same order.

If any todo is missing or order has changed, FR13 is violated. Likely causes:

- `docker-compose.yml` `volumes:` definition for `postgres` was changed or removed.
- A migration or init script accidentally truncated data.
- Postgres data directory permissions issue (especially on Windows hosts).
