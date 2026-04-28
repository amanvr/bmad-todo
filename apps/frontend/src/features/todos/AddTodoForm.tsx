import { useState, type FormEvent } from 'react';
import type { CreateTodoInput } from '@bmad-todo/shared';
import styles from './todos.module.css';

interface Props {
  onCreate: (input: CreateTodoInput) => Promise<void>;
  disabled: boolean;
}

export function AddTodoForm({ onCreate, disabled }: Props) {
  const [description, setDescription] = useState('');
  const trimmed = description.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 500 && !disabled;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    await onCreate({ description: trimmed });
    setDescription('');
  };

  return (
    <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
      <label className={styles.formLabel}>
        New todo
        <input
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          placeholder="What needs doing?"
          required
        />
      </label>
      <button type="submit" disabled={!canSubmit}>
        {disabled ? 'Adding...' : 'Add todo'}
      </button>
    </form>
  );
}
