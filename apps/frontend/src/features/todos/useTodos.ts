import { useCallback, useEffect, useReducer } from 'react';
import type { ApiError, CreateTodoInput } from '@bmad-todo/shared';
import { HttpApiError } from '../../shared/http.js';
import { todosApi } from './api.js';
import { initialState, todosReducer, type TodosState } from './todosReducer.js';

function toApiError(err: unknown): ApiError {
  if (err instanceof HttpApiError) {
    return err.apiError;
  }
  return { code: 'INTERNAL_ERROR', message: String(err) };
}

export interface UseTodosResult {
  state: TodosState;
  actions: {
    create: (input: CreateTodoInput) => Promise<void>;
    setCompleted: (id: string, completed: boolean) => Promise<void>;
    delete: (id: string) => Promise<void>;
    retry: () => void;
    dismissError: () => void;
  };
}

export function useTodos(): UseTodosResult {
  const [state, dispatch] = useReducer(todosReducer, initialState);

  const load = useCallback(async () => {
    dispatch({ type: 'loadingStarted' });
    try {
      const todos = await todosApi.list();
      dispatch({ type: 'todosLoaded', todos });
    } catch (err) {
      dispatch({ type: 'loadingFailed', error: toApiError(err) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async (input: CreateTodoInput): Promise<void> => {
    dispatch({ type: 'mutationStarted' });
    try {
      const todo = await todosApi.create(input);
      dispatch({ type: 'todoCreated', todo });
    } catch (err) {
      dispatch({ type: 'mutationFailed', error: toApiError(err) });
    }
  }, []);

  const setCompleted = useCallback(async (id: string, completed: boolean): Promise<void> => {
    dispatch({ type: 'mutationStartedFor', id });
    try {
      const todo = await todosApi.setCompleted(id, completed);
      dispatch({ type: 'todoCompletionToggled', todo });
    } catch (err) {
      dispatch({ type: 'mutationFailedFor', id, error: toApiError(err) });
    }
  }, []);

  const deleteAction = useCallback(async (id: string): Promise<void> => {
    dispatch({ type: 'mutationStartedFor', id });
    try {
      await todosApi.deleteOne(id);
      dispatch({ type: 'todoDeleted', id });
    } catch (err) {
      dispatch({ type: 'mutationFailedFor', id, error: toApiError(err) });
    }
  }, []);

  const dismissError = useCallback(() => {
    dispatch({ type: 'mutationErrorDismissed' });
  }, []);

  return {
    state,
    actions: {
      create,
      setCompleted,
      delete: deleteAction,
      retry: () => void load(),
      dismissError,
    },
  };
}
