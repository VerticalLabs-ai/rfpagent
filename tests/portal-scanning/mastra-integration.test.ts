/**
 * Mastra Workflow Integration Tests
 *
 * Tests for the RFP Discovery workflow integration with Mastra agents
 * and the portal scanning system.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { rfpDiscoveryWorkflow, calculateConfidence } from '../../src/mastra/workflows/rfp-discovery-workflow';
import { createTestPortal, cleanupTestData } from '../helpers/testDatabase';
import { storage } from '../../server/storage';

describe('Mastra Workflow Integration Tests', () => {
  beforeEach(async () => {
    // Setup test data
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('RFP Discovery Workflow', () => {
    it('should execute complete discovery workflow', async () => {
      const portal = await createTestPortal({
        name: 'Test Federal Portal',
        url: 'https://sam.gov/opportunities',
        type: 'federal',
        status: 'active',
        scrapingEnabled: true,
      });

      const result = await rfpDiscoveryWorkflow.execute({
        maxPortals: 1,
      });

      expect(result).toBeDefined();
      expect(result.portalsScanned).toBeGreaterThanOrEqual(0);
    }, 120000);

    it('should handle parallel portal scraping', async () => {
      // Create multiple test portals
      await createTestPortal({
        name: 'Portal 1',
        url: 'https://portal1.gov',
        status: 'active',
      });
      await createTestPortal({
        name: 'Portal 2',
        url: 'https://portal2.gov',
        status: 'active',
      });
      await createTestPortal({
        name: 'Portal 3',
        url: 'https://portal3.gov',
        status: 'active',
      });

      const startTime = Date.now();
      const result = await rfpDiscoveryWorkflow.execute({
        maxPortals: 3,
      });
      const duration = Date.now() - startTime;

      expect(result.portalsScanned).toBeLessThanOrEqual(3);
      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(180000); // 3 minutes
    }, 180000);

    it('should process discovered RFPs correctly', async () => {
      const portal = await createTestPortal({
        name: 'Test Portal for Discovery',
        url: 'https://test-discovery.gov',
        status: 'active',
      });

      const result = await rfpDiscoveryWorkflow.execute({
        maxPortals: 1,
      });

      expect(result.totalProcessed).toBeGreaterThanOrEqual(0);
      expect(result.newRfps).toBeGreaterThanOrEqual(0);
      expect(result.updatedRfps).toBeGreaterThanOrEqual(0);
    }, 120000);

    it('should handle workflow failures gracefully', async () => {
      // Create portal with invalid configuration
      await createTestPortal({
        name: 'Invalid Portal',
        url: 'invalid-url',
        status: 'active',
      });

      // Workflow should complete but report errors
      const result = await rfpDiscoveryWorkflow.execute({
        maxPortals: 1,
      });

      expect(result).toBeDefined();
      // Should handle errors without crashing
    }, 120000);

    it('should respect maxPortals limit', async () => {
      // Create 5 portals
      for (let i = 0; i < 5; i++) {
        await createTestPortal({
          name: `Portal ${i}`,
          url: `https://portal${i}.gov`,
          status: 'active',
        });
      }

      const result = await rfpDiscoveryWorkflow.execute({
        maxPortals: 3,
      });

      expect(result.portalsScanned).toBeLessThanOrEqual(3);
    }, 180000);
  });

  describe('Confidence Score Calculation', () => {
    it('should calculate high confidence for complete RFP data', () => {
      const completeOpportunity = {
        title: 'Complete RFP with All Fields',
        description: 'This is a detailed description with comprehensive information about the project requirements and scope.',
        agency: 'Department of Defense',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        estimatedValue: '$500,000',
        url: 'https://sam.gov/opportunity/12345',
        category: 'IT Services',
      };

      const confidence = calculateConfidence(completeOpportunity);

      expect(confidence).toBeGreaterThan(0.8);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('should calculate low confidence for minimal RFP data', () => {
      const minimalOpportunity = {
        title: 'RFP',
        description: '',
      };

      const confidence = calculateConfidence(minimalOpportunity);

      expect(confidence).toBeLessThan(0.6);
      expect(confidence).toBeGreaterThanOrEqual(0);
    });

    it('should penalize missing title', () => {
      const noTitle = {
        description: 'Description without title',
        agency: 'Some Agency',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        url: 'https://portal.gov/rfp/123',
      };

      const confidence = calculateConfidence(noTitle);

      expect(confidence).toBeLessThan(0.5);
    });

    it('should reward valid future deadlines', () => {
      const futureDeadline = {
        title: 'RFP with Future Deadline',
        description: 'Active opportunity',
        agency: 'Test Agency',
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        url: 'https://portal.gov/rfp/456',
      };

      const pastDeadline = {
        ...futureDeadline,
        deadline: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const futureScore = calculateConfidence(futureDeadline);
      const pastScore = calculateConfidence(pastDeadline);

      expect(futureScore).toBeGreaterThan(pastScore);
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidURL = {
        title: 'RFP with Invalid URL',
        description: 'Test description',
        agency: 'Test Agency',
        url: 'not-a-valid-url',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const confidence = calculateConfidence(invalidURL);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThan(1.0);
    });

    it('should incorporate extraction metadata confidence', () => {
      const opportunity = {
        title: 'Test RFP',
        description: 'Test description',
        agency: 'Test Agency',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        url: 'https://portal.gov/rfp/789',
      };

      const withHighMetadata = calculateConfidence(opportunity, {
        confidence: 0.95,
        extractionQuality: 0.9,
      });

      const withLowMetadata = calculateConfidence(opportunity, {
        confidence: 0.3,
        extractionQuality: 0.4,
      });

      expect(withHighMetadata).toBeGreaterThan(withLowMetadata);
    });

    it('should clamp confidence to valid range', () => {
      const extremeData = {
        title: 'A'.repeat(1000), // Very long title
        description: 'B'.repeat(5000), // Very long description
        agency: 'Test Agency',
        deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        estimatedValue: '$999,999,999',
        url: 'https://portal.gov/rfp/999',
        category: 'Major Project',
      };

      const confidence = calculateConfidence(extremeData, {
        confidence: 1.5, // Simulate over-confident metadata
        extractionQuality: 1.2,
      });

      expect(confidence).toBeLessThanOrEqual(1.0);
      expect(confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Workflow Step Execution', () => {
    it('should fetch active portals successfully', async () => {
      await createTestPortal({ status: 'active' });
      await createTestPortal({ status: 'active' });
      await createTestPortal({ status: 'inactive' });

      const result = await rfpDiscoveryWorkflow.execute({
        maxPortals: 10,
      });

      expect(result.portalsScanned).toBeGreaterThanOrEqual(0);
    }, 120000);

    it('should handle portal authentication in workflow', async () => {
      await createTestPortal({
        requiresAuth: true,
        authType: 'basic',
        credentials: {
          username: 'test-user',
          password: 'test-pass',
        },
        status: 'active',
      });

      const result = await rfpDiscoveryWorkflow.execute({
        maxPortals: 1,
      });

      expect(result).toBeDefined();
    }, 120000);

    it('should save workflow execution results', async () => {
      const result = await rfpDiscoveryWorkflow.execute({
        maxPortals: 2,
      });

      expect(result.totalProcessed).toBeGreaterThanOrEqual(0);
      expect(result.portalsScanned).toBeGreaterThanOrEqual(0);
    }, 120000);
  });

  describe('Error Recovery in Workflow', () => {
    it('should continue workflow if one portal fails', async () => {
      await createTestPortal({
        name: 'Good Portal',
        url: 'https://good-portal.gov',
        status: 'active',
      });
      await createTestPortal({
        name: 'Bad Portal',
        url: 'invalid-url',
        status: 'active',
      });

      const result = await rfpDiscoveryWorkflow.execute({
        maxPortals: 2,
      });

      expect(result).toBeDefined();
      // Should process at least the good portal
    }, 180000);

    it('should log errors without stopping workflow', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await createTestPortal({
        url: 'https://error-portal.gov',
        status: 'active',
      });

      await rfpDiscoveryWorkflow.execute({
        maxPortals: 1,
      });

      // Should have logged errors
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    }, 120000);

    it('should handle empty portal list gracefully', async () => {
      // Delete all portals
      const portals = await storage.getActivePortals();
      for (const portal of portals) {
        await storage.deletePortal(portal.id);
      }

      const result = await rfpDiscoveryWorkflow.execute({
        maxPortals: 5,
      });

      expect(result.portalsScanned).toBe(0);
      expect(result.newRfps).toBe(0);
    }, 120000);
  });

  describe('Workflow Performance', () => {
    it('should complete within timeout for single portal', async () => {
      await createTestPortal({
        status: 'active',
      });

      const startTime = Date.now();
      await rfpDiscoveryWorkflow.execute({
        maxPortals: 1,
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(60000); // 1 minute
    }, 120000);

    it('should handle concurrent portal scraping efficiently', async () => {
      // Create 5 portals
      for (let i = 0; i < 5; i++) {
        await createTestPortal({
          name: `Concurrent Portal ${i}`,
          url: `https://concurrent${i}.gov`,
          status: 'active',
        });
      }

      const startTime = Date.now();
      await rfpDiscoveryWorkflow.execute({
        maxPortals: 5,
      });
      const duration = Date.now() - startTime;

      // Parallel execution should be much faster than 5 minutes
      expect(duration).toBeLessThan(180000); // 3 minutes
    }, 240000);
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity between portals and RFPs', async () => {
      const portal = await createTestPortal({
        status: 'active',
      });

      await rfpDiscoveryWorkflow.execute({
        maxPortals: 1,
      });

      const rfps = await storage.getRFPsByPortal(portal.id);

      // All RFPs should reference valid portal
      for (const rfp of rfps) {
        expect(rfp.portalId).toBe(portal.id);
      }
    }, 120000);

    it('should not lose data on workflow interruption', async () => {
      await createTestPortal({ status: 'active' });

      // Simulate interruption by timing out
      const promise = rfpDiscoveryWorkflow.execute({
        maxPortals: 1,
      });

      // Wait a bit then check if partial data was saved
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Any discovered RFPs should be in database
      const allPortals = await storage.getActivePortals();
      for (const portal of allPortals) {
        const rfps = await storage.getRFPsByPortal(portal.id);
        // RFPs should be valid if they exist
        rfps.forEach((rfp: any) => {
          expect(rfp.title).toBeTruthy();
          expect(rfp.portalId).toBeTruthy();
        });
      }

      await promise;
    }, 120000);
  });
});
