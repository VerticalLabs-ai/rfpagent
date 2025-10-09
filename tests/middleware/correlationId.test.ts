import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import {
  correlationIdMiddleware,
  getCorrelationId,
  getRequestLogger,
} from '../../server/middleware/correlationId';
import { logger } from '../../server/utils/logger';

// Mock the logger module
jest.mock('../../server/utils/logger', () => ({
  logger: {
    child: jest.fn().mockReturnValue({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock nanoid
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-generated-id'),
}));

describe('Correlation ID Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Create mock request, response, and next function
    mockRequest = {
      headers: {},
      method: 'GET',
      path: '/api/test',
      query: {},
      ip: '127.0.0.1',
    };

    mockResponse = {
      setHeader: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('correlationIdMiddleware', () => {
    it('should generate a new correlation ID when not provided in headers', () => {
      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.correlationId).toBe('corr_mock-generated-id');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Correlation-ID',
        'corr_mock-generated-id'
      );
    });

    it('should use existing correlation ID from X-Correlation-ID header', () => {
      const existingId = 'existing-correlation-id-12345';
      mockRequest.headers = {
        'x-correlation-id': existingId,
      };

      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.correlationId).toBe(existingId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Correlation-ID',
        existingId
      );
    });

    it('should set correlation ID in response headers', () => {
      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Correlation-ID',
        'corr_mock-generated-id'
      );
    });

    it('should create a child logger with correlation context', () => {
      const userAgent = 'Mozilla/5.0 Test Browser';
      mockRequest.headers = { 'user-agent': userAgent };

      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(logger.child).toHaveBeenCalledWith({
        correlationId: 'corr_mock-generated-id',
        method: 'GET',
        path: '/api/test',
        userAgent,
      });
    });

    it('should attach request logger to request object', () => {
      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect((mockRequest as any).logger).toBeDefined();
      expect((mockRequest as any).logger.info).toBeDefined();
    });

    it('should log incoming request with context', () => {
      const mockLogger = {
        info: jest.fn(),
      };
      (logger.child as jest.Mock).mockReturnValue(mockLogger);

      mockRequest.query = { search: 'test' };
      mockRequest.ip = '192.168.1.1';

      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockLogger.info).toHaveBeenCalledWith('Incoming request', {
        query: { search: 'test' },
        ip: '192.168.1.1',
      });
    });

    it('should call next() to continue middleware chain', () => {
      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle requests with no user-agent header', () => {
      mockRequest.headers = {};

      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(logger.child).toHaveBeenCalledWith({
        correlationId: 'corr_mock-generated-id',
        method: 'GET',
        path: '/api/test',
        userAgent: undefined,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle different HTTP methods correctly', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      methods.forEach(method => {
        jest.clearAllMocks();
        mockRequest.method = method;

        correlationIdMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(logger.child).toHaveBeenCalledWith(
          expect.objectContaining({ method })
        );
      });
    });

    it('should handle different paths correctly', () => {
      const paths = ['/api/users', '/api/portals', '/api/rfps', '/'];

      paths.forEach(path => {
        jest.clearAllMocks();
        mockRequest.path = path;

        correlationIdMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(logger.child).toHaveBeenCalledWith(
          expect.objectContaining({ path })
        );
      });
    });

    it('should preserve correlation ID format with corr_ prefix for generated IDs', () => {
      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.correlationId).toMatch(/^corr_/);
    });

    it('should not modify existing correlation ID from headers', () => {
      const customId = 'custom-format-without-prefix';
      mockRequest.headers = {
        'x-correlation-id': customId,
      };

      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.correlationId).toBe(customId);
      expect(mockRequest.correlationId).not.toMatch(/^corr_/);
    });
  });

  describe('getCorrelationId', () => {
    it('should return correlation ID from request', () => {
      mockRequest.correlationId = 'test-correlation-id';

      const result = getCorrelationId(mockRequest as Request);

      expect(result).toBe('test-correlation-id');
    });

    it('should return undefined if correlation ID is not set', () => {
      const result = getCorrelationId(mockRequest as Request);

      expect(result).toBeUndefined();
    });
  });

  describe('getRequestLogger', () => {
    it('should return request-scoped logger when available', () => {
      const mockLogger = { info: jest.fn(), error: jest.fn() };
      (mockRequest as any).logger = mockLogger;

      const result = getRequestLogger(mockRequest as Request);

      expect(result).toBe(mockLogger);
    });

    it('should return default logger when request logger is not available', () => {
      const result = getRequestLogger(mockRequest as Request);

      expect(result).toBe(logger);
    });

    it('should return default logger for requests without logger property', () => {
      delete (mockRequest as any).logger;

      const result = getRequestLogger(mockRequest as Request);

      expect(result).toBe(logger);
    });
  });

  describe('TypeScript type safety', () => {
    it('should extend Express Request interface with correlationId', () => {
      // This test verifies that TypeScript types are correctly defined
      const req = mockRequest as Request;

      // TypeScript should allow this without errors
      correlationIdMiddleware(req, mockResponse as Response, mockNext);

      // TypeScript should recognize correlationId as a valid property
      expect(typeof req.correlationId).toBe('string');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple sequential requests with different correlation IDs', () => {
      const requests = [
        { headers: {}, expectedPrefix: 'corr_' },
        { headers: { 'x-correlation-id': 'client-id-1' }, expectedId: 'client-id-1' },
        { headers: {}, expectedPrefix: 'corr_' },
        { headers: { 'x-correlation-id': 'client-id-2' }, expectedId: 'client-id-2' },
      ];

      requests.forEach((testCase, index) => {
        jest.clearAllMocks();
        const req = { ...mockRequest, headers: testCase.headers };

        correlationIdMiddleware(
          req as Request,
          mockResponse as Response,
          mockNext
        );

        if (testCase.expectedId) {
          expect(req.correlationId).toBe(testCase.expectedId);
        } else if (testCase.expectedPrefix) {
          expect(req.correlationId).toMatch(new RegExp(`^${testCase.expectedPrefix}`));
        }
      });
    });

    it('should create unique loggers for each request', () => {
      const req1 = { ...mockRequest, path: '/api/request1' };
      const req2 = { ...mockRequest, path: '/api/request2' };

      correlationIdMiddleware(
        req1 as Request,
        mockResponse as Response,
        mockNext
      );
      const logger1 = (req1 as any).logger;

      jest.clearAllMocks();

      correlationIdMiddleware(
        req2 as Request,
        mockResponse as Response,
        mockNext
      );
      const logger2 = (req2 as any).logger;

      expect(logger1).toBeDefined();
      expect(logger2).toBeDefined();
      expect(logger.child).toHaveBeenCalledTimes(1); // Only called for req2 in this cleared state
    });

    it('should maintain correlation ID through entire request lifecycle', () => {
      correlationIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const correlationId = mockRequest.correlationId;
      expect(correlationId).toBeDefined();

      // Simulate accessing correlation ID later in request lifecycle
      const retrievedId = getCorrelationId(mockRequest as Request);
      expect(retrievedId).toBe(correlationId);

      // Verify response header matches
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Correlation-ID',
        correlationId
      );
    });
  });
});
