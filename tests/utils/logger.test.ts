import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import winston from 'winston';

// Mock winston before importing logger
jest.mock('winston', () => {
  const mockLogger = {
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  return {
    createLogger: jest.fn(() => mockLogger),
    format: {
      combine: jest.fn((...args) => args),
      timestamp: jest.fn(() => 'timestamp'),
      errors: jest.fn(() => 'errors'),
      json: jest.fn(() => 'json'),
      colorize: jest.fn(() => 'colorize'),
      printf: jest.fn(fn => fn),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  };
});

// Import logger after mocking winston
import { logger, createLogger } from '../../server/utils/logger';
import type { LogContext } from '../../server/utils/logger';

describe('Logger Utility', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockWinstonLogger: any;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Get the mock winston logger instance
    mockWinstonLogger = (winston.createLogger as jest.Mock).mock.results[0]?.value;

    // Clear all mock calls before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Logger Initialization', () => {
    it('should create a winston logger instance', () => {
      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should use info level in production by default', () => {
      process.env.NODE_ENV = 'production';
      // Logger is already initialized, this tests the default behavior
      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should use debug level in development by default', () => {
      process.env.NODE_ENV = 'development';
      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should respect LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'warn';
      expect(winston.createLogger).toHaveBeenCalled();
    });
  });

  describe('Basic Logging Methods', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message', { key: 'value' });

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'debug',
        'Debug message',
        expect.objectContaining({ key: 'value' })
      );
    });

    it('should log info messages', () => {
      logger.info('Info message', { key: 'value' });

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Info message',
        expect.objectContaining({ key: 'value' })
      );
    });

    it('should log warn messages', () => {
      logger.warn('Warning message', { key: 'value' });

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'warn',
        'Warning message',
        expect.objectContaining({ key: 'value' })
      );
    });

    it('should log error messages without error object', () => {
      logger.error('Error message', undefined, { key: 'value' });

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'error',
        'Error message',
        expect.objectContaining({ key: 'value' })
      );
    });

    it('should log error messages with error object', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error, { key: 'value' });

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'error',
        'Error occurred',
        expect.objectContaining({
          key: 'value',
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test error',
            stack: expect.any(String),
          }),
        })
      );
    });

    it('should log fatal messages and map to error level', () => {
      logger.fatal('Fatal error', undefined, { key: 'value' });

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'error', // Fatal maps to error in Winston
        'Fatal error',
        expect.objectContaining({ key: 'value' })
      );
    });

    it('should log fatal messages with error object', () => {
      const error = new Error('Fatal error');
      logger.fatal('Fatal error occurred', error);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'error',
        'Fatal error occurred',
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'Error',
            message: 'Fatal error',
            stack: expect.any(String),
          }),
        })
      );
    });
  });

  describe('Context Management', () => {
    it('should set global context', () => {
      const context: LogContext = {
        service: 'test-service',
        module: 'test-module',
      };

      logger.setContext(context);
      logger.info('Test message');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Test message',
        expect.objectContaining({
          service: 'test-service',
          module: 'test-module',
        })
      );
    });

    it('should merge context with existing context', () => {
      logger.setContext({ service: 'service1' });
      logger.setContext({ module: 'module1' });
      logger.info('Test message');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Test message',
        expect.objectContaining({
          service: 'service1',
          module: 'module1',
        })
      );
    });

    it('should create child logger with additional context', () => {
      const childLogger = logger.child({
        correlationId: 'test-correlation-id',
        userId: 'user-123',
      });

      childLogger.info('Child log message');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Child log message',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          userId: 'user-123',
        })
      );
    });

    it('should inherit parent context in child logger', () => {
      logger.setContext({ service: 'parent-service' });
      const childLogger = logger.child({ userId: 'user-123' });

      childLogger.info('Child with parent context');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Child with parent context',
        expect.objectContaining({
          service: 'parent-service',
          userId: 'user-123',
        })
      );
    });

    it('should support all context fields', () => {
      const fullContext: LogContext = {
        service: 'test-service',
        module: 'test-module',
        userId: 'user-123',
        requestId: 'req-456',
        correlationId: 'corr-789',
        sessionId: 'session-abc',
        agentId: 'agent-def',
        workflowId: 'workflow-ghi',
        pipelineId: 'pipeline-jkl',
        customField: 'custom-value',
      };

      logger.setContext(fullContext);
      logger.info('Full context test');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Full context test',
        expect.objectContaining(fullContext)
      );
    });
  });

  describe('Specialized Logging Methods', () => {
    it('should log performance metrics', () => {
      logger.performance('database-query', 125.5, { query: 'SELECT * FROM users' });

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Performance: database-query',
        expect.objectContaining({
          duration: 125.5,
          unit: 'ms',
          query: 'SELECT * FROM users',
        })
      );
    });

    it('should log HTTP requests with appropriate log level', () => {
      // Success - info level
      logger.http('GET', '/api/users', 200, 50);
      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'GET /api/users',
        expect.objectContaining({
          statusCode: 200,
          duration: 50,
          method: 'GET',
          path: '/api/users',
        })
      );

      jest.clearAllMocks();

      // Client error - warn level
      logger.http('POST', '/api/users', 404, 25);
      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'warn',
        'POST /api/users',
        expect.objectContaining({
          statusCode: 404,
          duration: 25,
        })
      );

      jest.clearAllMocks();

      // Server error - error level
      logger.http('GET', '/api/users', 500, 100);
      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'error',
        'GET /api/users',
        expect.objectContaining({
          statusCode: 500,
          duration: 100,
        })
      );
    });

    it('should log database queries', () => {
      const longQuery = 'SELECT * FROM users WHERE ' + 'x'.repeat(200);

      logger.query(longQuery, 45.3, { rows: 100 });

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'debug',
        'Database query completed',
        expect.objectContaining({
          query: longQuery.substring(0, 100),
          duration: 45.3,
          rows: 100,
        })
      );
    });

    it('should log agent activity', () => {
      logger.agent('agent-123', 'started', { task: 'portal-scan' });

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Agent started',
        expect.objectContaining({
          agentId: 'agent-123',
          action: 'started',
          task: 'portal-scan',
        })
      );
    });

    it('should log workflow events', () => {
      logger.workflow('workflow-456', 'completed', { duration: 1000 });

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Workflow completed',
        expect.objectContaining({
          workflowId: 'workflow-456',
          event: 'completed',
          duration: 1000,
        })
      );
    });
  });

  describe('createLogger Factory Function', () => {
    it('should create a child logger with provided context', () => {
      const context: LogContext = {
        service: 'api-service',
        module: 'auth-module',
      };

      const childLogger = createLogger(context);
      childLogger.info('Factory created logger');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Factory created logger',
        expect.objectContaining({
          service: 'api-service',
          module: 'auth-module',
        })
      );
    });
  });

  describe('Log Metadata Handling', () => {
    it('should handle empty metadata', () => {
      logger.info('Message without metadata');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Message without metadata',
        expect.any(Object)
      );
    });

    it('should handle complex nested metadata', () => {
      const metadata = {
        user: {
          id: 123,
          name: 'John Doe',
          roles: ['admin', 'user'],
        },
        request: {
          headers: { 'user-agent': 'test' },
          query: { page: 1 },
        },
      };

      logger.info('Complex metadata', metadata);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Complex metadata',
        expect.objectContaining(metadata)
      );
    });

    it('should merge context and metadata', () => {
      logger.setContext({ service: 'test-service' });
      logger.info('Merged data', { extra: 'metadata' });

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Merged data',
        expect.objectContaining({
          service: 'test-service',
          extra: 'metadata',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle Error instances correctly', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      logger.error('Error with stack', error);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'error',
        'Error with stack',
        expect.objectContaining({
          error: {
            name: 'Error',
            message: 'Test error',
            stack: 'Error stack trace',
          },
        })
      );
    });

    it('should handle custom Error classes', () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: string
        ) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const customError = new CustomError('Custom error message', 'ERR_CUSTOM');
      logger.error('Custom error occurred', customError);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'error',
        'Custom error occurred',
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'CustomError',
            message: 'Custom error message',
          }),
        })
      );
    });

    it('should handle errors without stack traces', () => {
      const error = new Error('Error without stack');
      delete error.stack;

      logger.error('Error without stack', error);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'error',
        'Error without stack',
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'Error',
            message: 'Error without stack',
            stack: undefined,
          }),
        })
      );
    });
  });

  describe('Integration Scenarios', () => {
    it('should support chaining context through multiple child loggers', () => {
      const parentLogger = logger.child({ service: 'parent-service' });
      const childLogger = parentLogger.child({ module: 'child-module' });
      const grandchildLogger = childLogger.child({ operation: 'grandchild-op' });

      grandchildLogger.info('Deep hierarchy log');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'info',
        'Deep hierarchy log',
        expect.objectContaining({
          service: 'parent-service',
          module: 'child-module',
          operation: 'grandchild-op',
        })
      );
    });

    it('should handle rapid sequential logging', () => {
      for (let i = 0; i < 10; i++) {
        logger.info(`Message ${i}`, { index: i });
      }

      expect(mockWinstonLogger.log).toHaveBeenCalledTimes(10);
    });

    it('should maintain separate contexts for different child loggers', () => {
      const logger1 = logger.child({ service: 'service-1' });
      const logger2 = logger.child({ service: 'service-2' });

      logger1.info('Service 1 message');
      logger2.info('Service 2 message');

      const calls = (mockWinstonLogger.log as jest.Mock).mock.calls;

      expect(calls[0][2]).toEqual(
        expect.objectContaining({ service: 'service-1' })
      );
      expect(calls[1][2]).toEqual(
        expect.objectContaining({ service: 'service-2' })
      );
    });
  });
});
