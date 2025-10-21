import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { storage } from '../server/storage';
import { agentCoordinationTools } from '../src/mastra/tools/agent-coordination-tools';
import { saflaLearningEngine } from '../server/services/learning/saflaLearningEngine';
import { nanoid } from 'nanoid';
import { createTestSession, cleanupTestData, type TestSession } from './helpers/testDatabase';

/**
 * Integration Tests for Multi-Agent Coordination System
 *
 * Tests the 3-tier agent hierarchy:
 * - Tier 1: Primary Orchestrator
 * - Tier 2: Manager Agents (Portal, Proposal, Research)
 * - Tier 3: Specialist Agents
 */

describe('Agent Coordination System', () => {
  let testSession: TestSession;
  let testWorkItemId: string;

  beforeAll(async () => {
    // Create a test session that will be used across all tests
    testSession = await createTestSession(`coord_${nanoid()}`);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(() => {
    // Reset any test state
    testWorkItemId = '';
  });

  describe('Tier 1 -> Tier 2 Delegation', () => {
    it('should delegate task from orchestrator to portal manager', async () => {
      const result = await agentCoordinationTools.delegateToManager.execute({
        context: { sessionId: testSession.sessionId, agentId: 'primary-orchestrator' },
        managerAgent: 'portal-manager',
        taskType: 'portal_scan',
        taskDescription: 'Scan SAM.gov for new federal RFPs',
        priority: 'high',
        inputs: {
          portalId: 'sam-gov',
          searchCriteria: {
            keywords: ['software', 'development'],
            agencies: ['GSA'],
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.workItemId).toBeDefined();
      expect(result.assignedAgent).toBe('portal-manager');

      testWorkItemId = result.workItemId!;

      // Verify work item was created
      const workItem = await storage.getWorkItem(testWorkItemId);
      expect(workItem).toBeDefined();
      expect(workItem!.assignedAgentId).toBe('portal-manager');
      expect(workItem!.taskType).toBe('portal_scan');
    });

    it('should delegate task to proposal manager', async () => {
      const result = await agentCoordinationTools.delegateToManager.execute({
        context: { sessionId: testSession.sessionId, agentId: 'primary-orchestrator' },
        managerAgent: 'proposal-manager',
        taskType: 'proposal_generation',
        taskDescription: 'Generate proposal for RFP-2024-001',
        priority: 'urgent',
        inputs: {
          rfpId: 'test-rfp-123',
          requirements: ['Technical approach', 'Pricing', 'Team qualifications'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.assignedAgent).toBe('proposal-manager');
    });

    it('should delegate task to research manager', async () => {
      const result = await agentCoordinationTools.delegateToManager.execute({
        context: { sessionId: testSession.sessionId, agentId: 'primary-orchestrator' },
        managerAgent: 'research-manager',
        taskType: 'market_research',
        taskDescription: 'Research market conditions for cloud services RFP',
        priority: 'medium',
        inputs: {
          industry: 'cloud services',
          region: 'federal',
        },
      });

      expect(result.success).toBe(true);
      expect(result.assignedAgent).toBe('research-manager');
    });
  });

  describe('Tier 2 -> Tier 3 Specialist Requests', () => {
    it('should request portal scanner specialist', async () => {
      const result = await agentCoordinationTools.requestSpecialist.execute({
        context: {
          sessionId: testSession.sessionId,
          agentId: 'portal-manager',
          workflowId: `workflow_${nanoid()}`,
        },
        specialistAgent: 'portal-scanner',
        taskType: 'scan_portal',
        inputs: {
          portalUrl: 'https://sam.gov',
          extractionRules: {
            titleSelector: '.title',
            agencySelector: '.agency',
          },
        },
        priority: 'high',
      });

      expect(result.success).toBe(true);
      expect(result.specialistAgent).toBe('portal-scanner');

      // Verify coordination log was created
      const logs = await storage.getCoordinationLogs(10);
      const relevantLog = logs.find(
        log =>
          log.initiatorAgentId === 'portal-manager' &&
          log.targetAgentId === 'portal-scanner' &&
          log.coordinationType === 'specialist_request'
      );
      expect(relevantLog).toBeDefined();
    });

    it('should request compliance checker specialist', async () => {
      const result = await agentCoordinationTools.requestSpecialist.execute({
        context: {
          sessionId: testSession.sessionId,
          agentId: 'proposal-manager',
        },
        specialistAgent: 'compliance-checker',
        taskType: 'check_compliance',
        inputs: {
          proposalId: 'test-proposal-123',
          requirements: ['Section 508', 'FAR clauses'],
        },
        priority: 'urgent',
      });

      expect(result.success).toBe(true);
      expect(result.specialistAgent).toBe('compliance-checker');
    });
  });

  describe('Task Status Monitoring', () => {
    beforeAll(async () => {
      // Create a test work item
      const result = await agentCoordinationTools.delegateToManager.execute({
        context: { sessionId: testSession.sessionId, agentId: 'primary-orchestrator' },
        managerAgent: 'portal-manager',
        taskType: 'test_task',
        taskDescription: 'Test task for status monitoring',
        priority: 'low',
        inputs: {},
      });

      testWorkItemId = result.workItemId!;
    });

    it('should check status of delegated task', async () => {
      const result = await agentCoordinationTools.checkTaskStatus.execute({
        workItemId: testWorkItemId,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.assignedAgent).toBe('portal-manager');
    });

    it('should return error for non-existent work item', async () => {
      const result = await agentCoordinationTools.checkTaskStatus.execute({
        workItemId: 'non-existent-id',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Agent-to-Agent Messaging', () => {
    it('should send message between agents', async () => {
      const result = await agentCoordinationTools.sendAgentMessage.execute({
        context: {
          sessionId: testSession.sessionId,
          agentId: 'portal-manager',
        },
        targetAgent: 'primary-orchestrator',
        messageType: 'information',
        content: {
          type: 'scan_complete',
          rfpsFound: 15,
          portalId: 'sam-gov',
        },
      });

      expect(result.success).toBe(true);

      // Verify message was logged
      const logs = await storage.getCoordinationLogs(10);
      const messageLog = logs.find(
        log =>
          log.coordinationType === 'message' &&
          log.initiatorAgentId === 'portal-manager' &&
          log.targetAgentId === 'primary-orchestrator'
      );
      expect(messageLog).toBeDefined();
    });

    it('should retrieve messages for an agent', async () => {
      // Send a test message first
      await agentCoordinationTools.sendAgentMessage.execute({
        context: { sessionId: testSession.sessionId, agentId: 'primary-orchestrator' },
        targetAgent: 'portal-manager',
        messageType: 'request',
        content: { action: 'check_portal_health' },
      });

      // Retrieve messages
      const result = await agentCoordinationTools.getAgentMessages.execute({
        context: { sessionId: testSession.sessionId, agentId: 'portal-manager' },
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);
    });
  });

  describe('Coordinated Workflow Creation', () => {
    it('should create multi-agent workflow', async () => {
      const result = await agentCoordinationTools.createCoordinatedWorkflow.execute({
        context: { sessionId: testSession.sessionId, agentId: 'primary-orchestrator' },
        workflowName: 'Full RFP Processing Workflow',
        phases: [
          {
            phaseName: 'Discovery',
            assignedAgent: 'portal-manager',
            taskType: 'portal_scan',
            inputs: { portalId: 'sam-gov' },
          },
          {
            phaseName: 'Analysis',
            assignedAgent: 'proposal-manager',
            taskType: 'rfp_analysis',
            inputs: {},
            dependsOn: ['Discovery'],
          },
          {
            phaseName: 'Generation',
            assignedAgent: 'proposal-manager',
            taskType: 'proposal_generation',
            inputs: {},
            dependsOn: ['Analysis'],
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.workflowId).toBeDefined();
      expect(result.phases).toBe(3);
      expect(result.workItemIds).toHaveLength(3);

      // Verify workflow state was created
      const workflows = await storage.getActiveWorkflows();
      const ourWorkflow = workflows.find(w => w.workflowId === result.workflowId);
      expect(ourWorkflow).toBeDefined();
    });

    it('should update workflow progress', async () => {
      // Create workflow first
      const createResult = await agentCoordinationTools.createCoordinatedWorkflow.execute({
        context: { sessionId: testSession.sessionId, agentId: 'primary-orchestrator' },
        workflowName: 'Test Progress Workflow',
        phases: [
          {
            phaseName: 'Phase 1',
            assignedAgent: 'portal-manager',
            taskType: 'test',
            inputs: {},
          },
        ],
      });

      const workflowId = createResult.workflowId!;

      // Update progress
      const updateResult = await agentCoordinationTools.updateWorkflowProgress.execute({
        workflowId,
        progress: 50,
        currentPhase: 'analysis',
        status: 'running',
      });

      expect(updateResult.success).toBe(true);

      // Verify update
      const workflows = await storage.getActiveWorkflows();
      const workflow = workflows.find(w => w.workflowId === workflowId);
      expect(workflow?.progress).toBe(50);
      expect(workflow?.status).toBe('running');
    });
  });
});

describe('SAFLA Learning Engine', () => {
  const testAgentId = 'test-portal-manager';

  describe('Learning from Outcomes', () => {
    it('should learn from successful portal scan', async () => {
      const initialEvents = await saflaLearningEngine.getEvents(testAgentId, 'portal_scan');
      const initialEventCount = initialEvents.length;

      const learningEvent = {
        agentId: testAgentId,
        taskType: 'portal_scan',
        context: {
          portalId: 'sam-gov',
          scanStrategy: 'full_depth',
          selectors: {
            title: '.rfp-title',
            agency: '.agency-name',
          },
        },
        outcome: {
          success: true,
          metrics: {
            rfpsFound: 25,
            scanDuration: 45000,
            accuracy: 0.95,
          },
        },
        timestamp: new Date(),
      };

      await saflaLearningEngine.learn(learningEvent);

      // Verify learning event was persisted
      const updatedEvents = await saflaLearningEngine.getEvents(testAgentId, 'portal_scan');

      // Total events should have increased
      expect(updatedEvents.length).toBeGreaterThan(initialEventCount);
      expect(updatedEvents.length).toBe(initialEventCount + 1);

      // Find the latest event
      const latestEvent = updatedEvents[updatedEvents.length - 1];
      expect(latestEvent).toBeDefined();
      expect(latestEvent.agentId).toBe(testAgentId);
      expect(latestEvent.memoryType).toBe('episodic');
      expect(latestEvent.content.taskType).toBe('portal_scan');
      expect(latestEvent.content.outcome.success).toBe(true);

      // Verify context was stored
      expect(latestEvent.content.context.portalId).toBe('sam-gov');
      expect(latestEvent.content.context.scanStrategy).toBe('full_depth');
      expect(latestEvent.content.context.selectors).toEqual({
        title: '.rfp-title',
        agency: '.agency-name',
      });

      // Verify metrics were stored
      expect(latestEvent.content.outcome.metrics.rfpsFound).toBe(25);
      expect(latestEvent.content.outcome.metrics.scanDuration).toBe(45000);
      expect(latestEvent.content.outcome.metrics.accuracy).toBe(0.95);

      // Verify tags include success
      expect(latestEvent.tags).toContain('success');
      expect(latestEvent.tags).toContain('learning_event');
      expect(latestEvent.tags).toContain('portal_scan');
    });

    it('should learn from failed document processing', async () => {
      const initialEvents = await saflaLearningEngine.getEvents(testAgentId, 'document_processing');
      const initialEventCount = initialEvents.length;

      const learningEvent = {
        agentId: testAgentId,
        taskType: 'document_processing',
        context: {
          documentType: 'PDF',
          parsingMethod: 'text_extraction',
        },
        outcome: {
          success: false,
          metrics: {
            fieldsExtracted: 3,
            expectedFields: 10,
            accuracy: 0.3,
          },
          errorDetails: {
            error: 'OCR quality too low',
            reason: 'Scanned document with poor image quality',
          },
        },
        timestamp: new Date(),
      };

      await saflaLearningEngine.learn(learningEvent);

      // Verify learning event was persisted
      const updatedEvents = await saflaLearningEngine.getEvents(testAgentId, 'document_processing');

      // Total events should have increased
      expect(updatedEvents.length).toBeGreaterThan(initialEventCount);
      expect(updatedEvents.length).toBe(initialEventCount + 1);

      // Find the latest event
      const latestEvent = updatedEvents[updatedEvents.length - 1];
      expect(latestEvent).toBeDefined();
      expect(latestEvent.agentId).toBe(testAgentId);
      expect(latestEvent.memoryType).toBe('episodic');
      expect(latestEvent.content.taskType).toBe('document_processing');
      expect(latestEvent.content.outcome.success).toBe(false);

      // Verify context was stored
      expect(latestEvent.content.context.documentType).toBe('PDF');
      expect(latestEvent.content.context.parsingMethod).toBe('text_extraction');

      // Verify metrics were stored
      expect(latestEvent.content.outcome.metrics.fieldsExtracted).toBe(3);
      expect(latestEvent.content.outcome.metrics.expectedFields).toBe(10);
      expect(latestEvent.content.outcome.metrics.accuracy).toBe(0.3);

      // Verify error details were stored
      expect(latestEvent.content.outcome.errorDetails).toBeDefined();
      expect(latestEvent.content.outcome.errorDetails.error).toBe('OCR quality too low');
      expect(latestEvent.content.outcome.errorDetails.reason).toBe('Scanned document with poor image quality');

      // Verify tags include failure
      expect(latestEvent.tags).toContain('failure');
      expect(latestEvent.tags).toContain('learning_event');
      expect(latestEvent.tags).toContain('document_processing');

      // Verify importance is higher for failures (8 vs 6 for successes)
      expect(latestEvent.importance).toBe(8);
    });
  });

  describe('Applying Learned Strategies', () => {
    beforeAll(async () => {
      // Create some learning events to build up strategies
      for (let i = 0; i < 15; i++) {
        await saflaLearningEngine.learn({
          agentId: testAgentId,
          taskType: 'portal_scan',
          context: {
            portalId: 'sam-gov',
            scanStrategy: 'incremental',
          },
          outcome: {
            success: true,
            metrics: {
              rfpsFound: 10 + i,
              scanDuration: 30000 + i * 1000,
              accuracy: 0.9 + i * 0.01,
            },
          },
          timestamp: new Date(),
        });
      }
    });

    it('should apply learned strategy to new task', async () => {
      const strategy = await saflaLearningEngine.applyLearning(
        testAgentId,
        'portal_scan',
        {
          portalId: 'sam-gov',
          userIntent: 'find_federal_rfps',
        }
      );

      // Strategy might be null if not enough data or low confidence
      if (strategy) {
        expect(strategy.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(strategy.confidenceScore).toBeLessThanOrEqual(1);
        expect(strategy.domain).toBeDefined();
      }
    });
  });

  describe('Learning Metrics', () => {
    it('should retrieve learning metrics', async () => {
      const metrics = await saflaLearningEngine.getLearningMetrics();

      expect(metrics.totalEvents).toBeGreaterThanOrEqual(0);
      expect(metrics.activeStrategies).toBeGreaterThanOrEqual(0);
      expect(metrics.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(metrics.averageConfidence).toBeLessThanOrEqual(1);
    });
  });
});

describe('End-to-End Agent Workflow', () => {
  let e2eSession: TestSession;

  beforeAll(async () => {
    e2eSession = await createTestSession(`e2e_${nanoid()}`);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('should execute complete 3-tier agent workflow', async () => {
    // Step 1: Orchestrator delegates to Portal Manager
    const delegateResult = await agentCoordinationTools.delegateToManager.execute({
      context: { sessionId: e2eSession.sessionId, agentId: 'primary-orchestrator' },
      managerAgent: 'portal-manager',
      taskType: 'portal_scan',
      taskDescription: 'E2E test scan',
      priority: 'high',
      inputs: { portalId: 'test-portal' },
    });

    expect(delegateResult.success).toBe(true);
    const workItemId = delegateResult.workItemId!;

    // Step 2: Portal Manager requests Portal Scanner specialist
    const specialistResult = await agentCoordinationTools.requestSpecialist.execute({
      context: { sessionId: e2eSession.sessionId, agentId: 'portal-manager', workflowId: delegateResult.workflowId },
      specialistAgent: 'portal-scanner',
      taskType: 'scan_portal',
      inputs: { portalUrl: 'https://test.gov' },
      priority: 'high',
    });

    expect(specialistResult.success).toBe(true);

    // Step 3: Check task status
    const statusResult = await agentCoordinationTools.checkTaskStatus.execute({
      workItemId,
    });

    expect(statusResult.success).toBe(true);
    expect(statusResult.status).toBeDefined();

    // Step 4: Portal Manager sends result back to Orchestrator
    const messageResult = await agentCoordinationTools.sendAgentMessage.execute({
      context: { sessionId: e2eSession.sessionId, agentId: 'portal-manager' },
      targetAgent: 'primary-orchestrator',
      messageType: 'response',
      content: {
        taskCompleted: true,
        rfpsFound: 10,
        workItemId,
      },
    });

    expect(messageResult.success).toBe(true);

    // Step 5: Log learning event
    await saflaLearningEngine.learn({
      agentId: 'portal-manager',
      taskType: 'portal_scan',
      context: { portalId: 'test-portal', scanType: 'e2e_test' },
      outcome: {
        success: true,
        metrics: { rfpsFound: 10, duration: 5000 },
      },
      timestamp: new Date(),
    });

    // All steps completed successfully
    expect(true).toBe(true);
  });
});
