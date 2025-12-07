import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import type {
  AgentWorkSession,
  RfpAgentWorkSummary,
  AgentQueueItem,
  AgentResourceAllocation,
  AgentTrackingMessage,
} from '@shared/api/agentTracking';

const AGENT_DISPLAY_NAMES: Record<
  string,
  { displayName: string; tier: 'orchestrator' | 'manager' | 'specialist' }
> = {
  'primary-orchestrator': {
    displayName: 'Primary Orchestrator',
    tier: 'orchestrator',
  },
  'portal-manager': { displayName: 'Portal Manager', tier: 'manager' },
  'proposal-manager': { displayName: 'Proposal Manager', tier: 'manager' },
  'research-manager': { displayName: 'Research Manager', tier: 'manager' },
  'portal-scanner': { displayName: 'Portal Scanner', tier: 'specialist' },
  'portal-monitor': { displayName: 'Portal Monitor', tier: 'specialist' },
  'content-generator': { displayName: 'Content Generator', tier: 'specialist' },
  'compliance-checker': {
    displayName: 'Compliance Checker',
    tier: 'specialist',
  },
  'document-processor': {
    displayName: 'Document Processor',
    tier: 'specialist',
  },
  'market-analyst': { displayName: 'Market Analyst', tier: 'specialist' },
  'historical-analyzer': {
    displayName: 'Historical Analyzer',
    tier: 'specialist',
  },
};

interface StartSessionParams {
  rfpId: string;
  rfpTitle: string;
  agentId: string;
  taskType: string;
}

interface QueueParams {
  rfpId: string;
  rfpTitle: string;
  agentId: string;
  priority: number;
}

export class AgentTrackingService extends EventEmitter {
  private sessions: Map<string, AgentWorkSession> = new Map();
  private queue: Map<string, AgentQueueItem[]> = new Map(); // agentId -> queue
  private completedSessions: Map<string, AgentWorkSession[]> = new Map(); // rfpId -> completed sessions

  constructor() {
    super();
  }

  startWorkSession(params: StartSessionParams): AgentWorkSession {
    const { rfpId, rfpTitle, agentId, taskType } = params;
    const agentInfo = AGENT_DISPLAY_NAMES[agentId] ?? {
      displayName: agentId,
      tier: 'specialist' as const,
    };

    const session: AgentWorkSession = {
      sessionId: nanoid(),
      rfpId,
      rfpTitle,
      agentId,
      agentDisplayName: agentInfo.displayName,
      agentTier: agentInfo.tier,
      taskType,
      status: 'in_progress',
      progress: 0,
      currentStep: null,
      startedAt: new Date().toISOString(),
      estimatedCompletionAt: null,
      completedAt: null,
      error: null,
      metrics: {},
    };

    this.sessions.set(session.sessionId, session);
    this.emit('message', {
      type: 'agent:work_started',
      payload: session,
    } as AgentTrackingMessage);

    return session;
  }

  getSession(sessionId: string): AgentWorkSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateProgress(
    sessionId: string,
    progress: number,
    currentStep: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.progress = Math.min(100, Math.max(0, progress));
    session.currentStep = currentStep;

    this.emit('message', {
      type: 'agent:progress_update',
      payload: { sessionId, progress: session.progress, currentStep },
    } as AgentTrackingMessage);
  }

  completeSession(sessionId: string, result?: unknown): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.progress = 100;
    session.completedAt = new Date().toISOString();
    session.metrics.executionTimeMs =
      new Date().getTime() - new Date(session.startedAt).getTime();

    // Move to completed sessions
    const completed = this.completedSessions.get(session.rfpId) ?? [];
    completed.push(session);
    this.completedSessions.set(session.rfpId, completed);

    this.sessions.delete(sessionId);

