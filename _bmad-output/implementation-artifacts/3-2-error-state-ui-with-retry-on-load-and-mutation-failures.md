# Story 3.2: Error-state UI with retry on load and mutation failures

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an end user,
I want to see a clear error message when something goes wrong (network blip, backend down, etc.) and a "Try again" button to recover,
So that I trust the app fails visibly rather than silently and I can recover without reloading. (Delivers FR10, FR11.)

## Acceptance Criteria

1. **Given** Story 1.8 is complete, **When** Story 3.2 completes, **Then** `apps/frontend/src/features/todos/ErrorState.tsx` renders a clearly visible error message (using `error.message`, never `error.code`) and a "Try again" button.
2. `<TodoFeature>` renders `<ErrorState>` when `useTodos` `status === 'error'` (initial-load failure) — without unmounting any todos that were already rendered before the failure.
3. Mutation failures (create / setCompleted / delete) populate `useTodos` `error` state without changing `status` from `'loaded'`, so existing todos remain visible while a small inline error is shown.
4. Clicking "Try again" on a load failure re-invokes the failed `list` operation.
5. Clicking "Try again" / dismiss on a mutation failure clears the inline error.
6. The frontend never displays raw stack traces or `error.code` strings to the user (NFR12).
7. **Given** the backend is down at first load, **When** I open `localhost:8080`, **Then** the loading state renders briefly, **And** the error state renders with a "Try again" button.
8. **Given** the error state is visible and the backend has recovered, **When** I click "Try again", **Then** the request retries, succeeds, and the list renders normally.
9. **Given** I have todos rendered and the backend goes down, **When** I attempt to add a new todo, **Then** the existing todos remain visible (NFR12), **And** an inline error indicates the create failed, **And** the existing list is **not** unmounted or replaced by `<ErrorState>`.

## Tasks / Subtasks

