import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TodoItem } from './TodoItem.js';
import styles from './todos.module.css';

describe('TodoItem', () => {
  it('renders full todo description', () => {
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    render(
      <ul>
        <TodoItem
          todo={{
            id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
            description: 'Buy milk',
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          onToggle={onToggle}
          onDelete={onDelete}
          isMutating={false}
        />
      </ul>,
    );
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });

  it('clicking checkbox toggles completion', () => {
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    render(
      <ul>
        <TodoItem
          todo={{
            id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
            description: 'Buy milk',
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          onToggle={onToggle}
          onDelete={onDelete}
          isMutating={false}
        />
      </ul>,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /mark "buy milk" as complete/i }));
    expect(onToggle).toHaveBeenCalledWith('adfba496-5ef3-49d3-b0b4-1975a8d352aa', true);
  });

  it('disables checkbox while mutating', () => {
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    render(
      <ul>
        <TodoItem
          todo={{
            id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
            description: 'Buy milk',
            completed: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          onToggle={onToggle}
          onDelete={onDelete}
          isMutating
        />
      </ul>,
    );

    const checkbox = screen.getByRole('checkbox', { name: /mark "buy milk" as incomplete/i });
    expect(checkbox).toBeDisabled();
    expect(checkbox).toHaveAccessibleName('Mark "Buy milk" as incomplete');
  });

  it('clicking delete invokes onDelete(todo.id)', () => {
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    render(
      <ul>
        <TodoItem
          todo={{
            id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
            description: 'Buy milk',
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          onToggle={onToggle}
          onDelete={onDelete}
          isMutating={false}
        />
      </ul>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete "Buy milk"' }));
    expect(onDelete).toHaveBeenCalledWith('adfba496-5ef3-49d3-b0b4-1975a8d352aa');
  });

  it('disables delete button while mutating and does not invoke onDelete', () => {
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    render(
      <ul>
        <TodoItem
          todo={{
            id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
            description: 'Buy milk',
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          onToggle={onToggle}
          onDelete={onDelete}
          isMutating
        />
      </ul>,
    );

    const button = screen.getByRole('button', { name: 'Delete "Buy milk"' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('applies completed class on description when todo is completed', () => {
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    render(
      <ul>
        <TodoItem
          todo={{
            id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
            description: 'Buy milk',
            completed: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          onToggle={onToggle}
          onDelete={onDelete}
          isMutating={false}
        />
      </ul>,
    );

    expect(screen.getByText('Buy milk')).toHaveClass(styles.descriptionCompleted);
  });

  it('omits completed class on description when todo is active', () => {
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    render(
      <ul>
        <TodoItem
          todo={{
            id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
            description: 'Buy milk',
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          onToggle={onToggle}
          onDelete={onDelete}
          isMutating={false}
        />
      </ul>,
    );

    expect(screen.getByText('Buy milk')).not.toHaveClass(styles.descriptionCompleted);
  });
});
