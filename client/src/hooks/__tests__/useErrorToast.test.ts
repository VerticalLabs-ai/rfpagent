import { describe, it, expect } from 'vitest';
import { showErrorToast, showSuccessToast } from '../useErrorToast';

describe('useErrorToast', () => {
  describe('showErrorToast', () => {
    it('parses API error and returns ParsedError', () => {
      const error = new Error('404: {"error":{"code":"NOT_FOUND","message":"RFP not found"}}');

      const result = showErrorToast(error);

      expect(result).toEqual(
        expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'RFP not found',
          isRetryable: false,
        })
      );
    });

    it('parses network error as retryable', () => {
      const error = new TypeError('Failed to fetch');

      const result = showErrorToast(error);

      expect(result).toEqual(
        expect.objectContaining({
          code: 'NETWORK_ERROR',
          isRetryable: true,
        })
      );
    });

    it('handles plain text errors', () => {
      const result = showErrorToast('Internal Server Error');

      expect(result).toEqual(
        expect.objectContaining({
          code: 'UNKNOWN_ERROR',
          message: 'Internal Server Error',
          isRetryable: false,
        })
      );
    });
  });

  describe('showSuccessToast', () => {
    it('can be called without errors', () => {
      expect(() => showSuccessToast('Success', 'Operation completed')).not.toThrow();
    });
  });
});
