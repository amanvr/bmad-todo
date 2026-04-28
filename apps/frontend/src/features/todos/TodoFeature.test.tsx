import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TodoFeature } from './TodoFeature.js';
import { useTodos } from './useTodos.js';

vi.mock('./useTodos.js', () => ({
  useTodos: vi.fn(),
}));

describe('TodoFeature', () => {
  it('shows loading state when status is loading', () => {
    vi.mocked(useTodos).mockReturnValue({
      state: {
        todos: [],
        status: 'loading',
        error: null,
        isMutating: false,
        mutatingIds: new Set<string>(),
      },
      actions: {
        create: vi.fn(),
        setCompleted: vi.fn(),
        delete: vi.fn(),
        retry: vi.fn(),
        dismissError: vi.fn(),
      },
    });

    render(<TodoFeature />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading todos');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows loading state when status is idle', () => {
    vi.mocked(useTodos).mockReturnValue({
      state: {
        todos: [],
        status: 'idle',
        error: null,
        isMutating: false,
        mutatingIds: new Set<string>(),
      },
      actions: {
        create: vi.fn(),
        setCompleted: vi.fn(),
        delete: vi.fn(),
        retry: vi.fn(),
        dismissError: vi.fn(),
      },
    });

    render(<TodoFeature />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading todos');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows empty state when todos list is empty and loaded', () => {
    vi.mocked(useTodos).mockReturnValue({
      state: {
        todos: [],
        status: 'loaded',
        error: null,
        isMutating: false,
        mutatingIds: new Set<string>(),
      },
      actions: {
        create: vi.fn(),
        setCompleted: vi.fn(),
        delete: vi.fn(),
        retry: vi.fn(),
        dismissError: vi.fn(),
      },
    });

    render(<TodoFeature />);

    expect(screen.getByRole('status')).toHaveTextContent('No todos yet');
  });

  it('shows todo list when loaded with todos', () => {
    vi.mocked(useTodos).mockReturnValue({
      state: {
        todos: [
          {
            id: 'adfba496-5ef3-49d3-b0b4-1975a8d352aa',
            description: 'Buy milk',
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        status: 'loaded',
        error: null,
        isMutating: false,
        mutatingIds: new Set<string>(),
      },
      actions: {
        create: vi.fn(),
        setCompleted: vi.fn(),
        delete: vi.fn(),
        retry: vi.fn(),
        dismissError: vi.fn(),
      },
    });

    render(<TodoFeature />);

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });

  it('renders ErrorState only when status is error and no todos', () => {
    vi.mocked(useTodos).mockReturnValue({
      state: {
        todos: [],
        status: 'error',
        error: { code: 'INTERNAL_ERROR', message: 'Backend offline' },
        isMutating: false,
        mutatingIds: new Set<string>(),
      },
      actions: {
        create: vi.fn(),
        setCompleted: vi.fn(),
        delete: vi.fn(),
        retry: vi.fn(),
        dismissError: vi.fn(),
      },
    });

    render(<TodoFeature />);
    expect(screen.getByRole('alert')).toHaveTextContent('Backend offline');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders ErrorState and TodoList when status is error and todos exist', () => {
    vi.mocked(useTodos).mockReturnValue({
      state: {
        todos: [
          {
            id: 'todo-id',
            description: 'Persisted todo',
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        status: 'error',
        error: { code: 'INTERNAL_ERROR', message: 'Retry failed' },
        isMutating: false,
        mutatingIds: new Set<string>(),
      },
      actions: {
        create: vi.fn(),
        setCompleted: vi.fn(),
        delete: vi.fn(),
        retry: vi.fn(),
        dismissError: vi.fn(),
      },
    });

    render(<TodoFeature />);
    expect(screen.getByRole('alert')).toHaveTextContent('Retry failed');
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText('Persisted todo')).toBeInTheDocument();
  });

  it('renders inline mutation error with todo list when loaded has error', () => {
    vi.mocked(useTodos).mockReturnValue({
      state: {
        todos: [
          {
            id: 'todo-id',
            description: 'Existing todo',
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        status: 'loaded',
        error: { code: 'INTERNAL_ERROR', message: 'Could not save' },
        isMutating: false,
        mutatingIds: new Set<string>(),
      },
      actions: {
        create: vi.fn(),
        setCompleted: vi.fn(),
        delete: vi.fn(),
        retry: vi.fn(),
        dismissError: vi.fn(),
      },
    });

    render(<TodoFeature />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByRole('button', { name: 'Dismiss error' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('does not render error UI when loaded and error is null', () => {
    vi.mocked(useTodos).mockReturnValue({
      state: {
        todos: [
          {
            id: 'todo-id',
            description: 'Normal todo',
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        status: 'loaded',
        error: null,
        isMutating: false,
        mutatingIds: new Set<string>(),
      },
      actions: {
        create: vi.fn(),
        setCompleted: vi.fn(),
        delete: vi.fn(),
        retry: vi.fn(),
        dismissError: vi.fn(),
      },
    });

    render(<TodoFeature />);
    expect(screen.queryByRole('button', { name: 'Dismiss error' })).not.toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('applies the responsive feature class to the section', () => {
    vi.mocked(useTodos).mockReturnValue({
      state: {
        todos: [],
        status: 'loaded',
        error: null,
        isMutating: false,
        mutatingIds: new Set<string>(),
      },
      actions: {
        create: vi.fn(),
        setCompleted: vi.fn(),
        delete: vi.fn(),
        retry: vi.fn(),
        dismissError: vi.fn(),
      },
    });

    const { container } = render(<TodoFeature />);
    const section = container.querySelector('section');
    expect(section?.className).toMatch(/feature/);
  });
});