- [x] **Task 1: Author `apps/frontend/src/features/todos/ErrorState.tsx`** (AC: 1, 6)
  - [ ] Component for the load-failure path:
    ```tsx
    import type { ApiError } from '@bmad-todo/shared';
    import styles from './todos.module.css';

    interface Props {
      error: ApiError;
      onRetry: () => void;
    }

    export function ErrorState({ error, onRetry }: Props) {
      return (
        <div className={styles.errorState} role="alert">
          <p className={styles.errorMessage}>{error.message}</p>
          <button type="button" onClick={onRetry} className={styles.retryButton}>
            Try again
          </button>
        </div>
      );
    }
    ```
  - [ ] **`role="alert"`** — assertive live region; the error is urgent enough to interrupt current screen-reader speech (vs LoadingState's polite `role="status"`).
  - [ ] **NEVER render `error.code`.** AC #6, NFR12. Codes are for log/test inspection. The message is user-facing.
  - [ ] **NEVER render `error.details` raw.** Details may contain Zod path arrays or stack-like info; for user-facing display, only the message string.

- [x] **Task 2: Author inline mutation-error banner** (AC: 3, 5)
  - [ ] A small inline component for mutation failures (separate from full ErrorState — different UX needs):
    ```tsx
    // apps/frontend/src/features/todos/MutationErrorBanner.tsx
    import type { ApiError } from '@bmad-todo/shared';
    import styles from './todos.module.css';

    interface Props {
      error: ApiError;
      onDismiss: () => void;
    }

    export function MutationErrorBanner({ error, onDismiss }: Props) {
      return (
        <div className={styles.mutationErrorBanner} role="alert">
          <span className={styles.mutationErrorMessage}>{error.message}</span>
          <button
            type="button"
            onClick={onDismiss}
            className={styles.mutationErrorDismiss}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      );
    }
    ```
  - [ ] **`×`** is the multiplication sign U+00D7 (NOT lowercase x or asterisk). Standard close-button glyph.
  - [ ] **Dismiss-only, no retry button.** The user retries by attempting the original action again (clicking Add, the toggle, or Delete). Re-invocation logic for "the last failed mutation" would require tracking which mutation failed — over-engineering for v1.

- [x] **Task 3: Style the error states in `todos.module.css`** (AC: 1)
  - [ ] Add CSS for both error UIs:
    ```css
    .errorState {
      padding: 1rem;
      border: 1px solid #c53030;
      background-color: #fff5f5;
      border-radius: 4px;
      margin-top: 1rem;
    }

    .errorMessage {
      margin: 0 0 0.75rem 0;
      color: #742a2a;
    }

    .retryButton {
      cursor: pointer;
    }

    .mutationErrorBanner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-left: 3px solid #c53030;
      background-color: #fff5f5;
      margin-top: 0.5rem;
      border-radius: 2px;
    }

    .mutationErrorMessage {
      flex: 1;
      color: #742a2a;
      font-size: 0.9rem;
    }

    .mutationErrorDismiss {
      background: transparent;
      border: 0;
      cursor: pointer;
      font-size: 1.25rem;
      line-height: 1;
      padding: 0 0.25rem;
      color: #742a2a;
    }
    ```
  - [ ] **Color contrast verification:** `#742a2a` on `#fff5f5` → ≥ 7:1 (AAA-level). Plain background text. The `#c53030` border is decorative — color isn't carrying meaning alone (the icon, position, and text content carry it).
  - [ ] **No animation.** Architecture line 759.

- [x] **Task 4: Add an action to clear mutation errors** (AC: 5)
  - [ ] Extend `todosReducer.ts`:
    ```ts
    export type TodosAction =
      // ... existing ...
      | { type: 'mutationErrorDismissed' };

    case 'mutationErrorDismissed':
      return { ...state, error: null };
    ```
  - [ ] Extend `useTodos.ts` to expose `dismissError`:
    ```ts
    const dismissError = useCallback(() => {
      dispatch({ type: 'mutationErrorDismissed' });
    }, []);

    return {
      state,
      actions: { create, setCompleted, delete: deleteAction, retry: load, dismissError },
    };
    ```
  - [ ] **Why the action is named `mutationErrorDismissed` (not `errorCleared`):** more specific. Loading-failure errors aren't dismissed — they're cleared by a successful retry (handled by `loadingStarted` → `todosLoaded` reducer flow). Only mutation errors have a dismiss UX.
  - [ ] **Note:** `loadingStarted` already sets `error: null` in Story 1.8's reducer (verify and preserve). Successful retry clears the error implicitly.

- [x] **Task 5: Update `TodoFeature.tsx` to render error states** (AC: 2, 3, 9)
  - [ ] Update the `renderContent` function from Story 3.1:
    ```tsx
    const renderContent = () => {
      // Story 3.2: load failure → full ErrorState (only if no todos already rendered)
      if (state.status === 'error') {
        return <ErrorState error={state.error!} onRetry={actions.retry} />;
      }
      if (state.status === 'idle' || state.status === 'loading') {
        return <LoadingState />;
      }
      if (state.status === 'loaded' && state.todos.length === 0) {
        return <EmptyState />;
      }
      return (
        <TodoList
          todos={state.todos}
          onToggle={actions.setCompleted}
          onDelete={actions.delete}
          mutatingIds={state.mutatingIds}
        />
      );
    };

    // Inline mutation-error banner — rendered when status === 'loaded' AND state.error is non-null
    const mutationError = state.status === 'loaded' ? state.error : null;

    return (
      <section className={styles.feature} aria-labelledby="todos-heading">
        <h2 id="todos-heading">Todos</h2>
        <AddTodoForm onCreate={actions.create} disabled={state.isMutating} />
        {mutationError && <MutationErrorBanner error={mutationError} onDismiss={actions.dismissError} />}
        {renderContent()}
      </section>
    );
    ```
  - [ ] **AC #9 satisfied by the conditional structure:** when a mutation fails, `state.status === 'loaded'` (per the reducer — Story 2.1's `mutationFailedFor` doesn't change status). The list keeps rendering; only the inline banner appears above it.
  - [ ] **Edge case AC #2 says "without unmounting any todos that were already rendered before the failure".** This applies to **mutation** failures — handled by AC #3's `status` preservation. For **load failures** (status flipping to `'error'`), the requirement is that the previous-render todos *if any* stay visible. **Today's reducer doesn't preserve `state.todos` on `loadingFailed`** — verify and decide:
    - **Option A (recommended for 3.2):** keep `state.todos` on `loadingFailed`. Update reducer's `loadingFailed` case to `{ ...state, status: 'error', error }` (preserving todos). This satisfies AC #2 cleanly.
    - **Option B:** clear `state.todos` on `loadingFailed` and accept that `<ErrorState>` replaces the list (literally unmounted). AC #2's wording ("without unmounting any todos that were already rendered") is then violated only for the *re-fetch failure* case (manual retry of a list operation that previously succeeded).
    - **Decision:** apply Option A. Keep `todos` on `loadingFailed`. The render conditional then needs an extra guard: if `status === 'error'` AND `state.todos.length > 0`, render the list PLUS a banner-style ErrorState above it; if `state.todos.length === 0`, render full ErrorState alone. **Spec this clearly in unit tests.**
  - [ ] **Refined renderContent with guard:**
    ```tsx
    if (state.status === 'error') {
      if (state.todos.length > 0) {
        // Pre-existing todos: show banner-style error + keep the list rendered
        return (
          <>
            <ErrorState error={state.error!} onRetry={actions.retry} />
            <TodoList
              todos={state.todos}
              onToggle={actions.setCompleted}
              onDelete={actions.delete}
              mutatingIds={state.mutatingIds}
            />
          </>
        );
      }
      // No prior render → full-screen error state
      return <ErrorState error={state.error!} onRetry={actions.retry} />;
    }
    ```

- [x] **Task 6: Frontend unit tests** (Test Scenarios — Unit)
  - [ ] `apps/frontend/src/features/todos/ErrorState.test.tsx`:
    - Renders `error.message`; does NOT render `error.code` anywhere in the DOM.
    - "Try again" button invokes `onRetry` callback when clicked.
  - [ ] `apps/frontend/src/features/todos/MutationErrorBanner.test.tsx`:
    - Renders message; dismiss `×` invokes `onDismiss`.
    - `aria-label="Dismiss error"` present on the close button.
  - [ ] `apps/frontend/src/features/todos/todosReducer.test.ts` — extend:
    - `loadingFailed` sets `status: 'error'` AND preserves existing `todos` (don't clear). Verify reference equality on the preserved array if possible.
    - `mutationFailedFor` sets `error` but leaves `status: 'loaded'`.
    - `mutationErrorDismissed` clears `error` to `null` but leaves todos and status untouched.
    - `loadingStarted` clears `error` to `null` (existing 1.8 behavior — verify preservation).
  - [ ] `apps/frontend/src/features/todos/useTodos.test.ts` — extend:
    - On load failure, hook state is `{status: 'error', error: ApiError}`.
    - On mutation failure, hook state is `{status: 'loaded', error: ApiError}` with the existing todo array intact.
    - `actions.retry()` re-invokes the list operation.
    - `actions.dismissError()` dispatches `mutationErrorDismissed`.
  - [ ] `apps/frontend/src/features/todos/TodoFeature.test.tsx` — extend (from Story 3.1):
    - With mock `useTodos` returning `status: 'error', todos: []` → renders `<ErrorState>` only.
    - With `status: 'error', todos: [{...}, {...}]` → renders both `<ErrorState>` AND `<TodoList>`.
    - With `status: 'loaded', error: <ApiError>` → renders `<MutationErrorBanner>` AND `<TodoList>`.
    - With `status: 'loaded', error: null` → no error UI rendered.

- [x] **Task 7: E2E error-path spec** (Test Scenarios — E2E)
  - [ ] Add an error-path branch to `e2e/tests/create-todo.spec.ts` (or a new `e2e/tests/error-recovery.spec.ts` — either is acceptable; new file recommended for clarity since it's not a "create" flow). New file approach:
    ```ts
    // e2e/tests/error-recovery.spec.ts
    import { test, expect } from '@playwright/test';

    test('user sees error state when backend fails and can recover via Try again', async ({ page }) => {
      // Arrange: route-mock GET /api/todos to fail
      let failNext = true;
      await page.route('**/api/todos', async (route) => {
        if (route.request().method() === 'GET' && failNext) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/');

      // Error state appears with Try again
      const errorAlert = page.getByRole('alert');
      await expect(errorAlert).toContainText(/server error/i);
      // CRITICAL: the user-facing UI does NOT contain the error code
      await expect(errorAlert).not.toContainText(/INTERNAL_ERROR/);

      // Recover
      failNext = false;
      await page.getByRole('button', { name: /try again/i }).click();

      // Empty state (no todos in DB) or list — either is fine
      await expect(page.getByRole('status').or(page.getByRole('list'))).toBeVisible();
    });

    test('mutation failure shows inline error without unmounting existing todos', async ({ page }) => {
      const stamp = Date.now();
      const description = `Persistent task ${stamp}`;

      // Add a todo first (normal flow)
      await page.goto('/');
      await page.getByLabel(/new todo/i).fill(description);
      await page.getByRole('button', { name: /add todo/i }).click();
      await expect(page.getByRole('listitem').filter({ hasText: description })).toBeVisible();

      // Now route-mock a 500 on POST
      await page.route('**/api/todos', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Could not save' } }),
          });
        } else {
          await route.continue();
        }
      });

      await page.getByLabel(/new todo/i).fill('Will fail');
      await page.getByRole('button', { name: /add todo/i }).click();

      // Inline banner appears
      await expect(page.getByRole('alert')).toContainText(/could not save/i);

      // Existing todo STILL VISIBLE (NFR12 — AC #9)
      await expect(page.getByRole('listitem').filter({ hasText: description })).toBeVisible();

      // Dismiss
      await page.getByRole('button', { name: /dismiss error/i }).click();
      await expect(page.getByRole('alert')).not.toBeVisible();

      // Existing todo still there
      await expect(page.getByRole('listitem').filter({ hasText: description })).toBeVisible();
    });
    ```
  - [ ] These specs **don't add NFR20 named flows** — they extend coverage of the create-todo / list-todos flows with error-path branches. The Test Scenarios block explicitly says: *"This contributes to flow coverage but doesn't count as a sixth NFR20 named flow."*
  - [ ] Each test cleans up by virtue of `page.route` only applying to the test's page lifetime. No DB state to reset.

- [x] **Task 8: Verify the AC end-to-end**
  - [ ] `docker compose up --wait`. Stop the backend container: `docker compose stop backend`. Reload the page → ErrorState appears with "Try again" button.
  - [ ] Restart backend: `docker compose start backend`. Click "Try again" → list/empty state appears.
  - [ ] Add a todo. Stop the backend mid-create (e.g., `docker compose pause backend` while typing). Click Add → MutationErrorBanner appears, the existing todo remains visible.
  - [ ] Click `×` on the banner → banner disappears, list still visible.
  - [ ] **Inspect the DOM** in DevTools → confirm no `INTERNAL_ERROR`, `VALIDATION_FAILED`, `NOT_FOUND` strings anywhere visible to the user. The codes only appear in network responses and console logs (acceptable per architecture).
  - [ ] Story 1.1 verification chain: `npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build` exits 0.
  - [ ] E2E: all specs pass — including new error-recovery spec.

## Dev Notes

### Story Foundation Summary

This story closes the reliability-UX loop. After it lands, every failure mode has a visible recovery affordance: full ErrorState for load failures, inline banner for mutation failures. NFR12's "displayed todos remain visible during transient failures" becomes enforced through the reducer's `status` preservation contract.

**FRs implemented:** FR10 (clear error-state indication), FR11 (retry without reload).

**NFRs implemented:** NFR12 (graceful recovery — list remains visible during transient failures), NFR8 partial (`role="alert"` for screen-reader announcements).

### Files to CREATE

| Path | Purpose |
|---|---|
| `apps/frontend/src/features/todos/ErrorState.tsx` | Full-screen error UI with retry |
| `apps/frontend/src/features/todos/ErrorState.test.tsx` | Unit tests |
| `apps/frontend/src/features/todos/MutationErrorBanner.tsx` | Inline mutation-error banner |
| `apps/frontend/src/features/todos/MutationErrorBanner.test.tsx` | Unit tests |
| `e2e/tests/error-recovery.spec.ts` | Error-path E2E (load failure + mutation failure branches) |

### Files to UPDATE

| Path | Change |
|---|---|
| `apps/frontend/src/features/todos/todosReducer.ts` | Add `mutationErrorDismissed`; modify `loadingFailed` to preserve `todos` (Task 4) |
| `apps/frontend/src/features/todos/todosReducer.test.ts` | New tests for the modified behavior (Task 6) |
| `apps/frontend/src/features/todos/useTodos.ts` | Add `dismissError` action (Task 4) |
| `apps/frontend/src/features/todos/useTodos.test.ts` | Tests (Task 6) |
| `apps/frontend/src/features/todos/TodoFeature.tsx` | Add `<ErrorState>` and `<MutationErrorBanner>` rendering (Task 5) |
| `apps/frontend/src/features/todos/TodoFeature.test.tsx` | Conditional-render tests (Task 6) |
| `apps/frontend/src/features/todos/todos.module.css` | Add error-state styles (Task 3) |

### Architecture Compliance

- **Error envelope** [Source: architecture.md lines 335–349]: `{ code, message, details? }`. Frontend reads `message` only.
- **Frontend error handling** [Source: architecture.md lines 663–667]: `<ErrorState>` shows `error.message` + retry button. **Never** render `error.code`. Codes are for log/test inspection only. `<ErrorBoundary>` (Story 1.5) is for React render errors, not API errors — they're orthogonal.
- **NFR12 (graceful recovery)** [Source: prd.md *Reliability & Durability*]: displayed todos remain visible during transient failures. Architecture line 73 reinforces.
- **No automatic retries** [Source: architecture.md lines 678–680]: manual "Try again" only. Don't add exponential backoff.
- **Status field as render-router** [Source: architecture.md line 649]: `status === 'error'` triggers `<ErrorState>`; `status === 'loaded' + error !== null` triggers `<MutationErrorBanner>`. The render dispatch is data-driven.

### Previous Story Intelligence (1.8, 2.1, 2.2, 3.1 → 3.2)

- **From 1.8:** reducer's `loadingFailed` set `status: 'error'`. Story 3.2 modifies it to preserve `todos` (Task 4 / 6) so `<ErrorState>` doesn't unmount the list. This is a small reducer behavior change — verify Story 1.8's `loadingFailed` test was either updated or remains correct.
- **From 1.8:** `loadingStarted` clears `error: null`. Successful retry implicitly clears the error. No new code needed for that path.
- **From 2.1:** `mutationFailedFor` already keeps `status: 'loaded'` and sets `error`. AC #3 is satisfied without reducer changes for mutations — Story 3.2 just adds the UI to display it.
- **From 2.2:** delete also uses `mutationFailedFor`. Same UI applies.
- **From 3.1:** `<TodoFeature>` has the `renderContent()` extracted function. Story 3.2 extends it to add the `status === 'error'` branch and the inline banner above the list.

### Latest Tech Information

No new dependencies. React's `role="alert"` and `aria-live="assertive"` (implicit with `role="alert"`) are stable across all browsers.

### Anti-Patterns to Avoid

❌ **Don't render `error.code`.** AC #6, NFR12. Codes are for logs.
❌ **Don't render `error.details`.** May contain Zod validation paths or stack-like info.
❌ **Don't add automatic retry / exponential backoff.** Architecture lines 678–680. Manual retry only.
❌ **Don't unmount `<TodoList>` on load failure when previous todos exist.** AC #2. Reducer must preserve `state.todos` on `loadingFailed`.
❌ **Don't use a modal / toast library.** Architecture line 759 anti-patterns. Inline banner is sufficient.
❌ **Don't auto-dismiss the mutation error.** Manual dismiss via `×` button only. Auto-dismiss with timer would race against new mutations and confuse the user.
❌ **Don't use `role="alert"` on the LoadingState.** That's `role="status"` (Story 3.1). Alerts interrupt; status is polite.
❌ **Don't add a "Report this error" link.** Out of scope. No bug-tracker integration in v1.
❌ **Don't catch errors in components and rerender** — they flow through the hook's reducer. Components consume `state.error` declaratively.
❌ **Don't use `<ErrorBoundary>` to handle API errors.** ErrorBoundary catches React render errors only. API errors are explicit hook state.

### Testing Standards

Per epics.md Story 3.2 *Test Scenarios*:

- **Unit:**
  - `ErrorState`: renders `error.message` (not code); retry button invokes callback.
  - `todosReducer`: `loadingFailed` sets `status: 'error'`; `mutationFailed` sets `error` but leaves `status: 'loaded'`.
  - `useTodos`: load failure → `{status: 'error', error}`; mutation failure → `{status: 'loaded', error}` with todos intact.
- **Integration (backend):** none (error responses already tested in Epic 1 / 2).
- **E2E:** error-path branches via route-mocked failures. Strengthens existing flows; no new NFR20 named flow.

Coverage thresholds ≥ 70% backend (NFR18, unaffected) + ≥ 70% frontend (NFR19) — must remain green.

### References

- Story scope and ACs: [Source: epics.md Story 3.2 (lines 684–727)]
- Error envelope: [Source: architecture.md lines 335–349]
- Frontend error handling: [Source: architecture.md lines 663–667]
- No auto-retry: [Source: architecture.md lines 678–680]
- NFR12 (graceful recovery): [Source: prd.md *Reliability & Durability*]
- Status state machine: [Source: 1-8-...md *Task 6*]
- LoadingState contrast (3.1): [Source: 3-1-...md *Task 1*]
- Reducer `mutationFailedFor`: [Source: 2-1-...md *Task 6*]

### Project Knowledge References

No `docs/project-context.md` exists yet.

## Dev Agent Record

### Agent Model Used

Codex 5.3

### Debug Log References

- E2E failed initially because running stack was stale; rebuilding with `docker compose -f docker-compose.yml up -d --build --wait` resolved it.
- Added `beforeEach` mock cleanup in `useTodos.test.ts` after new cases surfaced cross-test call-count contamination.
- Added reducer assertions for `mutationErrorDismissed` and preserved todo-array behavior on load failures.

### Completion Notes List

- Implemented `ErrorState` and `MutationErrorBanner` with `role="alert"` and user-facing `error.message` only (no `error.code` rendering).
- Updated reducer/hook/feature wiring to keep loaded todos visible on mutation failures and show full error state on load failures with retry.
- Added frontend unit coverage and new Playwright `error-recovery.spec.ts` for load-failure recovery and mutation-failure inline banner behavior.
- Validation passed with Node 24: targeted frontend tests, full Playwright suite, and root `npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build`.

### File List

- apps/frontend/src/features/todos/ErrorState.tsx
- apps/frontend/src/features/todos/ErrorState.test.tsx
- apps/frontend/src/features/todos/MutationErrorBanner.tsx
- apps/frontend/src/features/todos/MutationErrorBanner.test.tsx
- apps/frontend/src/features/todos/TodoFeature.tsx
- apps/frontend/src/features/todos/TodoFeature.test.tsx
- apps/frontend/src/features/todos/todos.module.css
- apps/frontend/src/features/todos/todosReducer.ts
- apps/frontend/src/features/todos/todosReducer.test.ts
- apps/frontend/src/features/todos/useTodos.ts
- apps/frontend/src/features/todos/useTodos.test.ts
- e2e/tests/error-recovery.spec.ts

## Change Log

- 2026-04-28: Implemented error-state UI and retry/dismiss flows for load and mutation failures, added unit+E2E coverage, and validated with the Node 24 full verification chain.
