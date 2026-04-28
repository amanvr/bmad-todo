import type { Todo } from '@bmad-todo/shared';
import styles from './todos.module.css';

interface Props {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  isMutating: boolean;
}

export function TodoItem({ todo, onToggle, onDelete, isMutating }: Props) {
  const actionLabel = todo.completed
    ? `Mark "${todo.description}" as incomplete`
    : `Mark "${todo.description}" as complete`;

  return (
    <li className={styles.item}>
      <label className={styles.itemLabel}>
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => !isMutating && onToggle(todo.id, !todo.completed)}
          disabled={isMutating}
          aria-label={actionLabel}
        />
        <span
          className={`${styles.description} ${todo.completed ? styles.descriptionCompleted : ''}`.trim()}
        >
          {todo.description}
        </span>
      </label>
      <button
        type="button"
        className={styles.deleteButton}
        onClick={() => !isMutating && onDelete(todo.id)}
        disabled={isMutating}
        aria-label={`Delete "${todo.description}"`}
      >
        Delete
      </button>
    </li>
  );
}
