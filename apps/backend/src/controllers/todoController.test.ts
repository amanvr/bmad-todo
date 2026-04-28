import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { serializerCompiler, validatorCompiler } from '@fastify/type-provider-zod';
import { buildTodoController } from './todoController.js';
import type { TodoService } from '../services/todoService.js';

function createServiceMock(): TodoService {
  return {
    listTodos: vi.fn(),
    createTodo: vi.fn(),
    setCompleted: vi.fn(),
    deleteTodo: vi.fn(),
  } as unknown as TodoService;
}

describe('buildTodoController', () => {
  it('registers all todo routes and delegates to service with request userId', async () => {
    const service = createServiceMock();
    const app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    vi.mocked(service.listTodos).mockResolvedValue([
      {
        id: '37d866f5-e562-4f42-a9db-6be9f53f3b6f',
        description: 'list item',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    vi.mocked(service.createTodo).mockResolvedValue({
      id: 'ec65740c-86e8-4cd8-ae2c-4f333de0f7ad',
      description: 'created item',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(service.setCompleted).mockResolvedValue({
      id: 'ec65740c-86e8-4cd8-ae2c-4f333de0f7ad',
      description: 'created item',
      completed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(service.deleteTodo).mockResolvedValue(undefined);

    app.decorateRequest('userId', 'default-user');
    await app.register(buildTodoController(service));

    const listRes = await app.inject({ method: 'GET', url: '/api/todos' });
    expect(listRes.statusCode).toBe(200);
    expect(service.listTodos).toHaveBeenCalledWith('default-user');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { description: 'created item' },
    });
    expect(createRes.statusCode).toBe(201);
    expect(service.createTodo).toHaveBeenCalledWith(
      { description: 'created item' },
      'default-user',
    );

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/todos/ec65740c-86e8-4cd8-ae2c-4f333de0f7ad',
      payload: { completed: true },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(service.setCompleted).toHaveBeenCalledWith(
      'ec65740c-86e8-4cd8-ae2c-4f333de0f7ad',
      true,
      'default-user',
    );

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/api/todos/ec65740c-86e8-4cd8-ae2c-4f333de0f7ad',
    });
    expect(deleteRes.statusCode).toBe(204);
    expect(deleteRes.body).toBe('');
    expect(service.deleteTodo).toHaveBeenCalledWith(
      'ec65740c-86e8-4cd8-ae2c-4f333de0f7ad',
      'default-user',
    );

    await app.close();
  });

  it('returns 400 for invalid payloads before hitting service', async () => {
    const service = createServiceMock();
    const app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.decorateRequest('userId', 'default-user');
    await app.register(buildTodoController(service));

    const badCreateRes = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { description: '' },
    });
    expect(badCreateRes.statusCode).toBe(400);
    expect(service.createTodo).not.toHaveBeenCalled();

    const badPatchRes = await app.inject({
      method: 'PATCH',
      url: '/api/todos/not-a-uuid',
      payload: { completed: true },
    });
    expect(badPatchRes.statusCode).toBe(400);
    expect(service.setCompleted).not.toHaveBeenCalled();

    await app.close();
  });
});
