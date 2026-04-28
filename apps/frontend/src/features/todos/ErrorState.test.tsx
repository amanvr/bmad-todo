import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from './ErrorState.js';

describe('ErrorState', () => {
  it('renders error message and not code', () => {
    render(
      <ErrorState
        error={{ code: 'INTERNAL_ERROR', message: 'Server unavailable' }}
        onRetry={vi.fn()}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Server unavailable');
    expect(alert).not.toHaveTextContent('INTERNAL_ERROR');
  });

  it('calls onRetry when Try again is clicked', () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        error={{ code: 'INTERNAL_ERROR', message: 'Server unavailable' }}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
