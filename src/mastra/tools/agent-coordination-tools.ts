import { createTool } from '@mastra/core';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { storage } from '../../../server/storage';

/**
 * Type helper to infer the context type from a Zod schema
 */
type InferContext<T extends z.ZodTypeAny> = z.infer<T>;

/**
 * Execute function parameter type for Mastra tools
 */
interface ToolExecuteParams<TContext> {
  context: TContext;
}

/**
 * Agent Coordination Tools
 *
 * These tools enable the Primary Orchestrator to delegate tasks to manager agents,
 * track coordination events, and communicate between agents in the 3-tier hierarchy.
 */

// ============ HELPER FUNCTIONS ============

/**
 * Map priority string to numeric score
 * @param priority - Priority level string
 * @returns Numeric priority score (1-10)
 */
function mapPriorityToScore(priority: string): number {
  switch (priority) {
    case 'low':
      return 1;
    case 'medium':
      return 5;
    case 'high':
      return 8;
    default:
      return 10; // 'urgent' or any other value
  }
}

const WORK_ITEM_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'suspended',
] as const;
type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

function normalizeWorkItemStatus(
  status?: string | null
): WorkItemStatus | undefined {
  if (!status) {
    return undefined;
  }
  return WORK_ITEM_STATUSES.includes(status as WorkItemStatus)
    ? (status as WorkItemStatus)
    : undefined;
}

const MESSAGE_TYPES = ['information', 'request', 'response', 'alert'] as const;
type AgentMessageType = (typeof MESSAGE_TYPES)[number];

function normalizeMessageType(value: unknown): AgentMessageType {
  return MESSAGE_TYPES.includes(value as AgentMessageType)
    ? (value as AgentMessageType)
    : 'information';
}

const baseResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
});

const delegationResultSchema = baseResultSchema.extend({
  workItemId: z.string().optional(),
  workflowId: z.string().optional(),
  assignedAgent: z.string().optional(),
  priority: z.number().optional(),
});

const taskStatusResultSchema = baseResultSchema.extend({
  workItemId: z.string().optional(),
  status: z
    .enum(['pending', 'running', 'completed', 'failed', 'suspended'])
    .optional(),
  progress: z.number().min(0).max(100).optional(),
  assignedAgent: z.string().optional(),
  result: z.record(z.any()).nullable().optional(),
  error: z.string().optional(),
  updatedAt: z.date().optional(),
});

const specialistResultSchema = baseResultSchema.extend({
  workItemId: z.string().optional(),
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
    .optional(),
});

const messageResultSchema = baseResultSchema.extend({
  targetAgent: z.string().optional(),
});

const getMessagesResultSchema = baseResultSchema.extend({
  messages: z
    .array(
      z.object({
        from: z.string().optional(),
        messageType: z.enum(['information', 'request', 'response', 'alert']),
        content: z.record(z.any()).optional(),
        timestamp: z.coerce.date().optional(),
      })
    )
    .default([]),
});

const coordinatedWorkflowResultSchema = baseResultSchema.extend({
  workflowId: z.string().optional(),
  workflowName: z.string().optional(),
  phases: z.number().optional(),
  workItemIds: z.array(z.string()).optional(),
});

const workflowProgressResultSchema = baseResultSchema.extend({
  workflowId: z.string().optional(),
  updates: z
    .object({
      progress: z.number(),
      currentPhase: z.string().optional(),
      status: z
        .enum(['pending', 'running', 'suspended', 'completed', 'failed'])
        .optional(),
    })
    .optional(),
});

const ABORT_ERROR_CODE = 'ABORTED';

function ensureNotAborted(abortSignal?: AbortSignal) {
  if (abortSignal?.aborted) {
    const error = new Error('Tool execution aborted by caller');
    error.name = 'AbortError';
    throw error;
  }
}

function toFailureResult<T extends z.infer<typeof baseResultSchema>>(
  error: unknown,
  defaultCode: string
): T {
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      success: false,
      errorCode: ABORT_ERROR_CODE,
      error: error.message,
    } as T;
  }

  return {
    success: false,
    errorCode: defaultCode,
    error: error instanceof Error ? error.message : 'Unknown error',
  } as T;
}

// ============ DELEGATION TOOLS ============

