import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpApiError } from '../../shared/http.js';
import { todosApi } from './api.js';
import { useTodos } from './useTodos.js';

vi.mock('./api.js', () => ({
  todosApi: {
    list: vi.fn(),
    create: vi.fn(),
    setCompleted: vi.fn(),
    deleteOne: vi.fn(),
  },
}));

describe('useTodos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads todos on mount and sets loaded state', async () => {
    vi.mocked(todosApi.list).mockResolvedValueOnce([
      {
        id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
        description: 'Buy milk',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const { result } = renderHook(() => useTodos());

    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
    expect(result.current.state.todos).toHaveLength(1);
  });

  it('sets error state when load fails', async () => {
    vi.mocked(todosApi.list).mockRejectedValueOnce(
      new HttpApiError({ code: 'INTERNAL_ERROR', message: 'oops' }, 500),
    );

    const { result } = renderHook(() => useTodos());

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.error?.code).toBe('INTERNAL_ERROR');
  });

  it('setCompleted updates todo on success', async () => {
    const todo = {
      id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
      description: 'Buy milk',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(todosApi.list).mockResolvedValueOnce([todo]);
    vi.mocked(todosApi.setCompleted).mockResolvedValueOnce({ ...todo, completed: true });

    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));

    await act(async () => {
      await result.current.actions.setCompleted(todo.id, true);
    });

    expect(todosApi.setCompleted).toHaveBeenCalledWith(todo.id, true);
    await waitFor(() => expect(result.current.state.todos[0]?.completed).toBe(true));
  });

  it('setCompleted stores mutationFailedFor error on failure', async () => {
    const todo = {
      id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
      description: 'Buy milk',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(todosApi.list).mockResolvedValueOnce([todo]);
    vi.mocked(todosApi.setCompleted).mockRejectedValueOnce(
      new HttpApiError({ code: 'NOT_FOUND', message: 'missing' }, 404),
    );

    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));

    await act(async () => {
      await result.current.actions.setCompleted(todo.id, true);
    });

    await waitFor(() => expect(result.current.state.error?.code).toBe('NOT_FOUND'));
    expect(result.current.state.status).toBe('loaded');
    expect(result.current.state.todos).toHaveLength(1);
  });

  it('delete removes todo only after server success', async () => {
    const todo = {
      id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
      description: 'Buy milk',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(todosApi.list).mockResolvedValueOnce([todo]);
    vi.mocked(todosApi.deleteOne).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));

    await act(async () => {
      await result.current.actions.delete(todo.id);
    });

    expect(todosApi.deleteOne).toHaveBeenCalledWith(todo.id);
    await waitFor(() => expect(result.current.state.todos).toHaveLength(0));
  });

  it('delete stores mutationFailedFor error on failure', async () => {
    const todo = {
      id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
      description: 'Buy milk',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(todosApi.list).mockResolvedValueOnce([todo]);
    vi.mocked(todosApi.deleteOne).mockRejectedValueOnce(
      new HttpApiError({ code: 'NOT_FOUND', message: 'missing' }, 404),
    );

    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));

    await act(async () => {
      await result.current.actions.delete(todo.id);
    });

    await waitFor(() => expect(result.current.state.error?.code).toBe('NOT_FOUND'));
    expect(result.current.state.status).toBe('loaded');
    expect(result.current.state.todos).toHaveLength(1);
  });

  it('retry re-invokes list after a load failure', async () => {
    vi.mocked(todosApi.list)
      .mockRejectedValueOnce(new HttpApiError({ code: 'INTERNAL_ERROR', message: 'oops' }, 500))
      .mockResolvedValueOnce([]);

    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(todosApi.list).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.actions.retry();
    });

    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
    expect(todosApi.list).toHaveBeenCalledTimes(2);
  });

  it('dismissError clears mutation error without changing loaded state', async () => {
    const todo = {
      id: 'todo-id',
      description: 'Keep me visible',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(todosApi.list).mockResolvedValueOnce([todo]);
    vi.mocked(todosApi.create).mockRejectedValueOnce(
      new HttpApiError({ code: 'INTERNAL_ERROR', message: 'could not save' }, 500),
    );

    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));

    await act(async () => {
      await result.current.actions.create({ description: 'new todo' });
    });

    await waitFor(() => expect(result.current.state.error?.code).toBe('INTERNAL_ERROR'));
    expect(result.current.state.status).toBe('loaded');
    expect(result.current.state.todos).toHaveLength(1);

    act(() => {
      result.current.actions.dismissError();
    });

    expect(result.current.state.error).toBeNull();
    expect(result.current.state.status).toBe('loaded');
    expect(result.current.state.todos).toHaveLength(1);
  });

  it('replaces state wholesale on retry without stale rows (FR14)', async () => {
    const firstResponse = [
      {
        id: 'a',
        description: 'A',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'b',
        description: 'B',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const secondResponse = [
      {
        id: 'c',
        description: 'C',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    vi.mocked(todosApi.list)
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse);

    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
    expect(result.current.state.todos).toEqual(firstResponse);

    await act(async () => {
      result.current.actions.retry();
    });

    await waitFor(() => expect(result.current.state.todos).toEqual(secondResponse));
    expect(result.current.state.todos.find((todo) => todo.id === 'a')).toBeUndefined();
    expect(result.current.state.todos).toHaveLength(1);
  });
});
