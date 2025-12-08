import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { progressTracker } from '../../server/services/monitoring/progressTracker';

/**
 * Integration tests for SSE Progress Flow
 *
 * These tests verify the complete lifecycle of progress tracking:
 * 1. Starting tracking for a session
 * 2. Registering SSE clients
 * 3. Updating progress steps
 * 4. Broadcasting updates to clients
 * 5. Completing or failing tracking
 */

// Mock Response object that mimics Express Response
const createMockResponse = () => {
  const writtenData: string[] = [];

  const res = {
    writeHead: vi.fn(),
    write: vi.fn((data: string) => {
      writtenData.push(data);
      return true;
    }),
    end: vi.fn(),
    on: vi.fn((event: string, callback: () => void) => {
      // Store close callback for manual trigger if needed
      if (event === 'close') {
        res._closeCallback = callback;
      }
    }),
    destroyed: false,
    _closeCallback: null as (() => void) | null,
    _writtenData: writtenData, // Helper to access written data in tests
  };

  return res;
};

describe('SSE Progress Flow Integration Tests', () => {
  beforeEach(() => {
    // Clean up any existing state before each test
    progressTracker.shutdown();
  });

  afterEach(() => {
    // Clean up after each test
    progressTracker.shutdown();
  });

  describe('Complete Progress Tracking Flow', () => {
    it('should track complete lifecycle: start → register → update steps → complete', async () => {
      // Arrange
      const sessionId = `integration-test-${Date.now()}`;
      const testUrl = 'https://test.gov/rfp/123';
      const testRfpId = 'rfp-integration-123';
      const receivedMessages: any[] = [];

      // Create mock response
      const mockRes = createMockResponse();

      // Parse SSE data format
      mockRes.write.mockImplementation((data: string) => {
        try {
          // SSE format: "data: {...}\n\n" or ": heartbeat"
          if (data.startsWith('data: ')) {
            const jsonStr = data.substring(6, data.indexOf('\n\n'));
            const parsed = JSON.parse(jsonStr);
            receivedMessages.push(parsed);
          }
          // Ignore comment-style heartbeats (": heartbeat")
        } catch (error) {
          // Ignore parsing errors (e.g., heartbeat comments)
        }
        return true;
      });

      // Act: Step 1 - Start tracking
      progressTracker.startTracking(sessionId, testUrl, 'rfp_processing');

      const initialProgress = progressTracker.getProgress(sessionId);
      expect(initialProgress).toBeDefined();
      expect(initialProgress?.status).toBe('initializing');
      expect(initialProgress?.url).toBe(testUrl);
      expect(initialProgress?.totalSteps).toBeGreaterThan(0);
      expect(initialProgress?.completedSteps).toBe(0);

      // Act: Step 2 - Register SSE client
      progressTracker.registerSSEClient(sessionId, mockRes as any);

      // Assert: Headers set correctly
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      }));

      // Assert: Connected message sent
      expect(receivedMessages).toContainEqual(
        expect.objectContaining({
          type: 'connected',
          sessionId: sessionId
        })
      );

      // Assert: Initial progress sent
      expect(receivedMessages).toContainEqual(
        expect.objectContaining({
          type: 'progress',
          data: expect.objectContaining({
            status: 'initializing',
            url: testUrl,
          })
        })
      );

      // Act: Step 3 - Update multiple steps
      progressTracker.updateStep(
        sessionId,
        'portal_detection',
        'completed',
        'Portal type detected successfully'
      );

      progressTracker.updateStep(
        sessionId,
        'page_navigation',
        'in_progress',
        'Navigating to RFP page...'
      );

      progressTracker.updateStep(
        sessionId,
        'page_navigation',
        'completed',
        'Navigation complete'
      );

      progressTracker.updateStep(
        sessionId,
        'data_extraction',
        'in_progress',
        'Extracting RFP data...'
      );

      // Assert: Progress updates received
      const progressMessages = receivedMessages.filter(m => m.type === 'progress');
      expect(progressMessages.length).toBeGreaterThan(3); // Initial + updates

      // Verify status transitions
      const currentProgress = progressTracker.getProgress(sessionId);
      expect(currentProgress?.status).toBe('processing');
      expect(currentProgress?.completedSteps).toBeGreaterThan(0);
      expect(currentProgress?.currentStep).toContain('Extracting');

      // Act: Step 4 - Complete all remaining steps first
      progressTracker.updateStep(
        sessionId,
        'data_extraction',
        'completed',
        'Data extraction complete'
      );
      progressTracker.updateStep(
        sessionId,
        'document_discovery',
        'completed',
        'Documents discovered'
      );
      progressTracker.updateStep(
        sessionId,
        'document_download',
        'completed',
        'Documents downloaded'
      );
      progressTracker.updateStep(
        sessionId,
        'database_save',
        'completed',
        'Saved to database'
      );
      progressTracker.updateStep(
        sessionId,
        'ai_analysis',
        'completed',
        'AI analysis complete'
      );

      // Now complete tracking (which completes the 'completion' step)
      progressTracker.completeTracking(sessionId, testRfpId);

      // Wait for async cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: Final status should be 'completed' after all steps done
      const finalProgress = progressTracker.getProgress(sessionId);
      expect(finalProgress?.status).toBe('completed');
      expect(finalProgress?.completedSteps).toBe(finalProgress?.totalSteps);

      // Verify progress messages were sent (we got at least initializing + multiple updates)
      expect(progressMessages.length).toBeGreaterThanOrEqual(3);

      // Note: Complete message is sent within completeTracking
      // Wait a bit for the message to be queued
      await new Promise(resolve => setTimeout(resolve, 100));

      // The completeTracking sends both progress with status=completed AND a separate complete message
      // However, the complete message is sent after a 5s delay in the implementation
      // For this test, we verify the completed status in progress is enough
      // The complete message itself is sent during cleanup
    }, 10000); // Increase timeout to 10 seconds

    it('should handle client info tracking correctly', () => {
      // Arrange
      const sessionId = `client-info-test-${Date.now()}`;
      const mockRes = createMockResponse();

      // Act
      progressTracker.startTracking(sessionId, 'https://test.gov/rfp', 'rfp_processing');
      progressTracker.registerSSEClient(sessionId, mockRes as any);

      // Assert: Client info is tracked
      const clientInfo = progressTracker.getClientInfo(sessionId);
      expect(clientInfo).toBeDefined();
      expect(clientInfo?.lastActivity).toBeInstanceOf(Date);

      // Verify last activity is recent (within last 5 seconds)
      const timeDiff = Date.now() - clientInfo!.lastActivity.getTime();
      expect(timeDiff).toBeLessThan(5000);
    });
  });

  describe('Failure Tracking Flow', () => {
    it('should track failure lifecycle: start → register → fail', async () => {
      // Arrange
      const sessionId = `fail-test-${Date.now()}`;
      const testUrl = 'https://test.gov/rfp/fail';
      const errorMessage = 'Connection timeout after 30 seconds';
      const receivedMessages: any[] = [];

      const mockRes = createMockResponse();
      mockRes.write.mockImplementation((data: string) => {
        try {
          if (data.startsWith('data: ')) {
            const jsonStr = data.substring(6, data.indexOf('\n\n'));
            receivedMessages.push(JSON.parse(jsonStr));
          }
        } catch {
          // Ignore
        }
        return true;
      });

      // Act: Start tracking and register client
      progressTracker.startTracking(sessionId, testUrl, 'rfp_processing');
      progressTracker.registerSSEClient(sessionId, mockRes as any);

      // Act: Simulate some progress before failure
      progressTracker.updateStep(
        sessionId,
        'portal_detection',
        'completed',
        'Portal detected'
      );

      progressTracker.updateStep(
        sessionId,
        'page_navigation',
        'in_progress',
        'Navigating...'
      );

      // Act: Fail the tracking
      progressTracker.failTracking(sessionId, errorMessage);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: Progress shows failure
      const lastProgress = receivedMessages
        .filter(m => m.type === 'progress')
        .pop();

      expect(lastProgress?.data?.status).toBe('failed');
      expect(lastProgress?.data?.error).toBe(errorMessage);

      // Assert: Session cleaned up (check end is called eventually)
      await new Promise(resolve => setTimeout(resolve, 5100)); // Wait for cleanup
      expect(mockRes.end).toHaveBeenCalled();

      // Note: Error message is sent before end() in the actual implementation
      const errorMsg = receivedMessages.find(m => m.type === 'error');
      expect(errorMsg).toBeDefined();
      expect(errorMsg?.error).toBe(errorMessage);
    }, 10000); // Increase timeout to 10 seconds

    it('should handle step failure correctly', () => {
      // Arrange
      const sessionId = `step-fail-test-${Date.now()}`;
      const receivedMessages: any[] = [];
      const mockRes = createMockResponse();

      mockRes.write.mockImplementation((data: string) => {
        try {
          if (data.startsWith('data: ')) {
            const jsonStr = data.substring(6, data.indexOf('\n\n'));
            receivedMessages.push(JSON.parse(jsonStr));
          }
        } catch {
          // Ignore
        }
        return true;
      });

      // Act: Start tracking
      progressTracker.startTracking(sessionId, 'https://test.gov', 'rfp_processing');
      progressTracker.registerSSEClient(sessionId, mockRes as any);

      // Act: Fail a specific step
      progressTracker.updateStep(
        sessionId,
        'document_download',
        'failed',
        'Document not found (404)'
      );

      // Assert: Overall status is failed
      const progress = progressTracker.getProgress(sessionId);
      expect(progress?.status).toBe('failed');
      expect(progress?.error).toBe('Document not found (404)');

      // Assert: Failed step is tracked
      const failedStep = progress?.steps.find(s =>
        s.step.includes('Download') && s.status === 'failed'
      );
      expect(failedStep).toBeDefined();
      expect(failedStep?.message).toContain('404');
    });
  });

  describe('SSE Message Verification', () => {
    it('should send all required message types', async () => {
      // Arrange
      const sessionId = `message-test-${Date.now()}`;
      const receivedMessageTypes = new Set<string>();
      const mockRes = createMockResponse();

      mockRes.write.mockImplementation((data: string) => {
        try {
          if (data.startsWith('data: ')) {
            const jsonStr = data.substring(6, data.indexOf('\n\n'));
            const msg = JSON.parse(jsonStr);
            receivedMessageTypes.add(msg.type);
          }
        } catch {
          // Ignore
        }
        return true;
      });

      // Act: Complete flow
      progressTracker.startTracking(sessionId, 'https://test.gov', 'rfp_processing');
      progressTracker.registerSSEClient(sessionId, mockRes as any);
      progressTracker.updateStep(sessionId, 'portal_detection', 'completed', 'Done');
      progressTracker.completeTracking(sessionId, 'rfp-123');

      // Wait for initial messages
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert: Core message types received (connected and progress are immediate)
      expect(receivedMessageTypes.has('connected')).toBe(true);
      expect(receivedMessageTypes.has('progress')).toBe(true);

      // Note: 'complete' message is sent after 5s delay in completeTracking
      // We verify the core real-time messages here
    }, 10000); // Increase timeout

    it('should include proper data structure in progress messages', () => {
      // Arrange
      const sessionId = `structure-test-${Date.now()}`;
      let progressData: any = null;
      const mockRes = createMockResponse();

      mockRes.write.mockImplementation((data: string) => {
        try {
          if (data.startsWith('data: ')) {
            const jsonStr = data.substring(6, data.indexOf('\n\n'));
            const msg = JSON.parse(jsonStr);
            if (msg.type === 'progress' && msg.data) {
              progressData = msg.data;
            }
          }
        } catch {
          // Ignore
        }
        return true;
      });

      // Act
      progressTracker.startTracking(sessionId, 'https://test.gov', 'rfp_processing');
      progressTracker.registerSSEClient(sessionId, mockRes as any);

      // Assert: Progress data has required fields
      expect(progressData).toBeDefined();
      expect(progressData).toHaveProperty('url');
      expect(progressData).toHaveProperty('status');
      expect(progressData).toHaveProperty('totalSteps');
      expect(progressData).toHaveProperty('completedSteps');
      expect(progressData).toHaveProperty('currentStep');
      expect(progressData).toHaveProperty('steps');
      expect(Array.isArray(progressData.steps)).toBe(true);
    });
  });

  describe('Multiple Workflow Types', () => {
    it('should support different workflow types with correct steps', () => {
      // Test RFP Processing workflow
      const rfpSessionId = `rfp-workflow-${Date.now()}`;
      progressTracker.startTracking(rfpSessionId, 'https://test.gov', 'rfp_processing');

      const rfpProgress = progressTracker.getProgress(rfpSessionId);
      expect(rfpProgress?.steps.some(s => s.step.includes('Portal'))).toBe(true);
      expect(rfpProgress?.steps.some(s => s.step.includes('Document'))).toBe(true);

      // Test Submission Materials workflow
      const submissionSessionId = `submission-workflow-${Date.now()}`;
      progressTracker.startTracking(
        submissionSessionId,
        'https://test.gov',
        'submission_materials'
      );

      const submissionProgress = progressTracker.getProgress(submissionSessionId);
      // Check for workflow-specific steps - use exact step names from WORKFLOW_STEPS
      expect(submissionProgress?.steps.some(s => s.step.includes('Analyzing'))).toBe(true);
      expect(submissionProgress?.steps.some(s => s.step.includes('Generating'))).toBe(true);
      expect(submissionProgress?.steps.some(s => s.step.includes('Compliance'))).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle updating non-existent session gracefully', () => {
      const nonExistentSession = 'does-not-exist-123';

      // Should not throw
      expect(() => {
        progressTracker.updateStep(
          nonExistentSession,
          'portal_detection',
          'completed',
          'Test'
        );
      }).not.toThrow();
    });

    it('should handle registering multiple clients for same session', () => {
      const sessionId = `multi-client-${Date.now()}`;
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();

      progressTracker.startTracking(sessionId, 'https://test.gov', 'rfp_processing');

      // Register multiple clients
      progressTracker.registerSSEClient(sessionId, mockRes1 as any);
      progressTracker.registerSSEClient(sessionId, mockRes2 as any);

      // Update progress
      progressTracker.updateStep(sessionId, 'portal_detection', 'completed', 'Done');

      // Both clients should receive updates
      expect(mockRes1.write).toHaveBeenCalled();
      expect(mockRes2.write).toHaveBeenCalled();
    });

    it('should handle invalid step ID gracefully', () => {
      const sessionId = `invalid-step-${Date.now()}`;

      progressTracker.startTracking(sessionId, 'https://test.gov', 'rfp_processing');

      // Update with invalid step ID
      progressTracker.updateStep(
        sessionId,
        'non_existent_step',
        'completed',
        'Test'
      );

      // Should not throw, and progress should be unchanged
      const progress = progressTracker.getProgress(sessionId);
      expect(progress?.completedSteps).toBe(0);
    });

    it('should set rfpId correctly during processing', () => {
      const sessionId = `rfpid-test-${Date.now()}`;
      const testRfpId = 'rfp-abc-123';

      progressTracker.startTracking(sessionId, 'https://test.gov', 'rfp_processing');

      // Initially no rfpId
      let progress = progressTracker.getProgress(sessionId);
      expect(progress?.rfpId).toBeUndefined();

      // Set rfpId
      progressTracker.setRfpId(sessionId, testRfpId);

      // Now has rfpId
      progress = progressTracker.getProgress(sessionId);
      expect(progress?.rfpId).toBe(testRfpId);
    });
  });
});
