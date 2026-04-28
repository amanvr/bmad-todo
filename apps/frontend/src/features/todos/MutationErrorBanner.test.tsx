import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MutationErrorBanner } from './MutationErrorBanner.js';

describe('MutationErrorBanner', () => {
  it('renders message and dismiss button label', () => {
    render(
      <MutationErrorBanner
        error={{ code: 'INTERNAL_ERROR', message: 'Could not save' }}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByRole('button', { name: 'Dismiss error' })).toBeInTheDocument();
  });

  it('calls onDismiss when × is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <MutationErrorBanner
        error={{ code: 'INTERNAL_ERROR', message: 'Could not save' }}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