/**
 * Delegate a task to a manager agent (Tier 2)
 */
const delegateToManagerSchema = z.object({
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
    .datetime()
    .optional()
    .describe('ISO 8601 datetime string for task completion deadline'),
  sessionId: z.string().optional().describe('Session ID for the workflow'),
});

export const delegateToManager = createTool({
  id: 'delegate-to-manager',
  description:
    'Delegate a task to a Tier 2 manager agent (Portal Manager, Proposal Manager, or Research Manager)',
  inputSchema: delegateToManagerSchema,
  outputSchema: delegationResultSchema,
  execute: async (
    {
      context,
    }: ToolExecuteParams<InferContext<typeof delegateToManagerSchema>>,
    { abortSignal }: { abortSignal?: AbortSignal } = {}
  ) => {
    const {
      managerAgent,
      taskType,
      taskDescription,
      priority,
      inputs,
      deadline,
      sessionId: providedSessionId,
    } = context;
    try {
      ensureNotAborted(abortSignal);
      const sessionId = providedSessionId || `session_${nanoid()}`;
      const workflowId = `workflow_${nanoid()}`;

      ensureNotAborted(abortSignal);
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
        priority: mapPriorityToScore(priority),
        deadline: deadline ? new Date(deadline) : undefined,
        expectedOutputs: ['result', 'status', 'metadata'],
        contextRef: JSON.stringify({ managerAgent, taskType }),
        createdByAgentId: 'primary-orchestrator',
        assignedAgentId: managerAgent,
        status: 'pending',
      });

      ensureNotAborted(abortSignal);
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
        priority: workItem.priority,
      };
    } catch (error) {
      return toFailureResult(error, 'DELEGATION_FAILED');
    }
  },
});

/**
 * Check the status of a delegated task
 */
const checkTaskStatusSchema = z.object({
  workItemId: z.string().describe('The ID of the work item to check'),
});

export const checkTaskStatus = createTool({
  id: 'check-task-status',
  description: 'Check the status of a task that was delegated to another agent',
  inputSchema: checkTaskStatusSchema,
  outputSchema: taskStatusResultSchema,
  execute: async (
    { context }: ToolExecuteParams<InferContext<typeof checkTaskStatusSchema>>,
    { abortSignal }: { abortSignal?: AbortSignal } = {}
  ) => {
    const { workItemId } = context;
    try {
      ensureNotAborted(abortSignal);
      const workItem = await storage.getWorkItem(workItemId);

      if (!workItem) {
        return {
          success: false,
          error: 'Work item not found',
          errorCode: 'WORK_ITEM_NOT_FOUND',
        };
      }

      ensureNotAborted(abortSignal);
      return {
        success: true,
        workItemId: workItem.id,
        status: normalizeWorkItemStatus(workItem.status),
        progress:
          ((workItem.metadata as Record<string, unknown>)?.progress as
            | number
            | undefined) || 0,
        assignedAgent: workItem.assignedAgentId ?? undefined,
        result: workItem.result as Record<string, unknown> | null,
        error: workItem.error ?? undefined,
        updatedAt:
          workItem.updatedAt instanceof Date
            ? workItem.updatedAt
            : workItem.updatedAt
              ? new Date(workItem.updatedAt)
              : undefined,
        message: `Status retrieved for work item ${workItem.id}`,
      };
    } catch (error) {
      return toFailureResult(error, 'STATUS_CHECK_FAILED');
    }
  },
});

/**
 * Request a specialist agent (Tier 3) to perform a specific task
 */
const requestSpecialistSchema = z.object({
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
  sessionId: z.string().optional().describe('Session ID for the workflow'),
  workflowId: z.string().optional().describe('Workflow ID'),
  agentId: z.string().optional().describe('ID of the agent making the request'),
});

