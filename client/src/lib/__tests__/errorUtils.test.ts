import { describe, it, expect } from 'vitest';
import {
  parseApiError,
  getErrorMessage,
  isRetryableError,
} from '../errorUtils';

describe('errorUtils', () => {
  describe('parseApiError', () => {
    it('parses standard API error response', () => {
      const errorText = JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required',
          field: 'email',
        },
      });

      const result = parseApiError(errorText);

      expect(result).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Email is required',
        field: 'email',
        isRetryable: false,
      });
    });

    it('handles plain text error response', () => {
      const result = parseApiError('Internal Server Error');

      expect(result).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Internal Server Error',
        field: undefined,
        isRetryable: false,
      });
    });

    it('handles network errors', () => {
      const error = new TypeError('Failed to fetch');

      const result = parseApiError(error);

      expect(result).toEqual({
        code: 'NETWORK_ERROR',
        message:
          'Unable to connect to server. Please check your internet connection.',
        field: undefined,
        isRetryable: true,
      });
    });
  });

  describe('getErrorMessage', () => {
    it('returns field-specific message for validation errors', () => {
      const message = getErrorMessage(
        'VALIDATION_ERROR',
        'Invalid format',
        'email'
      );
      expect(message).toBe('Email: Invalid format');
    });

    it('returns user-friendly message for known error codes', () => {
      expect(getErrorMessage('NOT_FOUND', 'Resource not found')).toBe(
        'The requested item could not be found.'
      );
      expect(getErrorMessage('RATE_LIMIT_EXCEEDED', 'Too many requests')).toBe(
        'Too many requests. Please wait a moment and try again.'
      );
      expect(getErrorMessage('SERVICE_UNAVAILABLE', 'Service down')).toBe(
        'The service is temporarily unavailable. Please try again later.'
      );
    });
  });

  describe('isRetryableError', () => {
    it('returns true for network errors', () => {
      expect(isRetryableError('NETWORK_ERROR')).toBe(true);
    });

    it('returns true for service unavailable', () => {
      expect(isRetryableError('SERVICE_UNAVAILABLE')).toBe(true);
    });

    it('returns true for rate limit errors', () => {
      expect(isRetryableError('RATE_LIMIT_EXCEEDED')).toBe(true);
    });

    it('returns false for validation errors', () => {
      expect(isRetryableError('VALIDATION_ERROR')).toBe(false);
    });

    it('returns false for not found errors', () => {
      expect(isRetryableError('NOT_FOUND')).toBe(false);
    });
  });
});
