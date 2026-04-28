import type { ApiError, Todo } from '@bmad-todo/shared';

export type TodosState = {
  todos: Todo[];
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: ApiError | null;
  isMutating: boolean;
  mutatingIds: ReadonlySet<string>;
};

export const initialState: TodosState = {
  todos: [],
  status: 'idle',
  error: null,
  isMutating: false,
  mutatingIds: new Set<string>(),
};

export type TodosAction =
  | { type: 'loadingStarted' }
  | { type: 'todosLoaded'; todos: Todo[] }
  | { type: 'loadingFailed'; error: ApiError }
  | { type: 'mutationStarted' }
  | { type: 'todoCreated'; todo: Todo }
  | { type: 'mutationFailed'; error: ApiError }
  | { type: 'mutationStartedFor'; id: string }
  | { type: 'todoCompletionToggled'; todo: Todo }
  | { type: 'todoDeleted'; id: string }
  | { type: 'mutationFailedFor'; id: string; error: ApiError }
  | { type: 'mutationErrorDismissed' };

export function todosReducer(state: TodosState, action: TodosAction): TodosState {
  switch (action.type) {
    case 'loadingStarted':
      return { ...state, status: 'loading', error: null };
    case 'todosLoaded':
      return { ...state, status: 'loaded', todos: action.todos, error: null };
    case 'loadingFailed':
      return { ...state, status: 'error', error: action.error };
    case 'mutationStarted':
      return { ...state, isMutating: true };
    case 'todoCreated':
      return {
        ...state,
        todos: [action.todo, ...state.todos],
        isMutating: false,
        error: null,
      };
    case 'mutationFailed':
      return { ...state, isMutating: false, error: action.error };
    case 'mutationStartedFor': {
      const next = new Set(state.mutatingIds);
      next.add(action.id);
      return { ...state, isMutating: true, mutatingIds: next };
    }
    case 'todoCompletionToggled': {
      const next = new Set(state.mutatingIds);
      next.delete(action.todo.id);
      return {
        ...state,
        todos: state.todos.map((todo) => (todo.id === action.todo.id ? action.todo : todo)),
        isMutating: next.size > 0,
        mutatingIds: next,
        error: null,
      };
    }
    case 'todoDeleted': {
      const next = new Set(state.mutatingIds);
      next.delete(action.id);
      return {
        ...state,
        todos: state.todos.filter((todo) => todo.id !== action.id),
        isMutating: next.size > 0,
        mutatingIds: next,
        error: null,
      };
    }
    case 'mutationFailedFor': {
      const next = new Set(state.mutatingIds);
      next.delete(action.id);
      return { ...state, isMutating: next.size > 0, mutatingIds: next, error: action.error };
    }
    case 'mutationErrorDismissed':
      return { ...state, error: null };
  }
}
