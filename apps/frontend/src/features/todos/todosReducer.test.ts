import { describe, expect, it } from 'vitest';
import { initialState, todosReducer } from './todosReducer.js';

describe('todosReducer', () => {
  it('todosLoaded sets loaded status and clears error', () => {
    const todos = [
      {
        id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
        description: 'Buy milk',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const next = todosReducer(initialState, { type: 'todosLoaded', todos });
    expect(next.status).toBe('loaded');
    expect(next.todos).toEqual(todos);
    expect(next.error).toBeNull();
  });

  it('todoCreated prepends immutably', () => {
    const existing = [
      {
        id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
        description: 'Existing',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const state = { ...initialState, todos: existing };
    const created = {
      id: '0f723d84-ad9f-4d9f-bdf5-5fbdf8ed6d4a',
      description: 'New item',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const next = todosReducer(state, { type: 'todoCreated', todo: created });
    expect(next.todos[0]).toEqual(created);
    expect(next.todos[1]).toEqual(existing[0]);
    expect(next.todos).not.toBe(existing);
  });

  it('loadingFailed sets error status and payload', () => {
    const error = { code: 'INTERNAL_ERROR' as const, message: 'boom' };
    const existingTodos = [
      {
        id: 'persisted-id',
        description: 'Keep me',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const prior = { ...initialState, status: 'loaded' as const, todos: existingTodos };
    const next = todosReducer(prior, { type: 'loadingFailed', error });
    expect(next.status).toBe('error');
    expect(next.error).toEqual(error);
    expect(next.todos).toBe(existingTodos);
  });

  it('mutationStartedFor tracks mutating id and sets isMutating', () => {
    const next = todosReducer(initialState, {
      type: 'mutationStartedFor',
      id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
    });

    expect(next.isMutating).toBe(true);
    expect(next.mutatingIds.has('adfba496-5ef3-49d3-b0b4-1975a8d352aa')).toBe(true);
  });

  it('todoCompletionToggled updates matching item immutably', () => {
    const originalTodos = [
      {
        id: '1a7ba496-5ef3-49d3-b0b4-1975a8d352aa',
        description: 'First',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2b7ba496-5ef3-49d3-b0b4-1975a8d352aa',
        description: 'Second',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const state = {
      ...initialState,
      todos: originalTodos,
      mutatingIds: new Set(['1a7ba496-5ef3-49d3-b0b4-1975a8d352aa']),
      isMutating: true,
    };

    const next = todosReducer(state, {
      type: 'todoCompletionToggled',
      todo: { ...originalTodos[0], completed: true },
    });

    expect(next.todos[0]?.completed).toBe(true);
    expect(next.todos[1]).toBe(originalTodos[1]);
    expect(next.mutatingIds.has('1a7ba496-5ef3-49d3-b0b4-1975a8d352aa')).toBe(false);
  });

  it('mutationFailedFor removes mutating id and stores error', () => {
    const state = {
      ...initialState,
      status: 'loaded' as const,
      mutatingIds: new Set(['adfba496-5ef3-49d3-b0b4-1975a8d352aa']),
      isMutating: true,
    };
    const error = { code: 'NOT_FOUND' as const, message: 'missing' };
    const next = todosReducer(state, {
      type: 'mutationFailedFor',
      id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
      error,
    });

    expect(next.isMutating).toBe(false);
    expect(next.mutatingIds.size).toBe(0);
    expect(next.error).toEqual(error);
    expect(next.status).toBe('loaded');
  });

  it('mutationErrorDismissed clears error and keeps status/todos', () => {
    const todos = [
      {
        id: 'todo-id',
        description: 'Existing',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const state = {
      ...initialState,
      status: 'loaded' as const,
      todos,
      error: { code: 'INTERNAL_ERROR' as const, message: 'failed mutation' },
    };

    const next = todosReducer(state, { type: 'mutationErrorDismissed' });
    expect(next.error).toBeNull();
    expect(next.status).toBe('loaded');
    expect(next.todos).toBe(todos);
  });

  it('loadingStarted clears existing error', () => {
    const state = {
      ...initialState,
      status: 'error' as const,
      error: { code: 'INTERNAL_ERROR' as const, message: 'old error' },
    };

    const next = todosReducer(state, { type: 'loadingStarted' });
    expect(next.status).toBe('loading');
    expect(next.error).toBeNull();
  });

  it('todoDeleted removes only matching todo immutably', () => {
    const first = {
      id: '1a7ba496-5ef3-49d3-b0b4-1975a8d352aa',
      description: 'First',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const second = {
      id: '2b7ba496-5ef3-49d3-b0b4-1975a8d352aa',
      description: 'Second',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const state = {
      ...initialState,
      todos: [first, second],
      mutatingIds: new Set([first.id]),
      isMutating: true,
    };

    const next = todosReducer(state, { type: 'todoDeleted', id: first.id });

    expect(next.todos).toHaveLength(1);
    expect(next.todos[0]).toBe(second);
    expect(next.todos).not.toBe(state.todos);
    expect(next.mutatingIds.size).toBe(0);
    expect(next.isMutating).toBe(false);
  });
});
