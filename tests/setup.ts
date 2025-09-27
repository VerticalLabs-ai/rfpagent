import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.OPENAI_API_KEY = 'test-key';

// Global test timeout
jest.setTimeout(30000);

// Mock console to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to silence specific log levels in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Mock Date for consistent testing
const mockDate = new Date('2025-01-01T00:00:00.000Z');
jest.useFakeTimers();
jest.setSystemTime(mockDate);