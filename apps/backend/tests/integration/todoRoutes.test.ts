import { beforeEach, describe, expect, it } from 'vitest';
import { TodoSchema } from '@bmad-todo/shared';
import { buildApp } from '../../src/app.js';
import type { Config } from '../../src/config.js';
import { POSTGRES_TESTS_ENABLED, TEST_DATABASE_URL, setupPostgresTestDb } from './setup.js';

setupPostgresTestDb();

const validConfig: Config = {
  NODE_ENV: 'test',
  BACKEND_PORT: 3000,
  DATABASE_URL: TEST_DATABASE_URL,
  CORS_ORIGINS: 'http://localhost:8080',
  LOG_LEVEL: 'silent' as Config['LOG_LEVEL'],
};

describe.skipIf(!POSTGRES_TESTS_ENABLED)('todo routes (integration)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp(validConfig);
  });

  it('POST /api/todos creates todo and GET /api/todos returns DESC order', async () => {
    const firstCreate = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { description: 'first' },
    });
    expect(firstCreate.statusCode).toBe(201);

    await new Promise((r) => setTimeout(r, 30));

    const secondCreate = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { description: 'second' },
    });
    expect(secondCreate.statusCode).toBe(201);
    const created = secondCreate.json();
    expect(() => TodoSchema.parse(created)).not.toThrow();

    const list = await app.inject({ method: 'GET', url: '/api/todos' });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject([{ description: 'second' }, { description: 'first' }]);
    await app.close();
  });

  it('POST /api/todos returns 400 for empty description', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { description: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    await app.close();
  });

  it('POST /api/todos returns 400 for missing body field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    await app.close();
  });

  it('POST /api/todos returns 400 for 501-char description', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { description: 'x'.repeat(501) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    await app.close();
  });

  it('GET /api/todos returns [] on empty database', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/todos' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    await app.close();
  });

  it('PATCH /api/todos/:id updates completion and updatedAt', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { description: 'toggle me' },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json();

    await new Promise((resolve) => setTimeout(resolve, 30));

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/todos/${created.id}`,
      payload: { completed: true },
    });
    expect(patched.statusCode).toBe(200);
    const updated = patched.json();
    expect(() => TodoSchema.parse(updated)).not.toThrow();
    expect(updated.completed).toBe(true);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(updated.createdAt).getTime(),
    );

    const toggledBack = await app.inject({
      method: 'PATCH',
      url: `/api/todos/${created.id}`,
      payload: { completed: false },
    });
    expect(toggledBack.statusCode).toBe(200);
    expect(toggledBack.json()).toMatchObject({ id: created.id, completed: false });
    await app.close();
  });

  it('PATCH /api/todos/:id returns 404 when todo does not exist', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/todos/11111111-1111-4111-8111-111111111111',
      payload: { completed: true },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    await app.close();
  });

  it('PATCH /api/todos/:id returns 400 for malformed id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/todos/not-a-uuid',
      payload: { completed: true },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    await app.close();
  });

  it('PATCH /api/todos/:id returns 400 for missing body field', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { description: 'to patch' },
    });
    const created = create.json();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/todos/${created.id}`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    await app.close();
  });

  it('PATCH /api/todos/:id returns 400 for invalid completed type', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { description: 'to patch' },
    });
    const created = create.json();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/todos/${created.id}`,
      payload: { completed: 'yes' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    await app.close();
  });

  it('DELETE /api/todos/:id removes existing todo and returns 204 empty body', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { description: 'delete me' },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json();

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/todos/${created.id}`,
    });
    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBe('');

    const list = await app.inject({ method: 'GET', url: '/api/todos' });
    expect(list.statusCode).toBe(200);
    expect(list.json().some((todo: { id: string }) => todo.id === created.id)).toBe(false);
    await app.close();
  });

  it('DELETE /api/todos/:id returns 404 on second delete of same id', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { description: 'delete twice' },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json();

    const firstDelete = await app.inject({
      method: 'DELETE',
      url: `/api/todos/${created.id}`,
    });
    expect(firstDelete.statusCode).toBe(204);

    const secondDelete = await app.inject({
      method: 'DELETE',
      url: `/api/todos/${created.id}`,
    });
    expect(secondDelete.statusCode).toBe(404);
    expect(secondDelete.json()).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    await app.close();
  });

  it('DELETE /api/todos/:id returns 400 for malformed id', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/todos/not-a-uuid',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    await app.close();
  });
});
