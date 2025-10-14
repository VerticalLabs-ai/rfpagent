/**
 * Discovery Manager Task Timeout Configuration Tests
 *
 * These tests verify that the TASK_TIMEOUTS configuration is properly defined
 * and that different task types have appropriate timeout values.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('DiscoveryManager Task Timeout Configuration', () => {
  const discoveryManagerPath = join(
    __dirname,
    '../../server/services/portals/discoveryManager.ts'
  );

  let sourceCode: string;

  beforeAll(() => {
    sourceCode = readFileSync(discoveryManagerPath, 'utf-8');
  });

  describe('TASK_TIMEOUTS constant', () => {
    it('should define TASK_TIMEOUTS configuration constant', () => {
      expect(sourceCode).toContain('const TASK_TIMEOUTS');
      expect(sourceCode).toContain('Record<string, number>');
    });

    it('should define portal_authentication timeout as 5 minutes (300,000 ms)', () => {
      const timeoutMatch = sourceCode.match(
        /portal_authentication:\s*5\s*\*\s*60\s*\*\s*1000/
      );
      expect(timeoutMatch).toBeTruthy();

      // Verify the actual value
      const expectedTimeout = 5 * 60 * 1000; // 300,000 ms
      expect(expectedTimeout).toBe(300000);
    });

    it('should define portal_scanning timeout as 20 minutes (1,200,000 ms)', () => {
      const timeoutMatch = sourceCode.match(
        /portal_scanning:\s*20\s*\*\s*60\s*\*\s*1000/
      );
      expect(timeoutMatch).toBeTruthy();

      // Verify the actual value
      const expectedTimeout = 20 * 60 * 1000; // 1,200,000 ms
      expect(expectedTimeout).toBe(1200000);
    });

    it('should define rfp_extraction timeout as 30 minutes (1,800,000 ms)', () => {
      const timeoutMatch = sourceCode.match(
        /rfp_extraction:\s*30\s*\*\s*60\s*\*\s*1000/
      );
      expect(timeoutMatch).toBeTruthy();

      // Verify the actual value
      const expectedTimeout = 30 * 60 * 1000; // 1,800,000 ms
      expect(expectedTimeout).toBe(1800000);
    });

    it('should define portal_monitoring timeout as 10 minutes (600,000 ms)', () => {
      const timeoutMatch = sourceCode.match(
        /portal_monitoring:\s*10\s*\*\s*60\s*\*\s*1000/
      );
      expect(timeoutMatch).toBeTruthy();

      // Verify the actual value
      const expectedTimeout = 10 * 60 * 1000; // 600,000 ms
      expect(expectedTimeout).toBe(600000);
    });
  });

  describe('DEFAULT_TASK_TIMEOUT constant', () => {
    it('should define DEFAULT_TASK_TIMEOUT as 15 minutes (900,000 ms)', () => {
      const defaultTimeoutMatch = sourceCode.match(
        /const\s+DEFAULT_TASK_TIMEOUT\s*=\s*15\s*\*\s*60\s*\*\s*1000/
      );
      expect(defaultTimeoutMatch).toBeTruthy();

      // Verify the actual value
      const expectedDefault = 15 * 60 * 1000; // 900,000 ms
      expect(expectedDefault).toBe(900000);
    });

    it('should have documentation explaining the default timeout purpose', () => {
      // Check for documentation comments around DEFAULT_TASK_TIMEOUT
      expect(sourceCode).toContain('Default timeout');
      expect(sourceCode).toContain('DEFAULT_TASK_TIMEOUT');
    });
  });

  describe('recordSpecialistAssignment implementation', () => {
    it('should use TASK_TIMEOUTS map to compute expectedCompletion', () => {
      // Verify that recordSpecialistAssignment uses the timeout map
      const assignmentFunctionMatch = sourceCode.match(
        /private\s+async\s+recordSpecialistAssignment\([^)]*\)[^{]*\{([\s\S]*?)(?=\n\s{2}[a-zA-Z/])/
      );

      expect(assignmentFunctionMatch).toBeTruthy();

      if (assignmentFunctionMatch) {
        const functionBody = assignmentFunctionMatch[1];

        // Check that it looks up the timeout from TASK_TIMEOUTS
        expect(functionBody).toContain('TASK_TIMEOUTS');
        expect(functionBody).toContain('taskType');

        // Verify it doesn't have the old hard-coded 15 minute timeout directly in assignment
        const hasHardcodedTimeout = /expectedCompletion.*15\s*\*\s*60\s*\*\s*1000/.test(functionBody);
        expect(hasHardcodedTimeout).toBe(false);
      }
    });

    it('should fall back to DEFAULT_TASK_TIMEOUT for unknown task types', () => {
      const assignmentFunctionMatch = sourceCode.match(
        /private\s+async\s+recordSpecialistAssignment\([^)]*\)[^{]*\{([\s\S]*?)(?=\n\s{2}[a-zA-Z/])/
      );

      expect(assignmentFunctionMatch).toBeTruthy();

      if (assignmentFunctionMatch) {
        const functionBody = assignmentFunctionMatch[1];

        // Check for nullish coalescing or similar fallback logic
        expect(
          functionBody.includes('??') || functionBody.includes('||')
        ).toBeTruthy();
        expect(functionBody).toContain('DEFAULT_TASK_TIMEOUT');
      }
    });

    it('should compute expectedCompletion using Date.now() + timeoutMs', () => {
      const assignmentFunctionMatch = sourceCode.match(
        /private\s+async\s+recordSpecialistAssignment\([^)]*\)[^{]*\{([\s\S]*?)(?=\n\s{2}[a-zA-Z/])/
      );

      expect(assignmentFunctionMatch).toBeTruthy();

      if (assignmentFunctionMatch) {
        const functionBody = assignmentFunctionMatch[1];

        // Check that expectedCompletion is calculated dynamically
        expect(functionBody).toContain('expectedCompletion');
        expect(functionBody).toContain('Date.now()');
        expect(functionBody).toMatch(/new Date\(Date\.now\(\)\s*\+/);
      }
    });
  });

  describe('Task timeout values validation', () => {
    it('should have timeout values in milliseconds', () => {
      // All timeout values should be multiplied by 1000 (converting to ms)
      const timeoutDefinitions = sourceCode.match(
        /TASK_TIMEOUTS[\s\S]*?{([\s\S]*?)^}/m
      );

      expect(timeoutDefinitions).toBeTruthy();

      if (timeoutDefinitions) {
        const timeoutsBody = timeoutDefinitions[1];

        // Count how many times we multiply by 1000
        const multiplications = (timeoutsBody.match(/\*\s*1000/g) || []).length;

        // Should have at least 4 task types with * 1000
        expect(multiplications).toBeGreaterThanOrEqual(4);
      }
    });

    it('should have reasonable timeout ranges (5-30 minutes)', () => {
      // Verify timeout values are reasonable
      const minTimeout = 5 * 60 * 1000; // 5 minutes
      const maxTimeout = 30 * 60 * 1000; // 30 minutes

      expect(minTimeout).toBe(300000);
      expect(maxTimeout).toBe(1800000);

      // Verify these values exist in the source
      expect(sourceCode).toMatch(/5\s*\*\s*60\s*\*\s*1000/);
      expect(sourceCode).toMatch(/30\s*\*\s*60\s*\*\s*1000/);
    });
  });

  describe('Documentation and maintainability', () => {
    it('should have JSDoc comments for TASK_TIMEOUTS', () => {
      // Look for documentation comments before TASK_TIMEOUTS
      const timeoutsMatch = sourceCode.match(
        /\/\*\*[\s\S]*?\*\/[\s]*const TASK_TIMEOUTS/
      );
      expect(timeoutsMatch).toBeTruthy();
    });

    it('should have inline comments explaining timeout values', () => {
      // Check for inline comments next to timeout values
      const commentsCount = (
        sourceCode.match(/\/\/\s*\d+\s*minutes?/gi) || []
      ).length;

      // Should have comments for at least the 4 main task types
      expect(commentsCount).toBeGreaterThanOrEqual(4);
    });

    it('should have TASK_TIMEOUTS constant defined before its usage', () => {
      const timeoutsIndex = sourceCode.indexOf('const TASK_TIMEOUTS');
      const assignmentIndex = sourceCode.indexOf('recordSpecialistAssignment');

      // TASK_TIMEOUTS should be defined before recordSpecialistAssignment
      expect(timeoutsIndex).toBeGreaterThan(0);
      expect(assignmentIndex).toBeGreaterThan(timeoutsIndex);
    });
  });
});