export const requestSpecialist = createTool({
  id: 'request-specialist',
  description:
    'Request a Tier 3 specialist agent to perform a specific task (used by manager agents)',
  inputSchema: requestSpecialistSchema,
  outputSchema: specialistResultSchema,
  execute: async (
    {
      context,
    }: ToolExecuteParams<InferContext<typeof requestSpecialistSchema>>,
    { abortSignal }: { abortSignal?: AbortSignal } = {}
  ) => {
    const {
      specialistAgent,
      taskType,
      inputs,
      priority,
      sessionId: providedSessionId,
      workflowId: providedWorkflowId,
      agentId,
    } = context;
    try {
      ensureNotAborted(abortSignal);
      const sessionId = providedSessionId || `session_${nanoid()}`;
      const workflowId = providedWorkflowId || `workflow_${nanoid()}`;

      ensureNotAborted(abortSignal);
      const workItem = await storage.createWorkItem({
        sessionId,
        workflowId,
        taskType,
        inputs,
        priority: mapPriorityToScore(priority),
        expectedOutputs: ['result'],
        createdByAgentId: agentId || 'unknown',
        assignedAgentId: specialistAgent,
        status: 'pending',
      });

      ensureNotAborted(abortSignal);
      await storage.createCoordinationLog({
        sessionId,
        workflowId,
        initiatorAgentId: agentId || 'unknown',
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
        message: `Task ${taskType} delegated to ${specialistAgent}`,
      };
    } catch (error) {
      return toFailureResult(error, 'SPECIALIST_DELEGATION_FAILED');
    }
  },
});

// ============ COMMUNICATION TOOLS ============

/**
 * Send a message to another agent
 */
const sendAgentMessageSchema = z.object({
  targetAgent: z.string().describe('The agent ID to send the message to'),
  messageType: z.enum(['information', 'request', 'response', 'alert']),
  content: z.record(z.any()).describe('Message content'),
  sessionId: z.string().optional().describe('Session ID'),
  workflowId: z.string().optional().describe('Workflow ID'),
  agentId: z
    .string()
    .optional()
    .describe('ID of the agent sending the message'),
});

export const sendAgentMessage = createTool({
  id: 'send-agent-message',
  description: 'Send a message or data to another agent in the hierarchy',
  inputSchema: sendAgentMessageSchema,
  outputSchema: messageResultSchema,
  execute: async (
    { context }: ToolExecuteParams<InferContext<typeof sendAgentMessageSchema>>,
    { abortSignal }: { abortSignal?: AbortSignal } = {}
  ) => {
    const {
      targetAgent,
      messageType,
      content,
      sessionId: providedSessionId,
      workflowId,
      agentId,
    } = context;
    try {
      ensureNotAborted(abortSignal);
      const sessionId = providedSessionId || `session_${nanoid()}`;

      ensureNotAborted(abortSignal);
      await storage.createCoordinationLog({
        sessionId,
        workflowId,
        initiatorAgentId: agentId || 'unknown',
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
        targetAgent,
        message: 'Message sent successfully',
      };
    } catch (error) {
      return toFailureResult(error, 'MESSAGE_DISPATCH_FAILED');
    }
  },
});

/**
 * Retrieve messages sent to this agent
 */
const getAgentMessagesSchema = z.object({
  limit: z
    .number()
    .default(10)
    .describe('Maximum number of messages to retrieve'),
  agentId: z
    .string()
    .optional()
    .describe('ID of the agent to retrieve messages for'),
});

export const getAgentMessages = createTool({
  id: 'get-agent-messages',
  description: 'Retrieve messages that have been sent to this agent',
  inputSchema: getAgentMessagesSchema,
  outputSchema: getMessagesResultSchema,
  execute: async (
    { context }: ToolExecuteParams<InferContext<typeof getAgentMessagesSchema>>,
    { abortSignal }: { abortSignal?: AbortSignal } = {}
  ) => {
    const { limit, agentId: providedAgentId } = context;
    try {
      ensureNotAborted(abortSignal);
      const agentId = providedAgentId || 'unknown';

      ensureNotAborted(abortSignal);
      const logs = await storage.getCoordinationLogs(limit);
      const messages = logs.filter(
        log =>
          log.targetAgentId === agentId && log.coordinationType === 'message'
      );

      return {
        success: true,
        messages: messages.map(log => ({
          from: log.initiatorAgentId,
          messageType: normalizeMessageType(log.payload?.messageType),
          content: log.payload?.content,
          timestamp:
            log.startedAt instanceof Date
              ? log.startedAt
              : log.startedAt
                ? new Date(log.startedAt)
                : undefined,
        })),
        message: `Retrieved ${messages.length} message(s) for ${agentId}`,
      };
    } catch (error) {
      const failure = toFailureResult(error, 'GET_MESSAGES_FAILED');
      return {
        ...failure,
        messages: [],
      };
    }
  },
});

// ============ WORKFLOW COORDINATION TOOLS ============

/**
 * Create a coordinated workflow across multiple agents
 */
const createCoordinatedWorkflowSchema = z.object({
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
  sessionId: z.string().optional().describe('Session ID'),
  agentId: z
    .string()
    .optional()
    .describe('ID of the agent creating the workflow'),
});

export const createCoordinatedWorkflow = createTool({
  id: 'create-coordinated-workflow',
  description:
    'Create a multi-agent workflow with defined phases and dependencies',
  inputSchema: createCoordinatedWorkflowSchema,
  outputSchema: coordinatedWorkflowResultSchema,
  execute: async (
    {
      context,
    }: ToolExecuteParams<InferContext<typeof createCoordinatedWorkflowSchema>>,
    { abortSignal }: { abortSignal?: AbortSignal } = {}
  ) => {
    const {
      workflowName,
      phases,
      sessionId: providedSessionId,
      agentId,
    } = context;
    try {
      ensureNotAborted(abortSignal);
      const workflowId = `workflow_${nanoid()}`;
      const sessionId = providedSessionId || `session_${nanoid()}`;

      // Validate phase dependencies
      const phaseNames = new Set(phases.map(p => p.phaseName));
      for (const phase of phases) {
        if (phase.dependsOn) {
          for (const dependency of phase.dependsOn) {
            if (!phaseNames.has(dependency)) {
              return {
                success: false,
                errorCode: 'INVALID_DEPENDENCY',
                error: `Invalid workflow: Phase "${phase.phaseName}" depends on non-existent phase "${dependency}"`,
              };
            }
          }
        }
      }

      ensureNotAborted(abortSignal);
      // Create workflow state
      await storage.createWorkflowState({
        workflowId,
        sessionId,
        currentPhase: 'discovery',
        status: 'pending',
        progress: 0,
        context: {
          workflowName,
          phases: phases.map(p => p.phaseName),
          createdBy: agentId || 'primary-orchestrator',
        },
      });

      ensureNotAborted(abortSignal);
      // Create work items for each phase
      const workItems = [];
      for (const phase of phases) {
        ensureNotAborted(abortSignal);
        const workItem = await storage.createWorkItem({
          sessionId,
          workflowId,
          taskType: phase.taskType,
          inputs: {
            ...phase.inputs,
            phaseName: phase.phaseName,
            dependsOn: phase.dependsOn || [],
          },
          createdByAgentId: agentId || 'primary-orchestrator',
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
      return toFailureResult(error, 'WORKFLOW_CREATION_FAILED');
    }
  },
});

/**
 * Update workflow progress
 */
const updateWorkflowProgressSchema = z.object({
  workflowId: z.string().describe('The workflow ID'),
  progress: z.number().min(0).max(100).describe('Progress percentage'),
  currentPhase: z.string().optional(),
  status: z
    .enum(['pending', 'running', 'suspended', 'completed', 'failed'])
    .optional(),
});

export const updateWorkflowProgress = createTool({
  id: 'update-workflow-progress',
  description: 'Update the progress of a running workflow',
  inputSchema: updateWorkflowProgressSchema,
  outputSchema: workflowProgressResultSchema,
  execute: async (
    {
      context,
    }: ToolExecuteParams<InferContext<typeof updateWorkflowProgressSchema>>,
    { abortSignal }: { abortSignal?: AbortSignal } = {}
  ) => {
    const { workflowId, progress, currentPhase, status } = context;
    try {
      ensureNotAborted(abortSignal);
      const updates: {
        progress: number;
        currentPhase?: string;
        status?: 'pending' | 'running' | 'suspended' | 'completed' | 'failed';
      } = { progress };
      if (currentPhase) updates.currentPhase = currentPhase;
      if (status) updates.status = status;

      ensureNotAborted(abortSignal);
      await storage.updateWorkflowState(workflowId, updates);

      return {
        success: true,
        workflowId,
        updates,
        message: 'Workflow progress updated',
      };
    } catch (error) {
      return toFailureResult(error, 'WORKFLOW_UPDATE_FAILED');
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
