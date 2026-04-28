import type { ApiError } from '@bmad-todo/shared';
import styles from './todos.module.css';

interface Props {
  error: ApiError;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: Props) {
  return (
    <div className={styles.errorState} role="alert">
      <p className={styles.errorMessage}>{error.message}</p>
      <button type="button" onClick={onRetry} className={styles.retryButton}>
        Try again
      </button>
    </div>
  );
}
