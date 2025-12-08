import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  LoadingSpinner,
  LoadingOverlay,
  LoadingSkeleton,
  LoadingButton,
} from '../loading-states';

describe('Loading States', () => {
  describe('LoadingSpinner', () => {
    it('renders with default size', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
    });

    it('renders with custom size', () => {
      render(<LoadingSpinner size="lg" />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('h-8');
    });
  });

  describe('LoadingOverlay', () => {
    it('renders with message', () => {
      render(<LoadingOverlay message="Loading data..." />);
      expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });
  });

  describe('LoadingSkeleton', () => {
    it('renders card skeleton', () => {
      render(<LoadingSkeleton variant="card" />);
      const skeleton = screen.getByTestId('skeleton-card');
      expect(skeleton).toBeInTheDocument();
    });

    it('renders table skeleton with rows', () => {
      render(<LoadingSkeleton variant="table" rows={5} />);
      const rows = screen.getAllByTestId('skeleton-row');
      expect(rows).toHaveLength(5);
    });
  });

  describe('LoadingButton', () => {
    it('shows spinner when loading', () => {
      render(<LoadingButton isLoading>Submit</LoadingButton>);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });

    it('disables button when loading', () => {
      render(<LoadingButton isLoading>Submit</LoadingButton>);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });
});
