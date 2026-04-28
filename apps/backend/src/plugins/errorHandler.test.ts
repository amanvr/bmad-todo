import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import errorHandler from './errorHandler.js';
import { ValidationError, NotFoundError } from '../errors.js';

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(errorHandler);
  return app;
}

describe('errorHandler plugin', () => {
  it('AppError produces the typed envelope', async () => {
    const app = await buildTestApp();
    app.get('/notfound', async () => {
      throw new NotFoundError('Todo abc not found');
    });
    const res = await app.inject({ method: 'GET', url: '/notfound' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Todo abc not found' },
    });
    await app.close();
  });

  it('ValidationError envelope includes details', async () => {
    const app = await buildTestApp();
    app.get('/bad', async () => {
      throw new ValidationError('description must be 1-500 chars', { field: 'description' });
    });
    const res = await app.inject({ method: 'GET', url: '/bad' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'description must be 1-500 chars',
        details: { field: 'description' },
      },
    });
    await app.close();
  });

  it('non-AppError produces INTERNAL_ERROR envelope', async () => {
    const app = await buildTestApp();
    app.get('/boom', async () => {
      throw new Error('something exploded');
    });
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    await app.close();
  });
});
