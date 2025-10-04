import { createTool } from '@mastra/core';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { storage } from '../../../server/storage';

/**
 * Agent Coordination Tools
 *
 * These tools enable the Primary Orchestrator to delegate tasks to manager agents,
 * track coordination events, and communicate between agents in the 3-tier hierarchy.
 */

// ============ DELEGATION TOOLS ============

/**
 * Delegate a task to a manager agent (Tier 2)
 */
export const delegateToManager = createTool({
  id: 'delegate-to-manager',
  description:
    'Delegate a task to a Tier 2 manager agent (Portal Manager, Proposal Manager, or Research Manager)',
  inputSchema: z.object({
    managerAgent: z
      .enum(['portal-manager', 'proposal-manager', 'research-manager'])
      .describe('The manager agent to delegate to'),
    taskType: z
      .string()
      .describe(
        "Type of task (e.g., 'portal_scan', 'proposal_generation', 'market_research')"
      ),
    taskDescription: z.string().describe('Detailed description of the task'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    inputs: z.record(z.any()).describe('Input parameters for the task'),
    deadline: z
      .string()
      .optional()
      .describe('ISO deadline for task completion'),
  }),
  execute: async (context, options) => {
    const {
      managerAgent,
      taskType,
      taskDescription,
      priority,
      inputs,
      deadline,
    } = (options as any) || {};
    try {
      const sessionId = (context as any).sessionId || `session_${nanoid()}`;
      const workflowId = `workflow_${nanoid()}`;

      // Create work item for the manager agent
      const workItem = await storage.createWorkItem({
        sessionId,
        workflowId,
        taskType,
        inputs: {
          description: taskDescription,
          delegatedBy: 'primary-orchestrator',
          ...inputs,
        },
        priority:
          priority === 'low'
            ? 1
            : priority === 'medium'
              ? 5
              : priority === 'high'
                ? 8
                : 10,
        deadline: deadline ? new Date(deadline) : undefined,
        expectedOutputs: ['result', 'status', 'metadata'],
        contextRef: JSON.stringify({ managerAgent, taskType }),
        createdByAgentId: 'primary-orchestrator',
        assignedAgentId: managerAgent,
        status: 'pending',
      });

      // Log coordination event
      await storage.createCoordinationLog({
        sessionId,
        workflowId,
        initiatorAgentId: 'primary-orchestrator',
        targetAgentId: managerAgent,
        coordinationType: 'delegation',
        priority: workItem.priority,
        payload: {
          taskType,
          taskDescription,
          workItemId: workItem.id,
        },
        status: 'pending',
      });

      return {
        success: true,
        workItemId: workItem.id,
        workflowId,
        message: `Task delegated to ${managerAgent}`,
        assignedAgent: managerAgent,
      };
    } catch (error) {
      console.error('Error delegating to manager:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Check the status of a delegated task
 */
export const checkTaskStatus = createTool({
  id: 'check-task-status',
  description: 'Check the status of a task that was delegated to another agent',
  inputSchema: z.object({
    workItemId: z.string().describe('The ID of the work item to check'),
  }),
  execute: async (context, options) => {
    const { workItemId } = (options as any) || {};
    try {
      const workItem = await storage.getWorkItem(workItemId);

      if (!workItem) {
        return {
          success: false,
          error: 'Work item not found',
        };
      }

      return {
        success: true,
        workItemId: workItem.id,
        status: workItem.status,
        progress: (workItem.metadata as any)?.progress || 0,
        assignedAgent: workItem.assignedAgentId,
        outputs: workItem.outputs as any,
        error: workItem.error,
        updatedAt: workItem.updatedAt,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Request a specialist agent (Tier 3) to perform a specific task
 */
export const requestSpecialist = createTool({
  id: 'request-specialist',
  description:
    'Request a Tier 3 specialist agent to perform a specific task (used by manager agents)',
  inputSchema: z.object({
    specialistAgent: z
      .enum([
        'portal-scanner',
        'portal-monitor',
        'content-generator',
        'compliance-checker',
        'document-processor',
        'market-analyst',
        'historical-analyzer',
      ])
      .describe('The specialist agent to request'),
    taskType: z.string().describe('Specific task type for the specialist'),
    inputs: z.record(z.any()).describe('Task inputs'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  }),
  execute: async (context, options) => {
    const { specialistAgent, taskType, inputs, priority } = (options as any) || {};
    try {
      const ctx = context as any;
      const sessionId = ctx.sessionId || `session_${nanoid()}`;
      const workflowId = ctx.workflowId || `workflow_${nanoid()}`;

      const workItem = await storage.createWorkItem({
        sessionId,
        workflowId,
        taskType,
        inputs,
        priority:
          priority === 'low'
            ? 1
            : priority === 'medium'
              ? 5
              : priority === 'high'
                ? 8
                : 10,
        expectedOutputs: ['result'],
        createdByAgentId: ctx.agentId || 'unknown',
        assignedAgentId: specialistAgent,
        status: 'pending',
      });

      await storage.createCoordinationLog({
        sessionId,
        workflowId,
        initiatorAgentId: ctx.agentId || 'unknown',
        targetAgentId: specialistAgent,
        coordinationType: 'specialist_request',
        priority: workItem.priority,
        payload: { taskType, workItemId: workItem.id },
        status: 'pending',
      });

      return {
        success: true,
        workItemId: workItem.id,
        specialistAgent,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ============ COMMUNICATION TOOLS ============

/**
 * Send a message to another agent
 */
export const sendAgentMessage = createTool({
  id: 'send-agent-message',
  description: 'Send a message or data to another agent in the hierarchy',
  inputSchema: z.object({
    targetAgent: z.string().describe('The agent ID to send the message to'),
    messageType: z.enum(['information', 'request', 'response', 'alert']),
    content: z.record(z.any()).describe('Message content'),
  }),
  execute: async (context, options) => {
    const { targetAgent, messageType, content } = (options as any) || {};
    try {
      const ctx = context as any;
      const sessionId = ctx.sessionId || `session_${nanoid()}`;

      await storage.createCoordinationLog({
        sessionId,
        workflowId: ctx.workflowId,
        initiatorAgentId: ctx.agentId || 'unknown',
        targetAgentId: targetAgent,
        coordinationType: 'message',
        priority: 5,
        payload: {
          messageType,
          content,
          timestamp: new Date().toISOString(),
        },
        status: 'completed',
      });

      return {
        success: true,
        message: 'Message sent successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Retrieve messages sent to this agent
 */
export const getAgentMessages = createTool({
  id: 'get-agent-messages',
  description: 'Retrieve messages that have been sent to this agent',
  inputSchema: z.object({
    limit: z
      .number()
      .default(10)
      .describe('Maximum number of messages to retrieve'),
  }),
  execute: async (context, options) => {
    const { limit } = (options as any) || {};
    try {
      const ctx = context as any;
      const agentId = ctx.agentId || 'unknown';

      const logs = await storage.getCoordinationLogs(limit);
      const messages = logs.filter(
        log =>
          log.targetAgentId === agentId && log.coordinationType === 'message'
      );

      return {
        success: true,
        messages: messages.map(log => ({
          from: log.initiatorAgentId,
          messageType: log.payload?.messageType,
          content: log.payload?.content,
          timestamp: log.startedAt,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ============ WORKFLOW COORDINATION TOOLS ============

/**
 * Create a coordinated workflow across multiple agents
 */
export const createCoordinatedWorkflow = createTool({
  id: 'create-coordinated-workflow',
  description:
    'Create a multi-agent workflow with defined phases and dependencies',
  inputSchema: z.object({
    workflowName: z.string().describe('Name of the workflow'),
    phases: z
      .array(
        z.object({
          phaseName: z.string(),
          assignedAgent: z.string(),
          taskType: z.string(),
          inputs: z.record(z.any()),
          dependsOn: z.array(z.string()).optional(),
        })
      )
      .describe('Workflow phases in order'),
  }),
  execute: async (context, options) => {
    const { workflowName, phases } = (options as any) || {};
    try {
      const ctx = context as any;
      const workflowId = `workflow_${nanoid()}`;
      const sessionId = ctx.sessionId || `session_${nanoid()}`;

      // Create workflow state
      await storage.createWorkflowState({
        workflowId,
        sessionId,
        currentPhase: 'discovery',
        status: 'pending',
        progress: 0,
        context: {
          workflowName,
          phases: phases.map((p: any) => p.phaseName),
          createdBy: ctx.agentId || 'primary-orchestrator',
        },
      });

      // Create work items for each phase
      const workItems = [];
      for (const phase of phases) {
        const workItem = await storage.createWorkItem({
          sessionId,
          workflowId,
          taskType: phase.taskType,
          inputs: {
            ...phase.inputs,
            phaseName: phase.phaseName,
            dependsOn: phase.dependsOn || [],
          },
          createdByAgentId: ctx.agentId || 'primary-orchestrator',
          assignedAgentId: phase.assignedAgent,
          status: 'pending',
        });
        workItems.push(workItem);
      }

      return {
        success: true,
        workflowId,
        workflowName,
        phases: workItems.length,
        workItemIds: workItems.map(w => w.id),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Update workflow progress
 */
export const updateWorkflowProgress = createTool({
  id: 'update-workflow-progress',
  description: 'Update the progress of a running workflow',
  inputSchema: z.object({
    workflowId: z.string().describe('The workflow ID'),
    progress: z.number().min(0).max(100).describe('Progress percentage'),
    currentPhase: z.string().optional(),
    status: z
      .enum(['pending', 'running', 'suspended', 'completed', 'failed'])
      .optional(),
  }),
  execute: async (context, options) => {
    const { workflowId, progress, currentPhase, status } = (options as any) || {};
    try {
      const updates: any = { progress };
      if (currentPhase) updates.currentPhase = currentPhase;
      if (status) updates.status = status;

      await storage.updateWorkflowState(workflowId, updates);

      return {
        success: true,
        workflowId,
        updates,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// Export all coordination tools
export const agentCoordinationTools = {
  delegateToManager,
  checkTaskStatus,
  requestSpecialist,
  sendAgentMessage,
  getAgentMessages,
  createCoordinatedWorkflow,
  updateWorkflowProgress,
};
