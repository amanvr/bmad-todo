import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingState } from './LoadingState.js';

describe('LoadingState', () => {
  it('renders a polite live-region with loading text', () => {
    render(<LoadingState />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/loading todos/i);
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});
