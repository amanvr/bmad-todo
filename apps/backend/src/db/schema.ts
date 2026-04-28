import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const todos = pgTable(
  'todos',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    description: text('description').notNull(),
    completed: boolean('completed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    userId: text('user_id').notNull().default('default-user'),
  },
  (table) => [
    check('todos_description_length_check', sql`length(${table.description}) BETWEEN 1 AND 500`),
    index('todos_user_id_idx').on(table.userId),
    index('todos_created_at_idx').on(table.createdAt),
  ],
);

export type TodoRow = typeof todos.$inferSelect;
export type TodoInsert = typeof todos.$inferInsert;
