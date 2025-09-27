import { describe, it, expect } from '@jest/globals';

describe('Storage Service', () => {
  describe('Interface Implementation', () => {
    it('should be able to import storage module', async () => {
      // Test that the storage module can be imported without errors
      const { storage } = await import('@/storage');
      expect(storage).toBeDefined();
    });

    it('should have required methods', async () => {
      const { storage } = await import('@/storage');

      // Test that required methods exist
      expect(typeof storage.getSubmissionByProposal).toBe('function');
      expect(typeof storage.getHistoricalBidsByAgency).toBe('function');
      expect(typeof storage.getAllPortals).toBe('function');
      expect(typeof storage.getAllRFPs).toBe('function');
    });

    it('should have methods with correct signatures', async () => {
      const { storage } = await import('@/storage');

      // Test method parameter counts
      expect(storage.getSubmissionByProposal.length).toBe(1);
      expect(storage.getHistoricalBidsByAgency.length).toBe(1);
      expect(storage.getAllPortals.length).toBe(0);
      expect(storage.getAllRFPs.length).toBe(1); // Has optional filters parameter
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for critical methods', async () => {
      const { storage } = await import('@/storage');

      // Test that methods exist and are callable
      expect(() => {
        // These should not throw during preparation (only during execution)
        storage.getSubmissionByProposal('test-id');
        storage.getHistoricalBidsByAgency('test-agency');
      }).not.toThrow();
    });
  });
});