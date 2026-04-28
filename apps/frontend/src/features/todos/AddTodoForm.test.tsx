import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddTodoForm } from './AddTodoForm.js';

describe('AddTodoForm', () => {
  it('exposes the new todo input with an accessible name', () => {
    render(<AddTodoForm onCreate={vi.fn()} disabled={false} />);
    expect(screen.getByRole('textbox', { name: /new todo/i })).toBeInTheDocument();
  });

  it('disables submit when description is empty', () => {
    render(<AddTodoForm onCreate={vi.fn()} disabled={false} />);
    expect(screen.getByRole('button', { name: /add todo/i })).toBeDisabled();
  });

  it('enables submit for valid trimmed description', () => {
    render(<AddTodoForm onCreate={vi.fn()} disabled={false} />);
    const input = screen.getByRole('textbox', { name: /new todo/i });
    fireEvent.change(input, { target: { value: '  Buy milk  ' } });
    expect(screen.getByRole('button', { name: /add todo/i })).toBeEnabled();
  });

  it('sets maxLength to 500 chars', () => {
    render(<AddTodoForm onCreate={vi.fn()} disabled={false} />);
    const input = screen.getByRole('textbox', { name: /new todo/i });
    expect(input).toHaveAttribute('maxlength', '500');
  });
});
