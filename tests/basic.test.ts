import { describe, it, expect } from '@jest/globals';

describe('Basic Tests', () => {
  it('should run a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should test async functionality', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });

  it('should verify environment setup', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});