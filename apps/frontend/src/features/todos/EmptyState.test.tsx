import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState.js';

describe('EmptyState', () => {
  it('renders a status message', () => {
    render(<EmptyState />);
    expect(screen.getByRole('status')).toHaveTextContent(/no todos yet/i);
  });
});
