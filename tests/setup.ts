import { jest } from '@jest/globals';
import dotenv from 'dotenv';

// Load test environment variables first (overrides .env)
dotenv.config({ path: '.env.test' });

// Load main environment variables as fallback
dotenv.config();

// Override NODE_ENV for tests
process.env.NODE_ENV = 'test';

// Fallback DATABASE_URL for CI/CD or if not set
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set, using fallback test database');
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/rfpagent_test';
}

// Only set OPENAI_API_KEY if not already in .env
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'test-key';
}

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

// Don't use fake timers for integration tests - they interfere with database connections
// const mockDate = new Date('2025-01-01T00:00:00.000Z');
// jest.useFakeTimers();
// jest.setSystemTime(mockDate);