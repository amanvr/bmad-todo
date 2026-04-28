import { and, desc, eq, sql } from 'drizzle-orm';
import type { CreateTodoInput, Todo } from '@bmad-todo/shared';
import type { Database } from '../db/client.js';
import { todos } from '../db/schema.js';
import { NotFoundError } from '../errors.js';
import type { TodoRepository } from './todoRepository.js';

type TodoRow = typeof todos.$inferSelect;

function toIsoDatetime(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDomain(row: TodoRow): Todo {
  // Strip server-side `userId` from the wire shape (architecture line 271).
  return {
    id: row.id,
    description: row.description,
    completed: row.completed,
    createdAt: toIsoDatetime(row.createdAt),
    updatedAt: toIsoDatetime(row.updatedAt),
  };
}

export class PostgresTodoRepository implements TodoRepository {
  constructor(private readonly db: Database) {}

  async list(userId: string): Promise<Todo[]> {
    const rows = await this.db
      .select()
      .from(todos)
      .where(eq(todos.userId, userId))
      .orderBy(desc(todos.createdAt));
    return rows.map(toDomain);
  }

  async create(input: CreateTodoInput, userId: string): Promise<Todo> {
    const [row] = await this.db
      .insert(todos)
      .values({ description: input.description, userId })
      .returning();
    if (!row) throw new Error('insert returned no row — should not happen');
    return toDomain(row);
  }

  async setCompleted(id: string, completed: boolean, userId: string): Promise<Todo> {
    const [row] = await this.db
      .update(todos)
      .set({ completed, updatedAt: sql`now()` })
      .where(and(eq(todos.id, id), eq(todos.userId, userId)))
      .returning();
    if (!row) throw new NotFoundError(`Todo ${id} not found`);
    return toDomain(row);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.db
      .delete(todos)
      .where(and(eq(todos.id, id), eq(todos.userId, userId)))
      .returning({ id: todos.id });
    if (result.length === 0) throw new NotFoundError(`Todo ${id} not found`);
  }
}
