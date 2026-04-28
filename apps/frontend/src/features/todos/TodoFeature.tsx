import { AddTodoForm } from './AddTodoForm.js';
import { EmptyState } from './EmptyState.js';
import { ErrorState } from './ErrorState.js';
import { LoadingState } from './LoadingState.js';
import { MutationErrorBanner } from './MutationErrorBanner.js';
import { TodoList } from './TodoList.js';
import styles from './todos.module.css';
import { useTodos } from './useTodos.js';

export function TodoFeature() {
  const { state, actions } = useTodos();
  const renderContent = () => {
    if (state.status === 'error') {
      if (state.todos.length > 0 && state.error) {
        return (
          <>
            <ErrorState error={state.error} onRetry={actions.retry} />
            <TodoList
              todos={state.todos}
              onToggle={actions.setCompleted}
              onDelete={actions.delete}
              mutatingIds={state.mutatingIds}
            />
          </>
        );
      }

      if (state.error) {
        return <ErrorState error={state.error} onRetry={actions.retry} />;
      }
    }

    if (state.status === 'idle' || state.status === 'loading') {
      return <LoadingState />;
    }

    if (state.status === 'loaded' && state.todos.length === 0) {
      return <EmptyState />;
    }

    return (
      <TodoList
        todos={state.todos}
        onToggle={actions.setCompleted}
        onDelete={actions.delete}
        mutatingIds={state.mutatingIds}
      />
    );
  };
  const mutationError = state.status === 'loaded' ? state.error : null;

  return (
    <section className={styles.feature} aria-labelledby="todos-heading">
      <h2 id="todos-heading">Todos</h2>
      <AddTodoForm onCreate={actions.create} disabled={state.isMutating} />
      {mutationError && (
        <MutationErrorBanner error={mutationError} onDismiss={actions.dismissError} />
      )}
      {renderContent()}
    </section>
  );
}
