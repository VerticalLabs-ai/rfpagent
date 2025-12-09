import { DownloadError, DownloadErrorCode } from '../../server/services/downloads/browserbaseDownloadService';

describe('DownloadError', () => {
  describe('constructor', () => {
    it('should create error with required properties', () => {
      const error = new DownloadError('Test error', 'NETWORK_ERROR', true);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DownloadError);
      expect(error.name).toBe('DownloadError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.isRetryable).toBe(true);
      expect(error.details).toBeUndefined();
    });

    it('should create error with details', () => {
      const details = { filename: 'test.pdf', attempt: 2 };
      const error = new DownloadError('Test error', 'NOT_FOUND', false, details);

      expect(error.details).toEqual(details);
    });

    it('should default isRetryable to false', () => {
      const error = new DownloadError('Test error', 'ACCESS_DENIED');

      expect(error.isRetryable).toBe(false);
    });
  });

  describe('fromHttpStatus', () => {
    it.each([
      [400, 'UNKNOWN_ERROR', false],
      [401, 'ACCESS_DENIED', false],
      [403, 'ACCESS_DENIED', false],
      [404, 'NOT_FOUND', false],
      [408, 'TIMEOUT_ERROR', true],
      [429, 'NETWORK_ERROR', true],
      [500, 'NETWORK_ERROR', true],
      [502, 'NETWORK_ERROR', true],
      [503, 'NETWORK_ERROR', true],
      [504, 'TIMEOUT_ERROR', true],
    ])('should map HTTP %d to code %s with retryable=%s', (status, expectedCode, expectedRetryable) => {
      const error = DownloadError.fromHttpStatus(status);

      expect(error.code).toBe(expectedCode);
      expect(error.isRetryable).toBe(expectedRetryable);
      expect(error.details?.httpStatus).toBe(status);
    });

    it('should use custom message when provided', () => {
      const error = DownloadError.fromHttpStatus(404, 'Custom not found message');

      expect(error.message).toBe('Custom not found message');
    });

    it('should use default message when not provided', () => {
      const error = DownloadError.fromHttpStatus(403);

      expect(error.message).toBe('Access denied - insufficient permissions to download');
    });

    it('should include additional details', () => {
      const error = DownloadError.fromHttpStatus(500, undefined, { url: 'http://example.com' });

      expect(error.details?.url).toBe('http://example.com');
      expect(error.details?.httpStatus).toBe(500);
    });

    it('should handle unknown status codes >= 500 as NETWORK_ERROR', () => {
      const error = DownloadError.fromHttpStatus(599);

      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.isRetryable).toBe(true);
    });

    it('should handle unknown status codes < 500 as UNKNOWN_ERROR', () => {
      const error = DownloadError.fromHttpStatus(418); // I'm a teapot

      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('sizeMismatch', () => {
    it('should create size mismatch error with formatted sizes', () => {
      const error = DownloadError.sizeMismatch(1024, 2048, 'document.pdf');

      expect(error.code).toBe('SIZE_MISMATCH');
      expect(error.isRetryable).toBe(false);
      expect(error.message).toContain('document.pdf');
      expect(error.message).toContain('1.00 KB');
      expect(error.message).toContain('2.00 KB');
      expect(error.details?.actualSize).toBe(1024);
      expect(error.details?.expectedSize).toBe(2048);
      expect(error.details?.filename).toBe('document.pdf');
    });

    it('should work without filename', () => {
      const error = DownloadError.sizeMismatch(100, 200);

      expect(error.message).not.toContain('for ');
      expect(error.details?.filename).toBeUndefined();
    });

    it('should format MB sizes correctly', () => {
      const error = DownloadError.sizeMismatch(2 * 1024 * 1024, 3 * 1024 * 1024);

      expect(error.message).toContain('2.00 MB');
      expect(error.message).toContain('3.00 MB');
    });

    it('should calculate percentage difference', () => {
      const error = DownloadError.sizeMismatch(1500, 1000);

      expect(error.details?.difference).toBeCloseTo(50, 1);
    });
  });

  describe('corruptFile', () => {
    it('should create corrupt file error', () => {
      const error = DownloadError.corruptFile('test.pdf', 'Invalid PDF header');

      expect(error.code).toBe('CORRUPT_FILE');
      expect(error.isRetryable).toBe(false);
      expect(error.message).toContain('test.pdf');
      expect(error.message).toContain('Invalid PDF header');
      expect(error.details?.filename).toBe('test.pdf');
      expect(error.details?.reason).toBe('Invalid PDF header');
    });

    it('should include additional details', () => {
      const error = DownloadError.corruptFile('test.pdf', 'reason', { checksumExpected: 'abc123' });

      expect(error.details?.checksumExpected).toBe('abc123');
    });
  });

  describe('storageError', () => {
    it('should create storage error for upload', () => {
      const error = DownloadError.storageError('upload', 'Bucket not found');

      expect(error.code).toBe('STORAGE_ERROR');
      expect(error.isRetryable).toBe(true); // Storage errors are retryable
      expect(error.message).toContain('upload');
      expect(error.message).toContain('Bucket not found');
      expect(error.details?.operation).toBe('upload');
    });

    it('should create storage error for download', () => {
      const error = DownloadError.storageError('download', 'Connection refused');

      expect(error.details?.operation).toBe('download');
    });

    it('should create storage error for delete', () => {
      const error = DownloadError.storageError('delete', 'Permission denied');

      expect(error.details?.operation).toBe('delete');
    });
  });

  describe('timeout', () => {
    it('should create timeout error', () => {
      const error = DownloadError.timeout('retrieveDownloads', 30000);

      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.isRetryable).toBe(true);
      expect(error.message).toContain('retrieveDownloads');
      expect(error.message).toContain('30000ms');
      expect(error.details?.operation).toBe('retrieveDownloads');
      expect(error.details?.timeoutMs).toBe(30000);
    });
  });

  describe('fromError', () => {
    it('should return same error if already DownloadError', () => {
      const original = new DownloadError('Original', 'NOT_FOUND', false);
      const result = DownloadError.fromError(original);

      expect(result).toBe(original);
    });

    it('should detect timeout errors from message', () => {
      const error = new Error('Connection timed out');
      const result = DownloadError.fromError(error);

      expect(result.code).toBe('TIMEOUT_ERROR');
      expect(result.isRetryable).toBe(true);
    });

    it('should detect network errors from message', () => {
      const testCases = [
        'ECONNREFUSED',
        'ECONNRESET',
        'Network error',
        'socket hang up',
      ];

      for (const msg of testCases) {
        const error = new Error(msg);
        const result = DownloadError.fromError(error);

        expect(result.code).toBe('NETWORK_ERROR');
        expect(result.isRetryable).toBe(true);
      }
    });

    it('should detect access denied errors from message', () => {
      const testCases = [
        'Permission denied',
        'Forbidden',
        'Access denied',
      ];

      for (const msg of testCases) {
        const error = new Error(msg);
        const result = DownloadError.fromError(error);

        expect(result.code).toBe('ACCESS_DENIED');
        expect(result.isRetryable).toBe(false);
      }
    });

    it('should detect not found errors from message', () => {
      const testCases = [
        'File not found',
        '404 error',
      ];

      for (const msg of testCases) {
        const error = new Error(msg);
        const result = DownloadError.fromError(error);

        expect(result.code).toBe('NOT_FOUND');
        expect(result.isRetryable).toBe(false);
      }
    });

    it('should use default code for unknown errors', () => {
      const error = new Error('Something weird happened');
      const result = DownloadError.fromError(error, 'STORAGE_ERROR', true);

      expect(result.code).toBe('STORAGE_ERROR');
      expect(result.isRetryable).toBe(true);
    });

    it('should preserve original error info in details', () => {
      const error = new TypeError('Type error');
      const result = DownloadError.fromError(error);

      expect(result.details?.originalError).toBe('TypeError');
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new DownloadError('Test error', 'NETWORK_ERROR', true, { foo: 'bar' });
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'DownloadError',
        code: 'NETWORK_ERROR',
        message: 'Test error',
        isRetryable: true,
        details: { foo: 'bar' },
      });
    });
  });

  describe('error codes', () => {
    it('should have all expected error codes', () => {
      const expectedCodes: DownloadErrorCode[] = [
        'NETWORK_ERROR',
        'TIMEOUT_ERROR',
        'SIZE_MISMATCH',
        'CORRUPT_FILE',
        'ACCESS_DENIED',
        'NOT_FOUND',
        'STORAGE_ERROR',
        'UNKNOWN_ERROR',
      ];

      // Verify each code can be used
      for (const code of expectedCodes) {
        const error = new DownloadError('test', code);
        expect(error.code).toBe(code);
      }
    });
  });
});
