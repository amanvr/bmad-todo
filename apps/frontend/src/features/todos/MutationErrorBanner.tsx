import type { ApiError } from '@bmad-todo/shared';
import styles from './todos.module.css';

interface Props {
  error: ApiError;
  onDismiss: () => void;
}

export function MutationErrorBanner({ error, onDismiss }: Props) {
  return (
    <div className={styles.mutationErrorBanner} role="alert">
      <span className={styles.mutationErrorMessage}>{error.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className={styles.mutationErrorDismiss}
        aria-label="Dismiss error"
      >
        ×
      </button>
    </div>
  );
}
