# Story 2.1: Toggle todo completion (mark complete and un-complete)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an end user,
I want to mark a todo complete by clicking on it, and un-complete it if I change my mind,
So that I can track which tasks I've finished and reverse a mistake without re-creating the todo. (Delivers FR3, FR4.)

## Acceptance Criteria

1. **Given** Story 1.8 is complete, **When** Story 2.1 completes, **Then** `apps/backend/src/services/todoService.ts` adds `setCompletion(id, completed, userId)`.
2. `apps/backend/src/controllers/todoController.ts` registers `PATCH /api/todos/:id` validated against `UpdateTodoCompletionInputSchema` from `packages/shared`.
3. `PATCH /api/todos/:id` returns 200 with the updated Todo on success; 400 `code: 'VALIDATION_FAILED'` on invalid body; 404 `code: 'NOT_FOUND'` on missing id.
4. The backend updates `updated_at` on each toggle (audit-log non-foreclosure seam).
5. `apps/frontend/src/features/todos/TodoItem.tsx` renders a checkbox-shaped control bound to `completed`.
6. Clicking the toggle calls `useTodos.actions.setCompleted(id, completed)` which calls the API and only updates UI after server confirmation (pessimistic).
7. `useTodos.ts` exposes `isMutating` (boolean per-item or global) and the toggle control is disabled while mutation is in flight.
8. **Given** an active todo, **When** I click its toggle, **Then** the backend persists `completed = true`, returns the updated Todo, and the UI re-renders with the toggle in the "complete" state.
9. **Given** a completed todo, **When** I click its toggle, **Then** the backend persists `completed = false` and the UI re-renders with the toggle in the "active" state.
10. **Given** a todo whose id no longer exists, **When** I click its toggle, **Then** the backend returns 404 with `code: 'NOT_FOUND'` and the frontend dispatches `mutationFailed` (full error-state UX in Epic 3; this story just ensures the failure doesn't crash the app).

## Tasks / Subtasks

- [x] **Task 1: Extend `apps/backend/src/services/todoService.ts`** (AC: 1)
  - [x] Add `setCompletion(id, completed, userId)` — thin pass-through to the repository, propagates `NotFoundError`:
    ```ts
    async setCompletion(id: string, completed: boolean, userId: string): Promise<Todo> {
      return this.repo.setCompleted(id, completed, userId);
    }
    ```
  - [x] **Note name asymmetry:** the AC says service method is `setCompletion` (with "ion"), repository method is `setCompleted` (Story 1.7). This is the AC's literal wording. Either rename one for symmetry (recommended: keep both as `setCompleted` since the service just delegates) **or** keep the AC asymmetry. The dev agent should call out their choice in completion notes; if renaming, also update the AC for consistency. **Recommendation:** rename service method to `setCompleted` for symmetry; flag the AC text as imprecise.

- [x] **Task 2: Extend `apps/backend/src/controllers/todoController.ts` with PATCH route** (AC: 2, 3)
  - [x] Add the route inside `buildTodoController(service)`:
    ```ts
    fastify.withTypeProvider<ZodTypeProvider>().route({
      method: 'PATCH',
      url: '/api/todos/:id',
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: UpdateTodoCompletionInputSchema,
        response: { 200: TodoSchema },
      },
      handler: async (request) => {
        return service.setCompletion(request.params.id, request.body.completed, request.userId);
      },
    });
    ```
  - [x] The path-params Zod (`z.string().uuid()`) catches malformed ids before reaching the service — returns 400 `VALIDATION_FAILED` automatically via Story 1.4's errorHandler.
  - [x] `NotFoundError` thrown by the repository (Story 1.7) propagates through the service to the errorHandler, which maps it to 404 `NOT_FOUND`. AC #3 satisfied without per-route handling.

- [x] **Task 3: Backend integration tests** (Test Scenarios — Integration)
  - [x] `apps/backend/tests/integration/todoRoutes.test.ts` — extend the file from Story 1.8:
    - `PATCH /api/todos/:id` with `{completed: true}` against an existing row → 200, response matches `TodoSchema`, `updatedAt > createdAt`.
    - Toggle back: `PATCH` with `{completed: false}` → 200, persists.
    - Non-existent id (well-formed UUID, no row) → 404 with `code: 'NOT_FOUND'`.
    - Malformed id (not a UUID) → 400 with `code: 'VALIDATION_FAILED'`.
    - Body `{}` (missing `completed`) → 400 with `code: 'VALIDATION_FAILED'`.
    - Body `{completed: 'yes'}` (wrong type) → 400.
  - [x] **`updatedAt` timing assertion:** between create and PATCH, sleep ~10ms to ensure the timestamps differ at sub-second resolution; OR use `expect(new Date(updated)).toBeGreaterThan(new Date(created))` and rely on Postgres `now()` being precise enough.

- [x] **Task 4: Backend service unit test** (Test Scenarios — Unit)
  - [x] `apps/backend/src/services/todoService.test.ts` — extend from Story 1.8:
    - `setCompletion()` calls `repository.setCompleted` with the exact args.
    - When repo throws `NotFoundError`, the service rethrows it (doesn't swallow).

- [x] **Task 5: Extend frontend api at `apps/frontend/src/features/todos/api.ts`** (AC: 6)
  - [x] Add `setCompleted(id, completed)`:
    ```ts
    setCompleted: async (id: string, completed: boolean): Promise<Todo> => {
      const validated = UpdateTodoCompletionInputSchema.parse({ completed });
      const data = await httpRequest<unknown>(`/api/todos/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validated),
      });
      return TodoSchema.parse(data);
    },
    ```
  - [x] **`encodeURIComponent`** the `id` defensively. UUIDs don't contain reserved chars, but the wrapper is generic; no harm.

- [x] **Task 6: Extend `todosReducer.ts`** (AC: 6, 7)
  - [x] Add a new action and per-item mutation tracking:
    ```ts
    export type TodosState = {
      todos: Todo[];
      status: 'idle' | 'loading' | 'loaded' | 'error';
      error: ApiError | null;
      isMutating: boolean;
      mutatingIds: ReadonlySet<string>;  // per-item; isMutating is the global "any" flag
    };

    export type TodosAction =
      // ... existing actions from Story 1.8 ...
      | { type: 'mutationStartedFor'; id: string }
      | { type: 'todoCompletionToggled'; todo: Todo }
      | { type: 'mutationFailedFor'; id: string; error: ApiError };
    ```
  - [x] Reducer cases:
    ```ts
    case 'mutationStartedFor': {
      const next = new Set(state.mutatingIds);
      next.add(action.id);
      return { ...state, isMutating: true, mutatingIds: next };
    }
    case 'todoCompletionToggled': {
      const next = new Set(state.mutatingIds);
      next.delete(action.todo.id);
      return {
        ...state,
        todos: state.todos.map((t) => (t.id === action.todo.id ? action.todo : t)),
        isMutating: next.size > 0,
        mutatingIds: next,
      };
    }
    case 'mutationFailedFor': {
      const next = new Set(state.mutatingIds);
      next.delete(action.id);
      return { ...state, isMutating: next.size > 0, mutatingIds: next, error: action.error };
    }
    ```
  - [x] **Why per-item `mutatingIds`:** AC #7 allows "boolean per-item or global". Per-item is the cleaner UX (only the row being toggled disables, not the whole list); use `Set<string>` for O(1) lookup. Global `isMutating` derived from `mutatingIds.size > 0` keeps existing consumer code (Story 1.8's AddTodoForm reads global `isMutating`) working.
  - [x] **Update `initialState`:** add `mutatingIds: new Set()`. Remember to import the type so TypeScript narrows `ReadonlySet<string>` correctly.
  - [x] **`todoCreated` (Story 1.8) doesn't use mutatingIds** — it doesn't have an id before server response. Keep the global `isMutating` toggle for create, per-item for toggle. Document the asymmetry in completion notes.

- [x] **Task 7: Extend `useTodos.ts`** (AC: 6, 7)
  - [x] Add `setCompleted` action:
    ```ts
    const setCompleted = useCallback(async (id: string, completed: boolean): Promise<void> => {
      dispatch({ type: 'mutationStartedFor', id });
      try {
        const todo = await todosApi.setCompleted(id, completed);
        dispatch({ type: 'todoCompletionToggled', todo });
      } catch (err) {
        const apiError = err instanceof HttpApiError ? err.apiError : { code: 'INTERNAL_ERROR' as const, message: String(err) };
        dispatch({ type: 'mutationFailedFor', id, error: apiError });
      }
    }, []);

    return { state, actions: { create, setCompleted, retry: load } };
    ```
  - [x] Expose `mutatingIds` to consumers either as part of `state` (already there) or via a derived helper `isMutatingId(id: string): boolean`. Consumers (TodoItem) can read `state.mutatingIds.has(id)` directly — keeps the hook contract minimal.

- [x] **Task 8: Update `TodoItem.tsx`** (AC: 5, 6)
  - [x] Add a checkbox-shaped toggle bound to `completed`:
    ```tsx
    import type { Todo } from '@bmad-todo/shared';
    import styles from './todos.module.css';

    interface Props {
      todo: Todo;
      onToggle: (id: string, completed: boolean) => void;
      isMutating: boolean;
    }

    export function TodoItem({ todo, onToggle, isMutating }: Props) {
      const handleToggle = () => {
        if (isMutating) return;
        onToggle(todo.id, !todo.completed);
      };

      return (
        <li className={styles.item}>
          <label className={styles.itemLabel}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={handleToggle}
              disabled={isMutating}
              aria-label={todo.completed ? `Mark "${todo.description}" as incomplete` : `Mark "${todo.description}" as complete`}
            />
            <span className={styles.description}>{todo.description}</span>
          </label>
        </li>
      );
    }
    ```
  - [x] **Accessible label** uses the description text — screen readers announce the action. Architecture line 940 (semantic HTML + ARIA throughout features/todos).
  - [x] **Visual distinction** (strikethrough, contrast) is **Story 2.3's** scope. Story 2.1 only wires the checkbox + state; the visual class lands in 2.3. Keep `<TodoItem>` rendering simple — Story 2.3 will add a CSS-modules class conditional on `completed`.
  - [x] **Why `<input type="checkbox">` and not a custom `<button>`:** native semantics. Screen readers, keyboard support (`Space` toggles), focus-visible ring all come for free. Architecture's "doesn't look broken" UX bar earns nothing from a custom toggle.

- [x] **Task 9: Update `TodoList.tsx` to thread the new props** (AC: 5)
  - [x] `<TodoList>` now accepts toggle handler + per-item mutation state:
    ```tsx
    interface Props {
      todos: Todo[];
      onToggle: (id: string, completed: boolean) => void;
      mutatingIds: ReadonlySet<string>;
    }

    export function TodoList({ todos, onToggle, mutatingIds }: Props) {
      if (todos.length === 0) return null;
      return (
        <ul className={styles.list}>
          {todos.map((t) => (
            <TodoItem
              key={t.id}
              todo={t}
              onToggle={onToggle}
              isMutating={mutatingIds.has(t.id)}
            />
          ))}
        </ul>
      );
    }
    ```
  - [x] Update `TodoFeature.tsx` to pass them down:
    ```tsx
    <TodoList
      todos={state.todos}
      onToggle={actions.setCompleted}
      mutatingIds={state.mutatingIds}
    />
    ```

- [x] **Task 10: Frontend unit tests** (Test Scenarios — Unit)
  - [x] `apps/frontend/src/features/todos/todosReducer.test.ts` — extend from 1.8:
    - `todoCompletionToggled` with a payload todo updates the matching item; other todos unchanged (use `expect(state.todos[1]).toBe(originalTodos[1])` reference equality to verify immutability).
    - `mutationStartedFor` adds the id to `mutatingIds` and sets `isMutating: true`.
    - `mutationFailedFor` removes the id from `mutatingIds` (resets `isMutating` if empty), captures the error.
  - [x] `apps/frontend/src/features/todos/TodoItem.test.tsx` — extend from 1.8:
    - Clicking the checkbox calls `onToggle(id, true)` when previously `completed: false`.
    - Calling with `completed: true` toggles to `false`.
    - When `isMutating: true`, the checkbox is disabled (`getByRole('checkbox').toBeDisabled()`); clicking does NOT invoke `onToggle`.
    - aria-label changes between "Mark X as complete" / "Mark X as incomplete" based on `completed`.
  - [x] `apps/frontend/src/features/todos/api.test.ts` — extend from 1.8:
    - `setCompleted(id, true)` PATCHes the right URL with the right body; 200 response → returns parsed Todo.
    - 404 response → throws `HttpApiError` with `apiError.code === 'NOT_FOUND'`.
  - [x] `apps/frontend/src/features/todos/useTodos.test.ts` — extend from 1.8:
    - `actions.setCompleted(id, true)` dispatches `mutationStartedFor` then `todoCompletionToggled` on success.
    - On API failure (mock 404 response), dispatches `mutationFailedFor` with the parsed error.

- [x] **Task 11: E2E specs — NFR20 flows #3 and #4** (Test Scenarios — E2E)
  - [x] `e2e/tests/complete-todo.spec.ts`:
    ```ts
    import { test, expect } from '@playwright/test';

    test('user can mark a todo complete', async ({ page }) => {
      const description = `Read book ${Date.now()}`;
      await page.goto('/');
      await page.getByLabel(/new todo/i).fill(description);
      await page.getByRole('button', { name: /add todo/i }).click();

      const item = page.getByRole('listitem').filter({ hasText: description });
      const checkbox = item.getByRole('checkbox');

      await expect(checkbox).not.toBeChecked();
      await checkbox.click();
      await expect(checkbox).toBeChecked();

      // Persistence smoke
      await page.reload();
      const reloadedItem = page.getByRole('listitem').filter({ hasText: description });
      await expect(reloadedItem.getByRole('checkbox')).toBeChecked();
    });
    ```
  - [x] `e2e/tests/incomplete-todo.spec.ts`:
    ```ts
    import { test, expect } from '@playwright/test';

    test('user can mark a completed todo as incomplete', async ({ page }) => {
      const description = `Practice piano ${Date.now()}`;
      await page.goto('/');
      await page.getByLabel(/new todo/i).fill(description);
      await page.getByRole('button', { name: /add todo/i }).click();

      const item = page.getByRole('listitem').filter({ hasText: description });
      const checkbox = item.getByRole('checkbox');

      // Mark complete first
      await checkbox.click();
      await expect(checkbox).toBeChecked();

      // Then mark incomplete
      await checkbox.click();
      await expect(checkbox).not.toBeChecked();

      // Persistence smoke
      await page.reload();
      await expect(
        page.getByRole('listitem').filter({ hasText: description }).getByRole('checkbox'),
      ).not.toBeChecked();
    });
    ```
  - [x] Both specs use unique-per-run descriptions — no test isolation needed at the DB level.

- [x] **Task 12: Verify the AC end-to-end**
  - [x] `docker compose up --wait`. Open `:8080`. Add a todo, click checkbox, verify it visually toggles (visual styling is 2.3, but the checkbox ✓ should appear).
  - [x] Open Network panel, click toggle: confirm `PATCH /api/todos/<uuid>` request with `{"completed": true}`, response 200 with the updated Todo.
  - [x] In another tab, delete the row directly via `psql`, then click the checkbox in the original tab: confirm `PATCH` returns 404, no app crash, error stored in state (`state.error`). UI doesn't display the error explicitly until Story 3.2.
  - [x] Story 1.1 verification chain: `npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build` — exit 0.
  - [x] E2E run: `npm test --workspace @bmad-todo/e2e` — both new specs (`complete-todo`, `incomplete-todo`) plus Story 1.8's `create-todo` pass. CI's E2E job confirms across all three browsers.

## Dev Notes

### Story Foundation Summary

This story adds the **first state mutation** beyond create. The toggle delivers FR3 (mark complete) and FR4 (un-complete). Architecture's pessimistic UI rule and per-item mutation tracking get their first real workout here.

**FRs implemented:** FR3 (mark complete), FR4 (un-complete).

**NFRs implemented:** NFR3/NFR4 continued (Zod validates body + path params), NFR15 (layered backend, repository seam used), NFR20 (Playwright flows #3 + #4 of the five).

### Files to CREATE

| Path | Purpose |
|---|---|
| `e2e/tests/complete-todo.spec.ts` | NFR20 flow #3 |
| `e2e/tests/incomplete-todo.spec.ts` | NFR20 flow #4 |

### Files to UPDATE

| Path | Change |
|---|---|
| `apps/backend/src/services/todoService.ts` | Add `setCompletion`/`setCompleted` method (Task 1) |
| `apps/backend/src/services/todoService.test.ts` | Tests for the new method (Task 4) |
| `apps/backend/src/controllers/todoController.ts` | Register PATCH route (Task 2) |
| `apps/backend/tests/integration/todoRoutes.test.ts` | New PATCH scenarios (Task 3) |
| `apps/frontend/src/features/todos/api.ts` | Add `setCompleted` (Task 5) |
| `apps/frontend/src/features/todos/api.test.ts` | Tests for new method (Task 10) |
| `apps/frontend/src/features/todos/todosReducer.ts` | Add `mutatingIds`, three new actions (Task 6) |
| `apps/frontend/src/features/todos/todosReducer.test.ts` | Tests for new actions (Task 10) |
| `apps/frontend/src/features/todos/useTodos.ts` | Add `setCompleted` action (Task 7) |
| `apps/frontend/src/features/todos/useTodos.test.ts` | Tests (Task 10) |
| `apps/frontend/src/features/todos/TodoItem.tsx` | Add checkbox + accessibility label (Task 8) |
| `apps/frontend/src/features/todos/TodoItem.test.tsx` | Toggle interaction tests (Task 10) |
| `apps/frontend/src/features/todos/TodoList.tsx` | Thread `onToggle` and `mutatingIds` props (Task 9) |
| `apps/frontend/src/features/todos/TodoFeature.tsx` | Pass new props to TodoList (Task 9) |

### Architecture Compliance

- **Layered backend** [Source: architecture.md lines 914–921]: PATCH route flows controller → service → repository. Service is a thin pass-through (still required — establishes layering as a habit, gives Epic 3+ a place to inject business rules).
- **Audit-log non-foreclosure** [Source: architecture.md lines 272, 643]: `updated_at` updated on every toggle. Story 1.7's `postgresTodoRepository.setCompleted` already handles this via `set({ updatedAt: sql\`now()\` })`. AC #4 satisfied implicitly by Story 1.7's implementation.
- **Pessimistic UI** [Source: architecture.md lines 389, 759]: server confirms before UI updates. `mutationStartedFor` → API call → `todoCompletionToggled` (success) or `mutationFailedFor` (failure).
- **Per-item mutation tracking** [Source: architecture.md line 672]: `isMutating: boolean` *or* per-item is acceptable. Story 2.1 chose per-item via `mutatingIds: Set<string>` for cleaner UX (only the row being toggled disables).
- **Past-tense actions** [Source: architecture.md line 648]: `todoCompletionToggled`, `mutationStartedFor`, `mutationFailedFor`. Not `toggleTodoCompletion` etc.
- **API resource shape** [Source: architecture.md line 327]: `PATCH /api/todos/:id` with body `{completed: boolean}` returns `Todo` (200) or 404. Confirmed.
- **No `description` updates** [Source: architecture.md line 333, 1.6 dev notes]: PATCH body is `UpdateTodoCompletionInputSchema` only — `{completed}`. Don't accept `description` updates.
- **Accessibility floor** [Source: architecture.md line 940; PRD NFR9]: native `<input type="checkbox">` with descriptive `aria-label` satisfies Level A. Visual treatment (Story 2.3) extends.

### Previous Story Intelligence (1.1–1.8 → 2.1)

- **From 1.4 (errorHandler):** `NotFoundError` thrown anywhere in the request chain maps to 404 with `code: 'NOT_FOUND'`. Story 2.1 doesn't add per-route 404 handling — the plugin from Story 1.4 does the mapping.
- **From 1.4 (Zod validation):** path params validated via `params: z.object({ id: z.string().uuid() })`. Malformed UUID → 400 automatically.
- **From 1.6:** `UpdateTodoCompletionInputSchema` exists. Use it; don't redefine.
- **From 1.7:** `postgresTodoRepository.setCompleted(id, completed, userId)` is the underlying method. It throws `NotFoundError` on no-match — propagates correctly.
- **From 1.7:** `updated_at` is set via `sql\`now()\`` in the repository. AC #4's audit-seam is already wired.
- **From 1.8:** `apps/frontend/src/features/todos/TodoItem.tsx` was a simple read-only renderer. Story 2.1 adds the toggle. Verify the existing 1.8 unit test still passes by extending the props it expects (or update the existing test).
- **From 1.8:** `useTodos` exposes `{ state, actions }`. Story 2.1 adds `setCompleted` to `actions`. Existing consumers (`AddTodoForm`) keep working — they don't read `actions.setCompleted`.
- **From 1.8:** `state.isMutating` was a global boolean. Story 2.1 introduces `mutatingIds: Set<string>` and *derives* `isMutating` from `mutatingIds.size > 0`. AddTodoForm continues to read the global flag — no change needed there.

### Latest Tech Information

No new dependencies. All required pieces (Fastify route plugins, Zod schemas, React Testing Library, Playwright) are in place from Stories 1.4 / 1.5 / 1.6 / 1.8.

### Anti-Patterns to Avoid

❌ **Don't add a separate `setActive` / `setComplete` pair of API endpoints.** One PATCH with `{completed: boolean}` covers both directions.
❌ **Don't compute the new `completed` value server-side.** Body explicitly carries `{completed: boolean}`. Server doesn't infer "toggle" from current state — that would break HTTP idempotency.
❌ **Don't use a `<button>` with custom check-mark icon.** Native `<input type="checkbox">` for accessibility wins. Custom toggles are acceptable in Story 4.1+ if responsive design demands it; Story 2.1 keeps it native.
❌ **Don't apply the strikethrough / completed-styling in Story 2.1.** Story 2.3 owns visual distinction (FR6). Keep TodoItem visually unchanged for `completed: true` here.
❌ **Don't render the error in `<TodoItem>` on toggle failure.** Story 3.2 handles error UX. Story 2.1's job: `mutationFailedFor` lands in state without crashing.
❌ **Don't add optimistic UI** — even though "tiny boolean flip" feels safe, architecture mandates pessimistic v1.
❌ **Don't skip the per-item disable.** AC #7 requires it. A user can't double-click and double-fire the PATCH.
❌ **Don't use `ReadonlySet` everywhere — only at the type boundary.** Internally the reducer creates new `Set` instances; consumers see them as `ReadonlySet`. This makes accidental mutation a TS error.
❌ **Don't forget the `updatedAt` assertion in integration tests.** AC #4 ("updates `updated_at`") is verifiable; sleep ~10ms between create and PATCH or compare to seconds-precision timestamps.

### Testing Standards

Per epics.md Story 2.1 *Test Scenarios*:

- **Unit:** `todoService.setCompletion()` (delegate + rethrow); `todosReducer.todoCompletionToggled` (immutability); `TodoItem` (toggle invocation + disabled state).
- **Integration:** four PATCH scenarios listed in Task 3.
- **E2E:** `complete-todo.spec.ts` (NFR20 flow #3), `incomplete-todo.spec.ts` (NFR20 flow #4).

Coverage thresholds: ≥ 70% backend (NFR18), ≥ 70% frontend (NFR19) — must remain green.

### References

- Story scope and ACs: [Source: epics.md Story 2.1 (lines 523–568)]
- API resource (PATCH): [Source: architecture.md line 327]
- Pessimistic UI: [Source: architecture.md lines 389, 759]
- Per-item mutation: [Source: architecture.md line 672]
- Past-tense actions: [Source: architecture.md line 648]
- Audit-log seam (`updated_at`): [Source: architecture.md lines 272, 643]
- `UpdateTodoCompletionInputSchema`: [Source: 1-6-...md *Task 4*]
- `postgresTodoRepository.setCompleted`: [Source: 1-7-...md *Task 8*]
- Reducer baseline (Story 1.8 actions): [Source: 1-8-...md *Task 6*]
- TodoItem baseline (read-only): [Source: 1-8-...md *Task 8*]
- userContext plugin (`request.userId`): [Source: 1-4-...md *Task 6*]

### Project Knowledge References

No `docs/project-context.md` exists yet.

## Dev Agent Record

### Agent Model Used

Codex 5.3

### Debug Log References

- Added `PATCH /api/todos/:id` with typed params/body schema and delegated to `TodoService.setCompleted`.
- Extended backend integration tests with success, malformed id/body, and not-found PATCH coverage, including `updatedAt > createdAt` assertion.
- Implemented frontend toggle flow (`todosApi.setCompleted`, `useTodos.actions.setCompleted`, reducer `mutatingIds`) with pessimistic update semantics.
- New E2E specs initially failed because the running containers were stale; rebuilt stack with `docker compose -f docker-compose.yml up -d --build --wait`, then all three browser projects passed.
- Verified not-found mutation path through live API by deleting a created todo directly from Postgres and observing 404 `NOT_FOUND` on subsequent PATCH.

### Completion Notes List

- Chose `setCompleted` in the service for naming symmetry with the repository (`setCompletion` wording in AC is imprecise).
- Added backend PATCH route integration coverage and service unit delegation test; `updatedAt` assertion is implemented with a short sleep before PATCH.
- Added frontend per-item mutation tracking via `mutatingIds` while retaining global `isMutating` for existing create flow compatibility.
- Added and stabilized `complete-todo` and `incomplete-todo` Playwright specs; both pass across chromium/firefox/webkit.
- Re-ran full validation chain with Node 24 PATH prefix: `npm ci`, `npm run lint`, `npm run format:check`, `npm run test`, `npx tsc --build`, and `npm test --workspace @bmad-todo/e2e` all pass.

### File List

- apps/backend/src/services/todoService.ts
- apps/backend/src/services/todoService.test.ts
- apps/backend/src/controllers/todoController.ts
- apps/backend/tests/integration/todoRoutes.test.ts
- apps/frontend/src/features/todos/api.ts
- apps/frontend/src/features/todos/api.test.ts
- apps/frontend/src/features/todos/todosReducer.ts
- apps/frontend/src/features/todos/todosReducer.test.ts
- apps/frontend/src/features/todos/useTodos.ts
- apps/frontend/src/features/todos/useTodos.test.ts
- apps/frontend/src/features/todos/TodoItem.tsx
- apps/frontend/src/features/todos/TodoItem.test.tsx
- apps/frontend/src/features/todos/TodoList.tsx
- apps/frontend/src/features/todos/TodoFeature.tsx
- apps/frontend/src/features/todos/todos.module.css
- e2e/tests/complete-todo.spec.ts
- e2e/tests/incomplete-todo.spec.ts
- _bmad-output/implementation-artifacts/2-1-toggle-todo-completion-mark-complete-and-un-complete.md
- _bmad-output/implementation-artifacts/dev-issue-log.md

## Change Log

- 2026-04-28: Implemented Story 2.1 toggle flow end-to-end (backend PATCH, frontend checkbox interactions, reducer/hook/API extensions, unit/integration/E2E tests) and moved story to review after full validation pass.
