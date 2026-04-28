# Story 2.2: Delete a todo

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an end user,
I want to delete a todo I no longer need,
So that my list stays focused on what's still relevant. (Delivers FR5.)

## Acceptance Criteria

1. **Given** Story 1.8 is complete, **When** Story 2.2 completes, **Then** `apps/backend/src/services/todoService.ts` adds `deleteTodo(id, userId)`.
2. `apps/backend/src/controllers/todoController.ts` registers `DELETE /api/todos/:id`.
3. `DELETE /api/todos/:id` returns 204 (no body) on success; 404 `code: 'NOT_FOUND'` on missing id.
4. `apps/frontend/src/features/todos/TodoItem.tsx` renders a delete control (button with accessible label).
5. Clicking delete calls `useTodos.actions.delete(id)` which calls the API and only removes from UI after server confirmation (pessimistic).
6. The delete control is disabled while the mutation is in flight.
7. **Given** a todo in the list, **When** I click its delete control, **Then** the backend removes the row, **And** the frontend dispatches `todoDeleted` and the row is removed from the rendered list.
8. **Given** a todo whose id no longer exists, **When** delete is clicked, **Then** the backend returns 404 and the frontend dispatches `mutationFailed` (full UX in Epic 3).
9. **Given** a list with one todo remaining, **When** I delete the last todo, **Then** the empty-state component (FR8) re-appears.

## Tasks / Subtasks

- [x] **Task 1: Extend `apps/backend/src/services/todoService.ts`** (AC: 1)
  - [x] Add `deleteTodo(id, userId)` — pass-through to `repository.delete`, propagates `NotFoundError`:
    ```ts
    async deleteTodo(id: string, userId: string): Promise<void> {
      await this.repo.delete(id, userId);
    }
    ```

- [x] **Task 2: Extend `apps/backend/src/controllers/todoController.ts` with DELETE route** (AC: 2, 3)
  - [x] Register inside `buildTodoController(service)`:
    ```ts
    fastify.withTypeProvider<ZodTypeProvider>().route({
      method: 'DELETE',
      url: '/api/todos/:id',
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 204: z.null() },
      },
      handler: async (request, reply) => {
        await service.deleteTodo(request.params.id, request.userId);
        return reply.code(204).send();
      },
    });
    ```
  - [x] **204 with no body** — `reply.code(204).send()` with no argument. The Zod response schema `204: z.null()` declares "expected to send no body"; `@fastify/type-provider-zod` handles the empty-body serialization.
  - [x] `NotFoundError` from the repository propagates to the errorHandler plugin (Story 1.4) → 404 envelope. AC #3 satisfied.

- [x] **Task 3: Backend integration tests** (Test Scenarios — Integration)
  - [x] Extend `apps/backend/tests/integration/todoRoutes.test.ts`:
    - `DELETE /api/todos/:id` against an existing row → 204 with empty body; subsequent `GET /api/todos` does not include the deleted id.
    - Second `DELETE` of the same id → 404 with `code: 'NOT_FOUND'`.
    - `DELETE` of a malformed id (non-UUID string) → 400 `VALIDATION_FAILED`.
  - [x] **204 verification:** assert `response.statusCode === 204` AND `response.body === ''` (Fastify returns empty string for no-body responses).

- [x] **Task 4: Backend service unit test**
  - [x] Extend `apps/backend/src/services/todoService.test.ts`:
    - `deleteTodo()` calls `repository.delete` with the right args; rethrows `NotFoundError`.

