import { describe, expect, it, vi } from 'vitest';
import { HttpApiError, httpRequest } from '../../shared/http.js';
import { todosApi } from './api.js';

vi.mock('../../shared/http.js', async () => {
  const actual = await vi.importActual('../../shared/http.js');
  return {
    ...actual,
    httpRequest: vi.fn(),
  };
});

describe('todosApi', () => {
  it('list() parses and returns Todo[]', async () => {
    vi.mocked(httpRequest).mockResolvedValueOnce([
      {
        id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
        description: 'Buy milk',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const result = await todosApi.list();
    expect(result).toHaveLength(1);
    expect(result[0]?.description).toBe('Buy milk');
  });

  it('create() posts JSON and parses returned todo', async () => {
    vi.mocked(httpRequest).mockResolvedValueOnce({
      id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
      description: 'Buy milk',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await todosApi.create({ description: 'Buy milk' });
    expect(result.description).toBe('Buy milk');
    expect(httpRequest).toHaveBeenCalledWith('/api/todos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'Buy milk' }),
    });
  });

  it('propagates HttpApiError from httpRequest on non-2xx', async () => {
    vi.mocked(httpRequest).mockRejectedValueOnce(
      new HttpApiError({ code: 'VALIDATION_FAILED', message: 'bad' }, 400),
    );
    await expect(todosApi.create({ description: 'x' })).rejects.toBeInstanceOf(HttpApiError);
  });

  it('setCompleted() PATCHes and returns parsed todo', async () => {
    vi.mocked(httpRequest).mockResolvedValueOnce({
      id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
      description: 'Buy milk',
      completed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await todosApi.setCompleted('adfba496-5ef3-49d3-b0b4-1975a8d352aa', true);
    expect(result.completed).toBe(true);
    expect(httpRequest).toHaveBeenCalledWith('/api/todos/adfba496-5ef3-49d3-b0b4-1975a8d352aa', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    });
  });

  it('setCompleted() propagates HttpApiError for 404', async () => {
    vi.mocked(httpRequest).mockRejectedValueOnce(
      new HttpApiError({ code: 'NOT_FOUND', message: 'x' }, 404),
    );

    await expect(
      todosApi.setCompleted('adfba496-5ef3-49d3-b0b4-1975a8d352aa', true),
    ).rejects.toBeInstanceOf(HttpApiError);
  });

  it('deleteOne() calls DELETE endpoint and resolves on 204', async () => {
    vi.mocked(httpRequest).mockResolvedValueOnce(undefined);

    await expect(
      todosApi.deleteOne('adfba496-5ef3-49d3-b0b4-1975a8d352aa'),
    ).resolves.toBeUndefined();
    expect(httpRequest).toHaveBeenCalledWith('/api/todos/adfba496-5ef3-49d3-b0b4-1975a8d352aa', {
      method: 'DELETE',
    });
  });

  it('deleteOne() propagates HttpApiError for 404', async () => {
    vi.mocked(httpRequest).mockRejectedValueOnce(
      new HttpApiError({ code: 'NOT_FOUND', message: 'missing' }, 404),
    );

    await expect(todosApi.deleteOne('adfba496-5ef3-49d3-b0b4-1975a8d352aa')).rejects.toBeInstanceOf(
      HttpApiError,
    );
  });
});
