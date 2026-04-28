import type { CreateTodoInput, Todo } from '@bmad-todo/shared';

/**
 * The persistence-layer seam (architecture lines 595-604, 718-723).
 *
 * Caching, audit-log capture, and real-time-sync triggers all land at this interface.
 * Services and controllers depend on the interface, never on `PostgresTodoRepository` directly.
 *
 * Every method takes `userId: string` — the auth-readiness seam (architecture line 295-299).
 * v1 always passes `'default-user'`; when auth lands, callers pass `request.userId`.
 */
export interface TodoRepository {
  list(userId: string): Promise<Todo[]>;
  create(input: CreateTodoInput, userId: string): Promise<Todo>;
  setCompleted(id: string, completed: boolean, userId: string): Promise<Todo>;
  delete(id: string, userId: string): Promise<void>;
}
