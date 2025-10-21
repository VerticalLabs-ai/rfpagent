import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Import logger - it will create winston instance
import { logger, createLogger } from '../../server/utils/logger';
import type { LogContext } from '../../server/utils/logger';

describe('Logger Utility', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Logger Initialization', () => {
    it('should create a logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });

    it('should have context management methods', () => {
      expect(typeof logger.setContext).toBe('function');
      expect(typeof logger.addContext).toBe('function');
      expect(typeof logger.getContext).toBe('function');
      expect(typeof logger.clearContext).toBe('function');
    });

    it('should have child logger creation method', () => {
      expect(typeof logger.child).toBe('function');
    });
  });

  describe('Basic Logging Methods', () => {
    it('should log debug messages without errors', () => {
      expect(() => {
        logger.debug('Debug message', { key: 'value' });
      }).not.toThrow();
    });

    it('should log info messages without errors', () => {
      expect(() => {
        logger.info('Info message', { key: 'value' });
      }).not.toThrow();
    });

    it('should log warn messages without errors', () => {
      expect(() => {
        logger.warn('Warning message', { key: 'value' });
      }).not.toThrow();
    });

    it('should log error messages without error object', () => {
      expect(() => {
        logger.error('Error message', undefined, { key: 'value' });
      }).not.toThrow();
    });

    it('should log error messages with error object', () => {
      const error = new Error('Test error');
      expect(() => {
        logger.error('Error occurred', error, { key: 'value' });
      }).not.toThrow();
    });

    it('should log fatal messages', () => {
      expect(() => {
        logger.fatal('Fatal error', undefined, { key: 'value' });
      }).not.toThrow();
    });

    it('should log fatal messages with error object', () => {
      const error = new Error('Fatal error');
      expect(() => {
        logger.fatal('Fatal error occurred', error);
      }).not.toThrow();
    });
  });

  describe('Context Management', () => {
    beforeEach(() => {
      logger.clearContext();
    });

    it('should set and get context', () => {
      const context: LogContext = {
        service: 'test-service',
        userId: 'user123',
      };

      logger.setContext(context);
      const retrievedContext = logger.getContext();

      expect(retrievedContext).toEqual(context);
    });

    it('should add to existing context', () => {
      logger.setContext({ service: 'test-service' });
      logger.addContext({ userId: 'user123' });

      const context = logger.getContext();
      expect(context).toEqual({
        service: 'test-service',
        userId: 'user123',
      });
    });

    it('should clear context', () => {
      logger.setContext({ service: 'test-service' });
      logger.clearContext();

      const context = logger.getContext();
      expect(context).toEqual({});
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with additional context', () => {
      const parentContext: LogContext = {
        service: 'parent-service',
      };

      logger.setContext(parentContext);

      const childLogger = logger.child({
        module: 'child-module',
      });

      expect(() => {
        childLogger.info('Child log message');
      }).not.toThrow();

      // Parent context should not be affected
      const parentAfter = logger.getContext();
      expect(parentAfter).toEqual(parentContext);
    });
  });

  describe('Factory Method', () => {
    it('should create a new logger instance', () => {
      const newLogger = createLogger({
        service: 'custom-service',
        module: 'custom-module',
      });

      expect(newLogger).toBeDefined();
      expect(typeof newLogger.info).toBe('function');

      expect(() => {
        newLogger.info('Custom logger message');
      }).not.toThrow();
    });

    it('should create logger with merged context', () => {
      const context: LogContext = {
        service: 'api',
        module: 'auth',
      };

      const newLogger = createLogger(context);
      const retrievedContext = newLogger.getContext();

      expect(retrievedContext).toEqual(context);
    });
  });
});
