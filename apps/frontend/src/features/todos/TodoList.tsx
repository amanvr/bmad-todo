import type { Todo } from '@bmad-todo/shared';
import { TodoItem } from './TodoItem.js';
import styles from './todos.module.css';

interface Props {
  todos: Todo[];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  mutatingIds: ReadonlySet<string>;
}

export function TodoList({ todos, onToggle, onDelete, mutatingIds }: Props) {
  if (todos.length === 0) return null;
  return (
    <ul className={styles.list}>
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onDelete={onDelete}
          isMutating={mutatingIds.has(todo.id)}
        />
      ))}
    </ul>
  );
}
