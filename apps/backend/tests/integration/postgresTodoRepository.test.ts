import { describe, expect, it, beforeEach } from 'vitest';
import { TodoSchema } from '@bmad-todo/shared';
import { PostgresTodoRepository } from '../../src/repositories/postgresTodoRepository.js';
import { NotFoundError } from '../../src/errors.js';
import { POSTGRES_TESTS_ENABLED, setupPostgresTestDb, testDb } from './setup.js';

setupPostgresTestDb();

describe.skipIf(!POSTGRES_TESTS_ENABLED)('PostgresTodoRepository (integration)', () => {
  let repo: PostgresTodoRepository;

  beforeEach(() => {
    if (!testDb) throw new Error('testDb not initialized');
    repo = new PostgresTodoRepository(testDb);
  });

  it('create() inserts a row with default-user; returned object matches TodoSchema', async () => {
    const todo = await repo.create({ description: 'first todo' }, 'default-user');
    expect(() => TodoSchema.parse(todo)).not.toThrow();
    expect(todo.description).toBe('first todo');
    expect(todo.completed).toBe(false);
  });

  it('list() returns inserted rows ordered by created_at DESC', async () => {
    await repo.create({ description: 'first' }, 'default-user');
    await new Promise((r) => setTimeout(r, 30));
    await repo.create({ description: 'second' }, 'default-user');
    await new Promise((r) => setTimeout(r, 30));
    await repo.create({ description: 'third' }, 'default-user');

    const list = await repo.list('default-user');
    expect(list).toHaveLength(3);
    expect(list[0]?.description).toBe('third');
    expect(list[2]?.description).toBe('first');
  });

  it('setCompleted(id, true) flips the boolean and updates updated_at', async () => {
    const created = await repo.create({ description: 'toggle me' }, 'default-user');
    await new Promise((r) => setTimeout(r, 30));
    const updated = await repo.setCompleted(created.id, true, 'default-user');
    expect(updated.completed).toBe(true);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(created.createdAt).getTime(),
    );
  });

  it('setCompleted() for a non-existent id throws NotFoundError', async () => {
    await expect(
      repo.setCompleted('00000000-0000-0000-0000-000000000000', true, 'default-user'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('delete() removes the row; second delete throws NotFoundError', async () => {
    const created = await repo.create({ description: 'delete me' }, 'default-user');
    await repo.delete(created.id, 'default-user');
    await expect(repo.delete(created.id, 'default-user')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('SQL-injection-shaped string in description stored literally (NFR7)', async () => {
    const evilString = "'); DROP TABLE todos; --";
    const created = await repo.create({ description: evilString }, 'default-user');
    expect(created.description).toBe(evilString);
    // Table still exists if this query succeeds:
    const list = await repo.list('default-user');
    expect(list).toHaveLength(1);
    expect(list[0]?.description).toBe(evilString);
  });

  it('501-char description fails the DB CHECK constraint', async () => {
    if (!testDb) throw new Error('testDb not initialized');
    const longDesc = 'x'.repeat(501);
    // Bypass repository (which routes through Drizzle's typed input — no Zod here at the SQL layer)
    // by directly inserting via Drizzle. The DB CHECK should reject.
    await expect(
      testDb.execute(
        // Use raw SQL for the bypass
        // @ts-expect-error - intentional raw insert
        `INSERT INTO todos (description) VALUES ('${longDesc}')`,
      ),
    ).rejects.toThrowError();
  });
});