- [x] **Task 5: Extend frontend api at `apps/frontend/src/features/todos/api.ts`** (AC: 5)
  - [x] Add `deleteOne` (don't shadow JS's `delete` keyword — `delete` is reserved):
    ```ts
    deleteOne: async (id: string): Promise<void> => {
      await httpRequest<unknown>(`/api/todos/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      // 204 → httpRequest returns undefined; nothing to parse.
    },
    ```
  - [x] **`delete` is a reserved word** in JS object methods *prior* to ES5 strict mode (it works as a property name today, but linters and some tooling complain). Use `deleteOne` — clearer intent anyway. Hook's action name (`actions.delete`) can keep `delete` because it's accessed as `actions.delete(...)`, not as a bare identifier.
  - [x] Story 1.5's `httpRequest` already returns `undefined as T` for 204 responses (Task 7 of Story 1.5).

- [x] **Task 6: Extend `todosReducer.ts`** (AC: 5)
  - [x] Add `todoDeleted` action:
    ```ts
    export type TodosAction =
      // ... existing ...
      | { type: 'todoDeleted'; id: string };

    case 'todoDeleted': {
      const next = new Set(state.mutatingIds);
      next.delete(action.id);
      return {
        ...state,
        todos: state.todos.filter((t) => t.id !== action.id),
        isMutating: next.size > 0,
        mutatingIds: next,
      };
    }
    ```
  - [x] **Immutable filter** — `Array.prototype.filter` returns a new array; original `state.todos` reference unchanged.

- [x] **Task 7: Extend `useTodos.ts`** (AC: 5)
  - [x] Add `delete` action (renamed property is fine; access pattern is `actions.delete(id)`):
    ```ts
    const deleteAction = useCallback(async (id: string): Promise<void> => {
      dispatch({ type: 'mutationStartedFor', id });
      try {
        await todosApi.deleteOne(id);
        dispatch({ type: 'todoDeleted', id });
      } catch (err) {
        const apiError = err instanceof HttpApiError ? err.apiError : { code: 'INTERNAL_ERROR' as const, message: String(err) };
        dispatch({ type: 'mutationFailedFor', id, error: apiError });
      }
    }, []);

    return {
      state,
      actions: { create, setCompleted, delete: deleteAction, retry: load },
    };
    ```
  - [x] **Why a local alias `deleteAction`:** can't name a `const` `delete` (reserved word at the top level of a block in strict mode, which TS files are by default). Object property `delete:` is fine.

- [x] **Task 8: Update `TodoItem.tsx`** (AC: 4, 6)
  - [x] Add a delete button next to the checkbox:
    ```tsx
    interface Props {
      todo: Todo;
      onToggle: (id: string, completed: boolean) => void;
      onDelete: (id: string) => void;
      isMutating: boolean;
    }

    export function TodoItem({ todo, onToggle, onDelete, isMutating }: Props) {
      // ... existing toggle handler ...

      return (
        <li className={styles.item}>
          <label className={styles.itemLabel}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => !isMutating && onToggle(todo.id, !todo.completed)}
              disabled={isMutating}
              aria-label={todo.completed ? `Mark "${todo.description}" as incomplete` : `Mark "${todo.description}" as complete`}
            />
            <span className={styles.description}>{todo.description}</span>
          </label>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={() => !isMutating && onDelete(todo.id)}
            disabled={isMutating}
            aria-label={`Delete "${todo.description}"`}
          >
            Delete
          </button>
        </li>
      );
    }
    ```
  - [x] **`<button type="button">`** — explicit type prevents form-submission default. Critical inside `<form>`-adjacent contexts; `<TodoItem>` isn't inside a form today, but the explicit type is defensive.
  - [x] **`aria-label` includes the description text** — screen readers say "Delete Buy milk", not just "Delete".
  - [x] **No confirmation dialog in v1.** Architecture line 759 anti-patterns include over-engineering; PRD's "doesn't look broken" UX bar doesn't earn a confirm step. If a user reports accidental-delete pain post-launch, undo lands in a separate story.

- [x] **Task 9: Update `TodoList.tsx` to thread `onDelete`** (AC: 4)
  - [x] Extend props:
    ```tsx
    interface Props {
      todos: Todo[];
      onToggle: (id: string, completed: boolean) => void;
      onDelete: (id: string) => void;
      mutatingIds: ReadonlySet<string>;
    }
    ```
  - [x] Pass `onDelete` to each `<TodoItem>`. Update `TodoFeature.tsx` to pass `actions.delete` as the `onDelete` prop.

- [x] **Task 10: Style the delete button in `todos.module.css`**
  - [x] Minimal styling (architecture's "doesn't look broken" bar):
    ```css
    .item {
      padding: 0.75rem 0;
      border-bottom: 1px solid #eaeaea;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .itemLabel {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
    }

    .deleteButton {
      flex-shrink: 0;
      cursor: pointer;
    }

    .deleteButton:disabled {
      cursor: wait;
      opacity: 0.6;
    }
    ```
  - [x] Story 4.1's responsive pass may revisit; Story 2.2 just keeps the visual layout sane.

- [x] **Task 11: Frontend unit tests** (Test Scenarios — Unit)
  - [x] `todosReducer.test.ts` — extend:
    - `todoDeleted` removes the matching todo immutably; other todos unchanged (verify reference equality on the unaffected ones).
  - [x] `TodoItem.test.tsx` — extend:
    - Clicking the delete button invokes `onDelete(todo.id)`.
    - When `isMutating: true`, the delete button is disabled; clicking does not invoke `onDelete`.
  - [x] `TodoFeature.test.tsx` (new) OR extend `TodoList.test.tsx`:
    - When the last todo is deleted (state.todos.length goes from 1 to 0 with status === 'loaded'), `<EmptyState>` renders. Test by simulating the reducer transition or mocking `useTodos`.
  - [x] `api.test.ts` — extend:
    - `deleteOne(id)` calls `DELETE /api/todos/<id>`; 204 response → resolves to undefined.
    - 404 response → throws `HttpApiError` with `apiError.code === 'NOT_FOUND'`.

- [x] **Task 12: E2E spec — NFR20 flow #5 (`delete-todo`)** (Test Scenarios — E2E)
  - [x] `e2e/tests/delete-todo.spec.ts`:
    ```ts
    import { test, expect } from '@playwright/test';

    test('user can delete todos and empty-state returns', async ({ page }) => {
      const stamp = Date.now();
      const first = `Delete me first ${stamp}`;
      const second = `Delete me second ${stamp}`;

      await page.goto('/');
      // Add two todos
      const input = page.getByLabel(/new todo/i);
      const addButton = page.getByRole('button', { name: /add todo/i });
      await input.fill(first);
      await addButton.click();
      await expect(page.getByRole('listitem').filter({ hasText: first })).toBeVisible();
      await input.fill(second);
      await addButton.click();
      await expect(page.getByRole('listitem').filter({ hasText: second })).toBeVisible();

      // Delete the first
      await page.getByRole('button', { name: new RegExp(`Delete "${first}"`) }).click();
      await expect(page.getByRole('listitem').filter({ hasText: first })).toHaveCount(0);
      await expect(page.getByRole('listitem').filter({ hasText: second })).toBeVisible();

      // Delete the second; empty state appears
      await page.getByRole('button', { name: new RegExp(`Delete "${second}"`) }).click();
      await expect(page.getByRole('listitem').filter({ hasText: second })).toHaveCount(0);
      await expect(page.getByRole('status')).toContainText(/no todos/i);

      // Persistence smoke
      await page.reload();
      await expect(page.getByRole('status')).toContainText(/no todos/i);
    });
    ```
  - [x] The `aria-label` based locators (`Delete "${first}"`) require Story 2.2's `TodoItem.tsx` to expose accessible labels per Task 8. If the dev agent changes the label format, update the spec.

- [x] **Task 13: Verify the AC end-to-end**
  - [x] `docker compose up --wait`. Add 2 todos, delete each, confirm the empty state returns.
  - [x] Network panel: confirm `DELETE /api/todos/<uuid>` responses are 204 with empty body.
  - [x] DB query: `docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT count(*) FROM todos;"` returns 0 after both deletes.
  - [x] Story 1.1 verification chain: `npm ci && npm run lint && npm run format:check && npm run test && npx tsc --build` exits 0.
  - [x] All five NFR20 Playwright flows tracked so far run green: `create-todo`, `complete-todo`, `incomplete-todo`, `delete-todo`. (Five #5: `list-todos` typically isn't a separate flow — Story 1.8's `create-todo` exercises listing implicitly. The architecture's five flows are create / list / complete / incomplete / delete; Story 4.3 may add a dedicated `list-todos` spec if NFR20 audit calls it out.)

## Dev Notes

### Story Foundation Summary

This story implements **delete** — the last CRUD operation. Combined with 1.8 (create+list) and 2.1 (toggle), `apps/frontend/src/features/todos/` now does full CRUD. Story 2.3 polishes visual distinction; Epic 2 is functionally complete after that.

**FRs implemented:** FR5 (delete).

**NFRs implemented:** NFR3/NFR4 continued (Zod path-param validation), NFR20 (Playwright flow #5: `delete-todo`).

### Files to CREATE

| Path | Purpose |
|---|---|
| `e2e/tests/delete-todo.spec.ts` | NFR20 flow #5 |

### Files to UPDATE

| Path | Change |
|---|---|
| `apps/backend/src/services/todoService.ts` | Add `deleteTodo` (Task 1) |
| `apps/backend/src/services/todoService.test.ts` | Test for `deleteTodo` (Task 4) |
| `apps/backend/src/controllers/todoController.ts` | Register DELETE route (Task 2) |
| `apps/backend/tests/integration/todoRoutes.test.ts` | DELETE scenarios (Task 3) |
| `apps/frontend/src/features/todos/api.ts` | Add `deleteOne` (Task 5) |
| `apps/frontend/src/features/todos/api.test.ts` | Test (Task 11) |
| `apps/frontend/src/features/todos/todosReducer.ts` | Add `todoDeleted` action (Task 6) |
| `apps/frontend/src/features/todos/todosReducer.test.ts` | Test (Task 11) |
| `apps/frontend/src/features/todos/useTodos.ts` | Add `delete` action (Task 7) |
| `apps/frontend/src/features/todos/useTodos.test.ts` | Test (Task 11) |
| `apps/frontend/src/features/todos/TodoItem.tsx` | Add delete button (Task 8) |
| `apps/frontend/src/features/todos/TodoItem.test.tsx` | Delete-button tests (Task 11) |
| `apps/frontend/src/features/todos/TodoList.tsx` | Thread `onDelete` (Task 9) |
| `apps/frontend/src/features/todos/TodoFeature.tsx` | Pass `actions.delete` (Task 9) |
| `apps/frontend/src/features/todos/todos.module.css` | Style delete button + flex layout (Task 10) |

### Architecture Compliance

- **HTTP semantics** [Source: architecture.md lines 322–329]: `DELETE /api/todos/:id` returns 204 (no body) on success, 404 on missing.
- **Pessimistic UI** [Source: architecture.md lines 389, 759]: server confirms before UI removes.
- **Error envelope** [Source: architecture.md lines 335–349]: `NotFoundError` → 404 with `code: 'NOT_FOUND'` via Story 1.4's errorHandler.
- **Layered backend** [Source: architecture.md lines 914–921]: controller → service → repository, no skipping.
- **Past-tense actions** [Source: architecture.md line 648]: `todoDeleted`. Not `deleteTodo`.
- **Immutable updates** [Source: architecture.md line 647]: `Array.filter` returns new array.
- **Accessibility floor** [Source: architecture.md line 940]: `<button>` with `aria-label` describing the target todo.
- **No undo / no confirmation in v1** [Source: PRD *Items Deliberately Not Made FRs*]: hard delete; no soft-delete column. *Non-foreclosure note:* if undo lands later, it requires either a `deleted_at` column (soft delete) or a frontend-only "recently deleted" buffer with re-create on undo.

### Previous Story Intelligence (1.7, 1.8, 2.1 → 2.2)

- **From 1.7:** `postgresTodoRepository.delete(id, userId)` already exists and throws `NotFoundError` on no-match. Service is a thin pass-through.
- **From 1.8:** `apps/frontend/src/features/todos/TodoFeature.tsx` conditionally renders `<EmptyState>` when `state.status === 'loaded' && state.todos.length === 0`. Story 2.2's "delete the last todo → empty state appears" flows through that conditional automatically. No new logic needed.
- **From 2.1:** `mutatingIds: Set<string>` per-item mutation tracking. Delete reuses the same `mutationStartedFor` / `mutationFailedFor` actions; only the success action differs (`todoDeleted` vs `todoCompletionToggled`).
- **From 2.1:** TodoItem's checkbox + label structure. Story 2.2 adds the delete button as a sibling — keep the toggle behavior unchanged.
- **From 2.1:** TodoList signature evolved (added `onToggle`, `mutatingIds`). Story 2.2 adds `onDelete`. TodoFeature.tsx threads all three.

### Latest Tech Information

No new dependencies. All required pieces (Fastify route plugins, error mapping, Zod, Playwright locators) are in place from prior stories.

### Anti-Patterns to Avoid

❌ **Don't add a confirmation dialog.** Out of scope for v1 — no PRD requirement.
❌ **Don't soft-delete (set `deleted_at`).** Architecture mandates hard delete. Soft delete is non-foreclosed for later if needed.
❌ **Don't optimistically remove from UI.** Pessimistic — wait for server 204.
❌ **Don't return a body from DELETE.** Status 204 means "no representation". `reply.code(204).send()` with no argument.
❌ **Don't name the JS function `delete`.** Reserved word at the top level. Use `deleteOne` (api) or `deleteAction` (hook local). Hook's actions object property `delete:` is fine because property accessors are valid.
❌ **Don't forget to filter out deleted ids from `mutatingIds`.** The reducer must clean up `mutatingIds` on `todoDeleted` (and on `mutationFailedFor`, already handled in 2.1).
❌ **Don't add a separate "deleting" state class to TodoItem.** Disabled is enough; visual fading is over-engineering.
❌ **Don't add bulk-delete.** "Delete all completed" or similar isn't in the FR list. Single-item delete only.

### Testing Standards

Per epics.md Story 2.2 *Test Scenarios*:

- **Unit:** `todoService.deleteTodo`; `todosReducer.todoDeleted`; `TodoItem` (click invokes callback, disabled when mutating); `TodoFeature` / `TodoList` (last delete → empty state).
- **Integration:** three DELETE scenarios listed in Task 3.
- **E2E:** `delete-todo.spec.ts` — NFR20 flow #5.

Coverage thresholds ≥ 70% backend (NFR18), ≥ 70% frontend (NFR19) — must remain green.

### References

- Story scope and ACs: [Source: epics.md Story 2.2 (lines 570–614)]
- HTTP semantics (DELETE 204 / 404): [Source: architecture.md line 328]
- Error envelope: [Source: architecture.md lines 335–349]
- Pessimistic UI: [Source: architecture.md lines 389, 759]
- Past-tense actions: [Source: architecture.md line 648]
- Repository delete (`NotFoundError` on no-match): [Source: 1-7-...md *Task 8*]
- TodoItem baseline (post-2.1 with checkbox): [Source: 2-1-...md *Task 8*]
- Reducer baseline with `mutatingIds`: [Source: 2-1-...md *Task 6*]
- TodoFeature conditional empty-state: [Source: 1-8-...md *Task 8*]

### Project Knowledge References

No `docs/project-context.md` exists yet.

## Dev Agent Record

### Agent Model Used

Codex 5.3

### Debug Log References

- 2026-04-28: `todoController` DELETE route initially used `reply.code(204).send()` and failed backend TS build in Docker (`send` requires one arg in current types). Updated to `reply.code(204).send(null)`; integration assertion still verifies empty response body (`''`).
- 2026-04-28: `delete-todo` Playwright flow was flaky due shared persisted state and parallel workers. Stabilized by adding defensive cleanup in the spec and running e2e with a single worker in Playwright config.

### Completion Notes List

- Implemented backend delete support end-to-end: `TodoService.deleteTodo`, `DELETE /api/todos/:id` controller route with UUID params validation, and 204/404 behavior through existing typed error handling.
- Implemented frontend pessimistic delete flow: API `deleteOne`, reducer action `todoDeleted`, hook action `actions.delete`, and UI wiring (`TodoItem` delete button, `TodoList`/`TodoFeature` threading, disabled state during mutation).
- Added/extended unit, integration, and E2E tests for delete behavior including empty-state reappearance after deleting the last todo.
- Validation completed locally with Node 24 PATH prefix: `npm run lint`, `npm run format:check`, `npm run test`, and `npx tsc --build` all pass.

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
- apps/frontend/src/features/todos/TodoFeature.test.tsx
- apps/frontend/src/features/todos/todos.module.css
- e2e/tests/delete-todo.spec.ts
- e2e/playwright.config.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/dev-issue-log.md

## Change Log

- 2026-04-28: Implemented Story 2.2 delete capability across backend, frontend, and test layers; validated full repo chain on Node 24 and moved story to review.
