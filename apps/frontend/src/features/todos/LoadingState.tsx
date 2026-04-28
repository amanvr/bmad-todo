import styles from './todos.module.css';

export function LoadingState() {
  return (
    <p className={styles.loadingState} role="status" aria-live="polite">
      Loading todos...
    </p>
  );
}