    this.emit('message', {
      type: 'agent:work_completed',
      payload: { sessionId, result },
    } as AgentTrackingMessage);
  }

  failSession(sessionId: string, error: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'failed';
    session.error = error;
    session.completedAt = new Date().toISOString();

    const completed = this.completedSessions.get(session.rfpId) ?? [];
    completed.push(session);
    this.completedSessions.set(session.rfpId, completed);

    this.sessions.delete(sessionId);

    this.emit('message', {
      type: 'agent:work_failed',
      payload: { sessionId, error },
    } as AgentTrackingMessage);
  }

  getActiveSessionsForRfp(rfpId: string): AgentWorkSession[] {
    return Array.from(this.sessions.values()).filter(s => s.rfpId === rfpId);
  }

  getCompletedSessionsForRfp(rfpId: string): AgentWorkSession[] {
    return this.completedSessions.get(rfpId) ?? [];
  }

  getAllActiveSessions(): AgentWorkSession[] {
    return Array.from(this.sessions.values());
  }

  getRfpWorkSummary(rfpId: string): RfpAgentWorkSummary | null {
    const activeSessions = this.getActiveSessionsForRfp(rfpId);
    const completedSessions = this.getCompletedSessionsForRfp(rfpId);

    if (activeSessions.length === 0 && completedSessions.length === 0) {
      return null;
    }

    const allSessions = [...activeSessions, ...completedSessions];
    const firstSession = allSessions[0];

    const totalProgress =
      activeSessions.length > 0
        ? activeSessions.reduce((sum, s) => sum + s.progress, 0) /
          activeSessions.length
        : 100;

    return {
      rfpId,
      rfpTitle: firstSession.rfpTitle,
      agency: '', // Would need to fetch from RFP
      status: activeSessions.length > 0 ? 'processing' : 'completed',
      activeSessions,
      completedSessions,
      totalAgentsAssigned: new Set(allSessions.map(s => s.agentId)).size,
      overallProgress: Math.round(totalProgress),
      estimatedCompletion: null,
    };
  }

  // Queue management
  addToQueue(params: QueueParams): AgentQueueItem {
    const { rfpId, rfpTitle, agentId, priority } = params;
    const agentInfo = AGENT_DISPLAY_NAMES[agentId] ?? {
      displayName: agentId,
    };

    const currentQueue = this.queue.get(agentId) ?? [];

    const item: AgentQueueItem = {
      id: nanoid(),
      rfpId,
      rfpTitle,
      agentId,
      agentDisplayName: agentInfo.displayName,
      priority,
      position: currentQueue.length + 1,
      estimatedStartTime: null,
      createdAt: new Date().toISOString(),
    };

    // Insert in priority order (higher priority = earlier in queue)
    const insertIndex = currentQueue.findIndex(q => q.priority < priority);
    if (insertIndex === -1) {
      currentQueue.push(item);
    } else {
      currentQueue.splice(insertIndex, 0, item);
    }

    // Update positions
    currentQueue.forEach((q, i) => {
      q.position = i + 1;
    });

    this.queue.set(agentId, currentQueue);

    this.emit('message', {
      type: 'agent:queue_updated',
      payload: currentQueue,
    } as AgentTrackingMessage);

    return item;
  }

  removeFromQueue(queueItemId: string): void {
    for (const [agentId, queue] of this.queue.entries()) {
      const index = queue.findIndex(q => q.id === queueItemId);
      if (index !== -1) {
        queue.splice(index, 1);
        queue.forEach((q, i) => {
          q.position = i + 1;
        });
        this.queue.set(agentId, queue);

        this.emit('message', {
          type: 'agent:queue_updated',
          payload: queue,
        } as AgentTrackingMessage);
        return;
      }
    }
  }

  getAgentQueue(agentId: string): AgentQueueItem[] {
    return this.queue.get(agentId) ?? [];
  }

  getAllQueues(): Map<string, AgentQueueItem[]> {
    return this.queue;
  }

  updateQueuePriority(queueItemId: string, newPriority: number): void {
    for (const [agentId, queue] of this.queue.entries()) {
      const item = queue.find(q => q.id === queueItemId);
      if (item) {
        item.priority = newPriority;
        // Re-sort by priority
        queue.sort((a, b) => b.priority - a.priority);
        queue.forEach((q, i) => {
          q.position = i + 1;
        });
        this.queue.set(agentId, queue);

        this.emit('message', {
          type: 'agent:queue_updated',
          payload: queue,
        } as AgentTrackingMessage);
        return;
      }
    }
  }

  getResourceAllocation(): AgentResourceAllocation[] {
    const allocations: AgentResourceAllocation[] = [];

    for (const [agentId, info] of Object.entries(AGENT_DISPLAY_NAMES)) {
      const activeTasks = Array.from(this.sessions.values()).filter(
        s => s.agentId === agentId && s.status === 'in_progress'
      ).length;
      const queuedTasks = (this.queue.get(agentId) ?? []).length;
      const maxConcurrent = info.tier === 'specialist' ? 3 : 1;

      allocations.push({
        agentId,
        agentDisplayName: info.displayName,
        tier: info.tier,
        currentLoad: Math.min(100, (activeTasks / maxConcurrent) * 100),
        maxConcurrentTasks: maxConcurrent,
        activeTasks,
        queuedTasks,
        avgTaskDuration: 0, // Would calculate from historical data
      });
    }

    return allocations;
  }
}

export const agentTrackingService = new AgentTrackingService();
